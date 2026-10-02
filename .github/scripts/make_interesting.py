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

# The models a random pick may draw from: only large, flagship models, as of 2026-10-02. These are
# the flagships GitHub Copilot CLI offers through `--model`, which today come from Anthropic,
# OpenAI and Moonshot. Small and mid-tier models are deliberately absent, and is_small_model()
# below refuses the ones it can recognise even if one is added.
# Copilot retires models often: an id the account can no longer use is skipped at run time
# without costing an attempt, so a stale entry here is harmless. The list can be replaced without
# a code change by setting the MODEL_POOL repository variable (comma-separated ids).
# Not listed: the Gemini models (Copilot offers only the Flash tier, which is refused as small)
# and the Grok models (Copilot CLI 1.0.91 cannot reach them: "not accessible via the
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

# Tier names that mark a model as a small, cheap, speed-tuned or mid-tier sibling of a flagship. A
# model whose id contains one of these words is never picked at random, whatever list it came
# from. The rule is deliberately general, so it covers the equivalents of Haiku and Sonnet at other
# providers, including models that do not exist yet, as long as the id names its tier.
SMALL_MODEL_MARKERS = {
    "haiku", "sonnet",  # Anthropic: small and mid tier (the flagships are Opus and Fable)
    "mini", "nano", "luna", "terra",  # OpenAI: small tiers, and the mid tier of the Sol/Terra/Luna line
    "flash", "lite", "gemma",  # Google: small tiers
    "fast",  # xAI's small tier, and speed-tuned variants generally (claude-opus-4.8-fast)
    "small", "medium", "ministral",  # Mistral: everything below Large
    "micro",  # Amazon Nova
    "phi",  # Microsoft's small-model family
    "tiny", "light", "lightweight", "instant",  # generic names for a lesser tier
}

# Models that are not flagships but whose id is only a version number, so no word gives them away.
# A name rule cannot recognise these: they have to be listed.
OTHER_NON_FLAGSHIP_MODELS = {
    "gpt-5.4",  # mid tier of its generation, priced alongside Sonnet
    "gpt-4.1",  # retired general-purpose model that Copilot still lists
    "kimi-k2.7-code",  # Moonshot's lighter coding model (the flagship is kimi-k3)
}


def is_small_model(model):
    """True if the model is known to be a small, cheap, speed-tuned or mid-tier model, not a flagship.

    The id is split into words on anything that is not a letter or digit and compared with
    SMALL_MODEL_MARKERS, so "gpt-5.4-mini" and "Claude Haiku 4.5" are small but "gemini-3-pro"
    (which merely contains the letters "mini") is not. Ids in OTHER_NON_FLAGSHIP_MODELS are refused
    by name. An unknown id that is only a version number cannot be judged and counts as large.
    """
    name = str(model).strip().lower()
    if name.rsplit("/", 1)[-1] in OTHER_NON_FLAGSHIP_MODELS:  # tolerate a "provider/" prefix
        return True
    return any(word in SMALL_MODEL_MARKERS for word in re.split(r"[^a-z0-9]+", name))


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
    "  1. Personal plan: add a repository secret named COPILOT_GITHUB_TOKEN holding a fine-grained\n"
    "     personal access token (resource owner: your own account) that has the account permission\n"
    "     \"Copilot Requests\". Usage is billed to that user's Copilot plan, and every model that\n"
    "     plan includes can be picked.\n"
    "  2. Organization: as an owner of the organization that owns this repository, open Settings >\n"
    "     Copilot > Policies, enable \"Copilot CLI\" and select \"Allow use of Copilot CLI billed to\n"
    "     the organization\". The change can take a quarter of an hour to apply. Usage is billed to\n"
    "     the organization, and only the models its Copilot plan and policies offer can be picked."
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


# One path segment: lowercase letters, digits, ".", "_" and "-", starting and ending with a letter
# or digit. Nothing else is ever needed for a web path, and it rules out "..", hidden files,
# control characters (a newline in a path could smuggle a workflow command into the log) and names
# that collide on case-insensitive file systems.
PATH_SEGMENT = re.compile(r"[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?")
# Names a Windows checkout refuses, with or without an extension: one would break every clone there.
WINDOWS_RESERVED = re.compile(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?")


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
    if any(WINDOWS_RESERVED.fullmatch(p) for p in rel.parts):
        raise RejectedChange(f"path uses a name reserved on Windows: {raw!r:.200}")
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
    names of the rest.

    index.html and error.html are considered first, so they are the last to be left out. The other
    files are considered in a different random order each run: a file the model is not shown
    cannot be changed, and no file should stay unchangeable run after run.
    """
    def prompt_order(item):
        return (item[0] != "index.html", item[0] not in PROTECTED_FILES, item[0])

    first = sorted((item for item in files if item[0] in PROTECTED_FILES), key=prompt_order)
    rest = [item for item in files if item[0] not in PROTECTED_FILES]
    random.shuffle(rest)
    shown, omitted, used = [], [], 0
    for rel, content in first + rest:
        if used + len(content) > PROMPT_BUDGET_CHARS:
            omitted.append(rel)
            continue
        used += len(content)
        shown.append((rel, content))
    return sorted(shown, key=prompt_order), sorted(omitted)


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
        '"delete": ["old-page.html"]}\n'
        "It must be valid JSON, or it is discarded. Inside each \"content\" string write every "
        "line break as \\n, every double quote as \\\" and every backslash as \\\\ (so a "
        "JavaScript '\\n' or \\d becomes '\\\\n' or \\\\d)."
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
# What the CLI says when the account cannot use a model: retired or misspelled, not reachable by
# this CLI version, or listed but not enabled by the plan's or the organization's model policy.
MODEL_UNAVAILABLE = re.compile(
    r"is not available|is not accessible via|in interactive mode to enable this model"
    r"|requires enablement|disabled by your organization", re.I)


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
        timed_out = False
        try:
            # The prompt goes over stdin: it is far too long for argv.
            stdout, stderr = proc.communicate(prompt, timeout=MODEL_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            timed_out = True
            stdout, stderr = stop_process_group(proc)  # keep what it printed: it is checked below
        except BaseException:
            stop_process_group(proc)  # interrupted: leave nothing running
            raise
    events = parse_events(stdout)
    # First, on every path: a run in which the model used a tool must stop everything, whether the
    # CLI then succeeded, failed or hung.
    refuse_tool_use(events)
    if timed_out:
        raise ModelError(f"no answer within {MODEL_TIMEOUT_SECONDS}s")
    # Before the session starts, errors are plain text on stderr; after, they are session.error
    # events. Only that text is classified: stdout also carries the model's own words, and a page
    # that says "this page is not available" is not a Copilot error.
    errors = [describe_error(e) for e in events if e.get("type") == "session.error"]
    problem = "; ".join(errors) or stderr.strip()
    if errors or proc.returncode != 0:
        if AUTH_FAILURE.search(problem) or any(error.startswith("authentication") for error in errors):
            raise CopilotAuthError(problem)
        if MODEL_UNAVAILABLE.search(problem):
            raise ModelUnavailable(problem[:300])
        raise ModelError(f"copilot exited with status {proc.returncode}: {(problem or stdout.strip())[:500]}")
    return extract_answer(events, model)


def stop_process_group(proc):
    """Kill the CLI and everything it started, and return the (stdout, stderr) captured so far."""
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    return proc.communicate()


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


def refuse_tool_use(events):
    """Raise SiloBreach if the CLI's events show the model calling, or asking to call, any tool."""
    for event in events:
        kind = str(event.get("type"))
        if kind.startswith("tool.") or event_data(event).get("toolRequests"):
            raise SiloBreach(f"the model was able to call a tool ({kind})")


def extract_answer(events, model):
    """Return the model's answer from the CLI's events, or raise if the run cannot be trusted."""
    refuse_tool_use(events)
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
    """The models a random pick may draw from: MODEL_POOL if set, else MODELS, minus the models
    that is_small_model() recognises as small, mid-tier or speed-tuned."""
    configured = [m for m in re.split(r"[,\s]+", os.environ.get("MODEL_POOL") or "") if m]
    pool = []
    for model in configured or MODELS:
        if is_small_model(model):
            print(f"::warning::{one_line(model, 100)} is not a flagship model, so it is never picked at random; ignoring it.")
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
            print(f"::warning::{one_line(requested, 100)} is not a flagship model; using it because it was requested by name.")
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
    "GH-1", GitHub's other way to write "#1", is taken apart as well.
    """
    lines = str(text or "").strip().splitlines()
    first = re.sub(r"[^\w .,;:!?'\"()+%&=-]", "", lines[0] if lines else "")
    first = re.sub(r"(?i)(gh)-(?=\d)", r"\1 ", first)
    return " ".join(first.split())[:200] or MISSION


def main():
    if not SITE_DIR.is_dir():
        sys.exit(f"site directory not found: {SITE_DIR}")

    shown, omitted = split_for_prompt(read_site())
    prompt = build_prompt(shown, omitted)
    candidates = pick_candidates()
    attempts, unavailable = 0, []

    def report_unavailable():
        # Worth saying out loud: when most of the pool is off limits, the pick is hardly random.
        if unavailable:
            print(
                f"::notice::{len(unavailable)} of the {len(candidates)} models to pick from are not available to "
                f"this Copilot account ({one_line(', '.join(unavailable), 300)}). See Setup in the README."
            )

    queue, answering = list(candidates), []
    while queue and attempts < MAX_ATTEMPTS:
        model = queue.pop(0)
        print(f"Mission: {MISSION}\nModel:   {model}", flush=True)
        attempts += 1  # counted up front, so every path below that asks again is bounded
        try:
            plan = parse_response(call_model(model, prompt))
            ops = validate_plan(plan, unseen=omitted)
        except ModelUnavailable as err:
            attempts -= 1  # no model was asked, so this does not count as an attempt
            print(f"{model} is not available, trying another model: {one_line(err, 200)}")
            unavailable.append(model)
        except CopilotAuthError as err:
            print(f"::error::GitHub Copilot authentication failed: {one_line(err, 300)}")
            sys.exit(AUTH_HELP)
        except SiloBreach as err:
            sys.exit(f"Stopping without applying anything: {err}. The Copilot CLI flags no longer disable every tool.")
        except (ModelError, ValueError, RecursionError, RejectedChange) as err:
            answering.append(model)
            print(f"::warning::{model} failed: {one_line(err, 500)}")
        else:
            try:
                apply_ops(ops)
            except OSError as err:
                # The site may be half written, so stop here: the workflow only commits after success.
                sys.exit(f"Could not apply the change from {model}: {one_line(err, 300)}")
            summary = clean_summary(plan.get("summary"))
            print(f"Summary: {summary}")
            set_output("model", model)
            set_output("summary", summary)
            report_unavailable()
            return
        if not queue:
            # Every model has had a turn. With attempts left, ask again the ones that can answer:
            # a model does not give the same answer twice.
            queue, answering = answering, []
    report_unavailable()
    sys.exit("No model produced a usable change today.")


if __name__ == "__main__":
    main()
