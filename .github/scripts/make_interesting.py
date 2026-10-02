#!/usr/bin/env python3
"""Make the website more interesting.

Picks a random model from GitHub Models, shows it the current contents of the
/site folder, and asks it to make the website more interesting.

The model is silo'd: it has no tools and no shell access. It can only return a
JSON document describing files to write or delete, and this script refuses any
change whose path would land outside of the /site folder (or that touches a
disallowed file type). The calling workflow additionally verifies that nothing
outside /site was modified before committing.
"""

import json
import os
import random
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath

MISSION = "make the website more interesting"

ENDPOINT = "https://models.github.ai/inference/chat/completions"

# Chat models available via GitHub Models. One is picked at random each run.
MODELS = [
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "meta/Llama-4-Maverick-17B-128E-Instruct-FP8",
    "meta/Llama-3.3-70B-Instruct",
    "mistral-ai/mistral-medium-2505",
    "mistral-ai/Codestral-2501",
    "deepseek/DeepSeek-V3-0324",
    "microsoft/Phi-4",
    "cohere/cohere-command-a",
    "xai/grok-3-mini",
]

ALLOWED_EXTENSIONS = {
    ".html", ".css", ".js", ".mjs", ".svg", ".txt", ".json", ".md", ".xml",
    ".webmanifest",
}
PROTECTED_FILES = {"index.html", "error.html"}  # may be rewritten, never deleted
MAX_FILE_BYTES = 200_000
MAX_CHANGES = 20
PROMPT_BUDGET_CHARS = 24_000  # keep within GitHub Models input token limits
MAX_ATTEMPTS = 3

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = Path(os.environ.get("SITE_DIR", REPO_ROOT / "site")).resolve()


class RejectedChange(Exception):
    pass


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


def build_messages(files):
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
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def call_model(model, messages, token):
    body = json.dumps({"model": model, "messages": messages}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.load(resp)
    return data["choices"][0]["message"]["content"]


def parse_response(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model response")
    plan = json.loads(text[start:end + 1])
    if not isinstance(plan, dict):
        raise ValueError("model response is not a JSON object")
    return plan


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
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("GITHUB_TOKEN is required")
    if not SITE_DIR.is_dir():
        sys.exit(f"site directory not found: {SITE_DIR}")

    requested = (os.environ.get("MODEL") or "").strip()
    candidates = [requested] if requested else random.sample(MODELS, k=min(MAX_ATTEMPTS, len(MODELS)))
    messages = build_messages(read_site())

    for model in candidates:
        print(f"Mission: {MISSION}\nModel:   {model}")
        try:
            plan = parse_response(call_model(model, messages, token))
            ops = validate_plan(plan)
        except urllib.error.HTTPError as err:
            print(f"::warning::{model} failed: HTTP {err.code} {err.read()[:500]!r}")
            continue
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError, RejectedChange) as err:
            print(f"::warning::{model} failed: {err}")
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
