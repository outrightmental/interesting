#!/usr/bin/env python3
"""Make the website more interesting.

Picks a random model from GitHub Copilot, shows it the current contents of the
/site folder, and asks it to make the website more interesting.

The model is reached through the GitHub Copilot CLI (`copilot`), which bills the
GitHub Copilot subscription behind the token in COPILOT_GITHUB_TOKEN. (GitHub
Models, which this script originally called, was retired on 2026-07-30.)

The model is silo'd: the CLI is started in an empty directory with every tool
disabled, so the model has no shell, no file access and no network access. It
can only return a JSON document describing files to write or delete, and this
script refuses any change whose path would land outside of the /site folder (or
that touches a disallowed file type). The calling workflow additionally verifies
that nothing outside /site was modified before committing.
"""

import json
import os
import random
import re
import signal
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path, PurePosixPath

MISSION = "make the website more interesting"

COPILOT_BIN = os.environ.get("COPILOT_BIN", "copilot")

# The models a random pick may draw from: only large, flagship models (the top tier of each
# provider that GitHub Copilot CLI offers through `--model`), as of 2026-10-02. Small and mid-tier
# models are deliberately absent, and is_small_model() below refuses them even if one is added.
# Copilot retires models often: an id the account can no longer use is skipped at run time
# without costing an attempt, so a stale entry here is harmless. The list can be replaced without
# a code change by setting the MODEL_POOL repository variable (comma-separated ids).
# Not listed: the Grok models, which Copilot CLI 1.0.91 cannot reach ("not accessible via the
# /chat/completions endpoint").
MODELS = [
    "claude-fable-5.1",
    "claude-fable-5",
    "claude-opus-5.5",
    "claude-opus-5",
    "claude-opus-4.8",
    "gpt-6.1-sol",
    "gpt-6-sol",
    "gpt-6-astra",
    "gpt-5.6-sol",
    "gpt-5.5",
    "gpt-5.3-codex",
    "kimi-k3",
]

# Tier names that mark a model as a small, cheap, fast or mid-tier sibling of a flagship. A model
# whose id contains one of these words is never picked at random, whatever list it came from.
# The rule is deliberately general, so the equivalents of Haiku and Sonnet at every provider are
# covered, including models that do not exist yet.
SMALL_MODEL_MARKERS = {
    "haiku", "sonnet",  # Anthropic: small and mid tier (the flagships are Opus and Fable)
    "mini", "nano", "luna", "terra",  # OpenAI: small tiers, and the mid tier of the Sol/Terra/Luna line
    "flash", "lite", "gemma",  # Google: small tiers
    "fast",  # xAI's small tier, and speed-tuned variants generally
    "small", "medium", "ministral",  # Mistral: everything below Large
    "micro",  # Amazon Nova
    "phi",  # Microsoft's small-model family
    "tiny", "light", "lightweight", "instant",  # generic names for a lesser tier
}


def is_small_model(model):
    """True if the model id names a small, cheap or mid-tier model rather than a flagship.

    The id is split into words on anything that is not a letter or digit and compared with
    SMALL_MODEL_MARKERS, so "gpt-5.4-mini" and "Claude Haiku 4.5" are small but "gemini-3-pro"
    (which merely contains the letters "mini") is not.
    """
    words = re.split(r"[^a-z0-9]+", str(model).lower())
    return any(word in SMALL_MODEL_MARKERS for word in words)


# How the Copilot CLI is locked down. The model gets no tools at all:
#   --available-tools=none  allowlist that matches no tool, so none are exposed
#   --deny-tool=...         belt and braces: denial beats any allow rule
#   no --allow-* flag       non-interactive mode refuses anything needing approval
# and it is started in an empty directory, with nothing to read.
COPILOT_FLAGS = [
    "--output-format", "json",  # JSONL events; plain text output is re-wrapped for a terminal
    "--stream", "off",
    "--no-color",
    "--log-level", "error",
    "--no-auto-update",
    "--no-custom-instructions",
    "--no-ask-user",
    "--no-remote",
    "--disable-builtin-mcps",
    "--disallow-temp-dir",
    "--available-tools=none",
    "--deny-tool=shell",
    "--deny-tool=write",
    "--deny-tool=url",
    "--secret-env-vars=COPILOT_GITHUB_TOKEN,GH_TOKEN,GITHUB_TOKEN",
]
MODEL_TIMEOUT_SECONDS = 480

AUTH_HELP = (
    "GitHub Copilot refused the request, so no model can run.\n"
    "Fix it one of two ways:\n"
    "  1. Add a repository secret named COPILOT_GITHUB_TOKEN holding a fine-grained personal\n"
    "     access token that has the \"Copilot Requests\" permission (usage is billed to that\n"
    "     user's Copilot plan), or\n"
    "  2. Enable GitHub Copilot (including the Copilot CLI policy) for the organization that\n"
    "     owns this repository, so the workflow's own token (copilot-requests: write) is accepted."
)

ALLOWED_EXTENSIONS = {
    ".html", ".css", ".js", ".mjs", ".svg", ".txt", ".json", ".md", ".xml",
    ".webmanifest",
}
PROTECTED_FILES = {"index.html", "error.html"}  # may be rewritten, never deleted
MAX_CHANGES = 20
PROMPT_BUDGET_CHARS = 80_000  # keep the prompt comfortably inside every model's context window
# Smaller than the prompt budget: a file too big to show to the next model could never be changed again.
MAX_FILE_BYTES = 50_000
MAX_ATTEMPTS = 3

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = Path(os.environ.get("SITE_DIR", REPO_ROOT / "site")).resolve()


class RejectedChange(Exception):
    pass


class ModelError(Exception):
    """This model could not produce an answer; another model may still work."""


class ModelUnavailable(ModelError):
    """Copilot does not offer this model to the account (retired, disabled or misspelled)."""


class CopilotAuthError(Exception):
    """Copilot rejected the credentials or policy; no model will work."""


class SiloBreach(Exception):
    """The model was able to use a tool. Nothing it returned may be trusted or applied."""


# One path segment: lowercase letters, digits, ".", "_" and "-", not starting with a dot. Nothing
# else is ever needed for a web path, and it rules out "..", hidden files, control characters
# (a newline in a path could smuggle a workflow command into the log) and names that collide on
# case-insensitive file systems.
PATH_SEGMENT = re.compile(r"[a-z0-9][a-z0-9._-]{0,99}")


def safe_site_path(raw):
    """Return the absolute path for a site-relative path, or raise RejectedChange."""
    if not isinstance(raw, str) or not raw.strip():
        raise RejectedChange(f"invalid path: {raw!r:.200}")
    if "\\" in raw or "\x00" in raw or raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        raise RejectedChange(f"path must be relative to /site: {raw!r:.200}")
    rel = PurePosixPath(raw)
    if rel.parts and rel.parts[0] == "site":
        rel = PurePosixPath(*rel.parts[1:])  # tolerate "site/index.html"
    if not rel.parts or len(rel.parts) > 8 or not all(PATH_SEGMENT.fullmatch(p) for p in rel.parts):
        raise RejectedChange(f"path not allowed: {raw!r:.200}")
    if rel.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise RejectedChange(f"file type not allowed: {raw!r:.200}")
    target = (SITE_DIR / rel).resolve()
    if SITE_DIR not in target.parents:
        raise RejectedChange(f"path escapes /site: {raw!r:.200}")
    return target


def read_site():
    files = []
    for path in sorted(SITE_DIR.rglob("*")):
        if path.is_file() and not path.is_symlink() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append((path.relative_to(SITE_DIR).as_posix(), path.read_text(errors="replace")))
    return files


def split_for_prompt(files):
    """Split the site into (shown, omitted): files whose content fits the prompt budget, and the
    names of the rest. index.html and error.html come first, so they are the last to be left out."""
    ordered = sorted(files, key=lambda item: (item[0] not in PROTECTED_FILES, item[0] != "index.html", item[0]))
    shown, omitted, used = [], [], 0
    for rel, content in ordered:
        if used + len(content) > PROMPT_BUDGET_CHARS:
            omitted.append(rel)
            continue
        used += len(content)
        shown.append((rel, content))
    return shown, omitted


def build_prompt(shown, omitted=()):
    system = (
        "You are the autonomous curator of a static website hosted on GitHub Pages. "
        f"Your mission, every single day: {MISSION}.\n\n"
        "Each day make one focused, delightful improvement: new content, a new page, "
        "an interactive toy, better visuals, a hidden easter egg, anything that makes the "
        "site more interesting. Build on what is already there rather than starting over.\n\n"
        "Rules:\n"
        "- Only static files (HTML, CSS, JS, SVG, text). No build steps, no external "
        "dependencies that require keys, nothing harmful, deceptive or tracking.\n"
        "- Paths are relative to the site root (e.g. \"index.html\", \"css/style.css\"). "
        "Use relative links between pages so the site works under a sub-path. File and folder "
        "names may only contain lowercase letters, digits, \".\", \"_\" and \"-\".\n"
        "- index.html and error.html must always exist and remain valid.\n"
        f"- Keep each file small (at most {MAX_FILE_BYTES // 1000} KB); return the COMPLETE new "
        "content of every file you change.\n"
        f"- At most {MAX_CHANGES} files per day.\n\n"
        "Respond with ONLY a JSON object, no prose and no markdown fences, shaped as:\n"
        '{"summary": "one sentence describing today\'s change", '
        '"files": [{"path": "index.html", "content": "<full file content>"}], '
        '"delete": ["old-page.html"]}'
    )
    parts = [f"=== {rel} ===\n{content}" for rel, content in shown]
    user = "Current contents of the website:\n\n" + "\n\n".join(parts)
    if omitted:
        user += (
            "\n\nOther existing files (content omitted for size): " + ", ".join(omitted)
            + "\nYou cannot see these files, so you may not change or delete them."
        )
    user += f"\n\nToday's mission: {MISSION}. Respond with the JSON object only."
    return system + "\n\n" + user


AUTH_FAILURE = re.compile(r"authentication failed|no authentication information|access denied by policy", re.I)
MODEL_UNAVAILABLE = re.compile(
    r"is not available|is not accessible via|requires enablement|disabled by your organization", re.I)


def call_model(model, prompt):
    """Ask one model for its answer through the Copilot CLI and return the text."""
    cmd = [COPILOT_BIN, "--model", model, *COPILOT_FLAGS]
    env = dict(os.environ, NO_COLOR="1", COPILOT_AUTO_UPDATE="false")
    with tempfile.TemporaryDirectory(prefix="copilot-silo-") as empty_dir:
        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=empty_dir,
                env=env,
                start_new_session=True,  # its own process group, so a timeout can stop all of it
            )
        except FileNotFoundError:
            sys.exit(f"GitHub Copilot CLI not found ({COPILOT_BIN!r}). Install it with: npm install -g @github/copilot")
        try:
            # The prompt goes over stdin: it is far too long for argv.
            stdout, stderr = proc.communicate(prompt, timeout=MODEL_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            raise ModelError(f"no answer within {MODEL_TIMEOUT_SECONDS}s") from None
        finally:
            if proc.poll() is None:  # timed out or interrupted: leave nothing running
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                proc.communicate()
    events = parse_events(stdout)
    # Before the session starts, errors are plain text on stderr; after, they are session.error events.
    errors = [describe_error(e) for e in events if e.get("type") == "session.error"]
    detail = "; ".join(errors) or stderr.strip() or stdout.strip()
    if errors or proc.returncode != 0:
        if AUTH_FAILURE.search(detail) or any(error.startswith("authentication") for error in errors):
            raise CopilotAuthError(detail)
        if MODEL_UNAVAILABLE.search(detail):
            raise ModelUnavailable(detail[:300])
        raise ModelError(f"copilot exited with status {proc.returncode}: {detail[:500]}")
    return extract_answer(events, model)


def parse_events(jsonl):
    """The Copilot CLI's JSONL output as a list of event objects; anything else is ignored."""
    events = []
    # Split on "\n" only: splitlines() would also break on U+2028 and friends, which JSON
    # serializers leave unescaped inside strings.
    for line in jsonl.split("\n"):
        try:
            event = json.loads(line)
        except (ValueError, RecursionError):
            continue
        if isinstance(event, dict):
            events.append(event)
    return events


def event_data(event):
    data = event.get("data")
    return data if isinstance(data, dict) else {}


def describe_error(event):
    data = event_data(event)
    parts = [str(data.get(key)) for key in ("errorType", "statusCode") if data.get(key)]
    return " ".join(parts) + ": " + str(data.get("message") or "unknown error")


def extract_answer(events, model):
    """Return the model's answer from the CLI's events, or raise if the run cannot be trusted."""
    for event in events:
        kind = str(event.get("type"))
        if kind.startswith("tool.") or event_data(event).get("toolRequests"):
            raise SiloBreach(f"the model was able to call a tool ({kind})")
    answered_by = {event_data(e).get("model") for e in events
                   if e.get("type") in ("assistant.message", "session.tools_updated")} - {None, ""}
    if answered_by - {model}:
        raise ModelError(f"answered by {', '.join(sorted(map(str, answered_by)))} instead of {model}")
    if sum(e.get("type") == "assistant.turn_start" for e in events) > 1:
        # The CLI continues a cut-off answer in a new turn, and only the last piece is reported.
        raise ModelError("the answer ran past the model's output limit")
    answers = [event_data(e).get("content") for e in events if e.get("type") == "assistant.message"]
    answers = [a for a in answers if isinstance(a, str) and a.strip()]
    if not answers:
        raise ModelError("empty response")
    return answers[-1]


def parse_response(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model response")
    plan = json.loads(text[start:end + 1])
    if not isinstance(plan, dict):
        raise ValueError("model response is not a JSON object")
    return plan


# Control characters that never belong in a web page. Finding one means the model's JSON escaping
# went wrong (a regex \b written with one backslash decodes to a backspace), so the content cannot
# be trusted. Answers that are not valid JSON are rejected outright rather than repaired: a model
# that slipped on one escape has probably slipped on others that cannot be detected.
STRAY_CONTROL_CHARACTER = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def validate_plan(plan, unseen=()):
    """Turn the model's plan into a list of (action, path, content) or raise.

    `unseen` names existing files whose content the model was not shown; it may not touch them.
    """
    files = plan.get("files") or []
    deletes = plan.get("delete") or []
    if not isinstance(files, list) or not isinstance(deletes, list):
        raise RejectedChange("'files' and 'delete' must be lists")
    if not files and not deletes:
        raise RejectedChange("model proposed no changes")
    if len(files) + len(deletes) > MAX_CHANGES:
        raise RejectedChange(f"too many changes (max {MAX_CHANGES})")
    ops = []
    for entry in files:
        if not isinstance(entry, dict) or not isinstance(entry.get("content"), str):
            raise RejectedChange(f"invalid file entry: {entry!r:.200}")
        target = safe_site_path(entry.get("path"))
        rel = target.relative_to(SITE_DIR).as_posix()
        content = entry["content"]
        if len(content.encode()) > MAX_FILE_BYTES:
            raise RejectedChange(f"file too large: {rel}")
        if STRAY_CONTROL_CHARACTER.search(content):
            raise RejectedChange(f"control character in the content of {rel} (broken JSON escaping?)")
        if rel in PROTECTED_FILES and not content.strip():
            raise RejectedChange(f"refusing to empty {rel}")
        if rel in unseen:
            raise RejectedChange(f"refusing to overwrite {rel}: its content was not shown to the model")
        if target.is_dir():
            raise RejectedChange(f"{rel} is a folder")
        ops.append(("write", target, content))
    written = {target for _, target, _ in ops}
    for target in written:
        for parent in target.parents:
            if parent == SITE_DIR:
                break
            if parent in written or parent.is_file():
                raise RejectedChange(f"{parent.relative_to(SITE_DIR).as_posix()} cannot be both a file and a folder")
    for raw in deletes:
        target = safe_site_path(raw)
        rel = target.relative_to(SITE_DIR).as_posix()
        if rel in PROTECTED_FILES:
            raise RejectedChange(f"refusing to delete {rel}")
        if rel in unseen:
            raise RejectedChange(f"refusing to delete {rel}: its content was not shown to the model")
        ops.append(("delete", target, None))
    return ops


def apply_ops(ops):
    for action, target, content in ops:
        rel = target.relative_to(SITE_DIR).as_posix()
        if action == "write":
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
            print(f"  wrote   site/{rel}")
        elif target.is_file():
            target.unlink()
            print(f"  deleted site/{rel}")


def set_output(name, value):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        delimiter = f"EOF_{uuid.uuid4().hex}"  # unguessable, so a value can never end itself early
        with open(out, "a") as fh:
            fh.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")


def model_pool():
    """The models a random pick may draw from: MODEL_POOL if set, else MODELS, minus small models."""
    configured = [m for m in re.split(r"[,\s]+", os.environ.get("MODEL_POOL") or "") if m]
    pool = []
    for model in configured or MODELS:
        if is_small_model(model):
            print(f"::warning::{one_line(model, 100)} is a small model and is never picked at random; ignoring it.")
        elif model not in pool:
            pool.append(model)
    return pool


def pick_candidates():
    """The models to try, in order: the requested one, or the whole pool in random order.

    Random selection only ever draws from model_pool(), so it can never land on a small model.
    A model named explicitly (the workflow's manual "model" input) is a person's choice, not a
    random pick, and is used as asked.
    """
    requested = (os.environ.get("MODEL") or "").strip()
    if requested:
        if is_small_model(requested):
            print(f"::warning::{one_line(requested, 100)} is a small model; using it because it was requested by name.")
        return [requested]
    pool = model_pool()
    if not pool:
        sys.exit("No model to pick from: the pool is empty once small models are excluded.")
    return random.sample(pool, k=len(pool))


def one_line(text, limit):
    return " ".join(str(text).split())[:limit]


def clean_summary(text):
    """The model's summary as one plain line that is safe in a commit message and in Markdown.

    Only letters, digits, spaces and plain punctuation survive. That drops "#" and "@" (GitHub acts
    on "fixes #1" and mentions in commit messages) as well as links, markup and control characters.
    """
    lines = str(text or "").strip().splitlines()
    first = re.sub(r"[^\w .,;:!?'\"()+%&=-]", "", lines[0] if lines else "")
    return " ".join(first.split())[:200] or MISSION


def main():
    if not SITE_DIR.is_dir():
        sys.exit(f"site directory not found: {SITE_DIR}")

    shown, omitted = split_for_prompt(read_site())
    prompt = build_prompt(shown, omitted)
    attempts = 0
    for model in pick_candidates():
        if attempts >= MAX_ATTEMPTS:
            break
        print(f"Mission: {MISSION}\nModel:   {model}", flush=True)
        try:
            answer = call_model(model, prompt)
        except ModelUnavailable as err:
            print(f"::notice::{model} is not available, trying another model: {one_line(err, 200)}")
            continue  # no model was asked, so this does not count as an attempt
        except CopilotAuthError as err:
            print(f"::error::GitHub Copilot authentication failed: {one_line(err, 300)}")
            sys.exit(AUTH_HELP)
        except SiloBreach as err:
            sys.exit(f"Stopping without applying anything: {err}. The Copilot CLI flags no longer disable every tool.")
        except ModelError as err:
            attempts += 1
            print(f"::warning::{model} failed: {one_line(err, 500)}")
            continue
        attempts += 1
        try:
            plan = parse_response(answer)
            ops = validate_plan(plan, unseen=omitted)
        except (ValueError, RecursionError, RejectedChange) as err:
            print(f"::warning::{model} failed: {one_line(err, 500)}")
            continue
        try:
            apply_ops(ops)
        except OSError as err:
            # The site may be half written, so stop here: the workflow only commits after success.
            sys.exit(f"Could not apply the change from {model}: {one_line(err, 300)}")
        summary = clean_summary(plan.get("summary"))
        print(f"Summary: {summary}")
        set_output("model", model)
        set_output("summary", summary)
        return
    sys.exit("No model produced a usable change today.")


if __name__ == "__main__":
    main()
