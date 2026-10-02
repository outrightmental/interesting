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
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath

MISSION = "make the website more interesting"

COPILOT_BIN = os.environ.get("COPILOT_BIN", "copilot")

# Models available through GitHub Copilot CLI (`--model`). One is picked at
# random each run. A model the account cannot use is skipped at run time.
MODELS = [
    "claude-fable-5.1",
    "claude-fable-5",
    "claude-opus-5.5",
    "claude-opus-5",
    "claude-opus-4.8",
    "claude-opus-4.7",
    "claude-sonnet-5.5",
    "claude-sonnet-5",
    "claude-sonnet-4.6",
    "claude-haiku-4.5",
    "gpt-6.1-sol",
    "gpt-6-sol",
    "gpt-6-luna",
    "gpt-6-astra",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex",
    "gpt-5-mini",
    "mai-code-1.1-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "grok-4.6",
    "grok-4.5",
    "kimi-k3",
    "kimi-k2.7-code",
]

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
MAX_FILE_BYTES = 200_000
MAX_CHANGES = 20
PROMPT_BUDGET_CHARS = 80_000  # keep the prompt comfortably inside every model's context window
MAX_ATTEMPTS = 3

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = Path(os.environ.get("SITE_DIR", REPO_ROOT / "site")).resolve()


class RejectedChange(Exception):
    pass


class ModelError(Exception):
    """This model could not produce an answer; another model may still work."""


class CopilotAuthError(Exception):
    """Copilot rejected the credentials or policy; no model will work."""


def safe_site_path(raw):
    """Return the absolute path for a site-relative path, or raise RejectedChange."""
    if not isinstance(raw, str) or not raw.strip():
        raise RejectedChange(f"invalid path: {raw!r}")
    if "\\" in raw or "\x00" in raw or raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        raise RejectedChange(f"path must be relative to /site: {raw!r}")
    rel = PurePosixPath(raw)
    if rel.parts and rel.parts[0] == "site":
        rel = PurePosixPath(*rel.parts[1:])  # tolerate "site/index.html"
    if not rel.parts or any(p in ("", ".", "..") or p.startswith(".") for p in rel.parts):
        raise RejectedChange(f"path not allowed: {raw!r}")
    if rel.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise RejectedChange(f"file type not allowed: {raw!r}")
    target = (SITE_DIR / rel).resolve()
    if SITE_DIR not in target.parents:
        raise RejectedChange(f"path escapes /site: {raw!r}")
    return target


def read_site():
    files = []
    for path in sorted(SITE_DIR.rglob("*")):
        if path.is_file() and not path.is_symlink() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append((path.relative_to(SITE_DIR).as_posix(), path.read_text(errors="replace")))
    return files


def build_prompt(files):
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
        "Use relative links between pages so the site works under a sub-path.\n"
        "- index.html and error.html must always exist and remain valid.\n"
        "- Keep each file small; return the COMPLETE new content of every file you change.\n"
        f"- At most {MAX_CHANGES} files per day.\n\n"
        "Respond with ONLY a JSON object, no prose and no markdown fences, shaped as:\n"
        '{"summary": "one sentence describing today\'s change", '
        '"files": [{"path": "index.html", "content": "<full file content>"}], '
        '"delete": ["old-page.html"]}'
    )
    parts, used, omitted = [], 0, []
    for rel, content in files:
        if used + len(content) > PROMPT_BUDGET_CHARS:
            omitted.append(rel)
            continue
        used += len(content)
        parts.append(f"=== {rel} ===\n{content}")
    user = "Current contents of the website:\n\n" + "\n\n".join(parts)
    if omitted:
        user += "\n\nOther existing files (content omitted for size): " + ", ".join(omitted)
    user += f"\n\nToday's mission: {MISSION}. Respond with the JSON object only."
    return system + "\n\n" + user


def call_model(model, prompt):
    """Ask one model for its answer through the Copilot CLI and return the text."""
    cmd = [COPILOT_BIN, "--model", model, *COPILOT_FLAGS]
    env = dict(os.environ, NO_COLOR="1")
    try:
        with tempfile.TemporaryDirectory(prefix="copilot-silo-") as empty_dir:
            proc = subprocess.run(
                cmd,
                input=prompt,  # the prompt goes over stdin: it is far too long for argv
                capture_output=True,
                text=True,
                cwd=empty_dir,
                env=env,
                timeout=MODEL_TIMEOUT_SECONDS,
            )
    except FileNotFoundError:
        sys.exit(f"GitHub Copilot CLI not found ({COPILOT_BIN!r}). Install it with: npm install -g @github/copilot")
    except subprocess.TimeoutExpired:
        raise ModelError(f"no answer within {MODEL_TIMEOUT_SECONDS}s") from None
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip()
        if re.search(r"authentication failed|no authentication information|access denied by policy", detail, re.I):
            raise CopilotAuthError(detail)
        raise ModelError(f"copilot exited with status {proc.returncode}: {detail[:500]}")
    answer = extract_answer(proc.stdout)
    if not answer:
        raise ModelError("empty response")
    return answer


def extract_answer(jsonl):
    """Return the model's last non-empty message from the Copilot CLI's JSONL event stream."""
    answer = ""
    for line in jsonl.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if not isinstance(event, dict) or event.get("type") != "assistant.message":
            continue
        data = event.get("data")
        content = data.get("content") if isinstance(data, dict) else None
        if isinstance(content, str) and content.strip():
            answer = content
    return answer


def parse_response(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model response")
    plan = loads_lenient(text[start:end + 1])
    if not isinstance(plan, dict):
        raise ValueError("model response is not a JSON object")
    return plan


VALID_JSON_ESCAPES = set('"\\/bfnrtu')


def loads_lenient(text):
    r"""json.loads that forgives the two slips models make when quoting code inside JSON strings.

    Raw newlines and tabs inside a string are accepted, and a backslash that does not start a
    valid JSON escape (the \' or \d of embedded JavaScript) is taken as a literal backslash.
    """
    try:
        return json.loads(text, strict=False)
    except ValueError:
        repaired = re.sub(
            r"\\(.)",
            lambda m: m.group(0) if m.group(1) in VALID_JSON_ESCAPES else "\\" + m.group(0),
            text,
            flags=re.S,
        )
        return json.loads(repaired, strict=False)


def validate_plan(plan):
    """Turn the model's plan into a list of (action, path, content) or raise."""
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
        content = entry["content"]
        if len(content.encode()) > MAX_FILE_BYTES:
            raise RejectedChange(f"file too large: {entry.get('path')}")
        if target.relative_to(SITE_DIR).as_posix() in PROTECTED_FILES and not content.strip():
            raise RejectedChange(f"refusing to empty {entry.get('path')}")
        ops.append(("write", target, content))
    for raw in deletes:
        target = safe_site_path(raw)
        if target.relative_to(SITE_DIR).as_posix() in PROTECTED_FILES:
            raise RejectedChange(f"refusing to delete {raw}")
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
        with open(out, "a") as fh:
            fh.write(f"{name}<<__EOF__\n{value}\n__EOF__\n")


def main():
    if not SITE_DIR.is_dir():
        sys.exit(f"site directory not found: {SITE_DIR}")

    requested = (os.environ.get("MODEL") or "").strip()
    candidates = [requested] if requested else random.sample(MODELS, k=min(MAX_ATTEMPTS, len(MODELS)))
    prompt = build_prompt(read_site())

    for model in candidates:
        print(f"Mission: {MISSION}\nModel:   {model}", flush=True)
        try:
            plan = parse_response(call_model(model, prompt))
            ops = validate_plan(plan)
        except CopilotAuthError as err:
            print(f"::error::GitHub Copilot authentication failed: {' '.join(str(err).split())[:300]}")
            sys.exit(AUTH_HELP)
        except (ModelError, ValueError, RejectedChange) as err:
            print(f"::warning::{model} failed: {' '.join(str(err).split())[:500]}")
            continue
        apply_ops(ops)
        summary_text = str(plan.get("summary") or "").strip()
        summary = summary_text.splitlines()[0][:200] if summary_text else MISSION
        print(f"Summary: {summary}")
        set_output("model", model)
        set_output("summary", summary)
        return
    sys.exit("No model produced a usable change today.")


if __name__ == "__main__":
    main()
