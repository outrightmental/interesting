#!/usr/bin/env python3
"""Make the website more interesting.

Picks a random model from GitHub Copilot, shows it the current contents of the
/site folder, and asks it to make the website more interesting.

Every run starts the same way, unconditionally: the model is told to envision the
site as one experience -- one navigation, one visual language, one through-line --
before it chooses anything. WHOLE names what that experience has to be, and
re-federating the site aggressively is then the normal work of a run: consolidate
repeated markup, styles and behaviour into the shared files, unify navigation and
visual language across every page, merge or retire pages that overlap. Adding
something new is the exception rather than the default, and whatever a run adds
arrives federated in the same run. So the site is made more interesting by
becoming one piece and not only by growing.

"Interesting" is not left to a model's taste: INTERESTING names the measure, and
it is user engagement time. The site is more interesting when a person stays
longer and wants to keep going. LEGIBLE names the test a stranger puts the site
to -- one name per page, one way to do each thing, content before chrome, never
a dead end -- because confusion spends engagement time as surely as boredom.

Nine axioms stand over every run, each stated in the prompt and held to in code:

  - All of the content stays reachable from the root, both by following links
    from index.html and through sitemap.xml. check_reachability() refuses a plan
    that would orphan a page.
  - Every page loads js/analytics.js, the one line that brings the site its
    cookie consent banner and, once a visitor accepts, its Google Analytics tag.
    check_analytics() refuses a plan that would leave a page without it, and the
    three files behind it are never shown to a model and never written or
    deleted by one.
  - Every page is responsive and accessible, to WCAG 2.2 level AA.
    check_accessibility() refuses a plan that would make a page fail the part of
    that which markup alone can settle.
  - Every page loads js/state.js, the one line that brings the site its single
    local-state document, the shared accessor every page reads and writes
    through, and the meta menu a visitor exports, imports and clears it with.
    check_state() refuses a plan that would leave a page without it or have a
    page touch localStorage itself, and the file behind it is fixed like the
    analytics ones.
  - No page ties the site to an update frequency. The site iterates continuously
    and publishes no nightly, daily or hourly edition, so check_cadence()
    refuses a plan that puts a rhythm in front of a visitor -- or that defers
    one to another day, which spends the engagement time the mission is measured
    in. Night-sky atmosphere ("midnight rain") is untouched.
  - The site asks before it offers. It makes an effort to ascertain a visitor's
    mood or mental orientation before putting particular content in front of
    them, it does that by querying rather than by asking them to self-report,
    and it never queries the same way twice. check_mood() refuses a plan that
    takes the mood flow off a page, that lets the library of query mechanisms
    fall below MIN_MOOD_PROBES, or that asks a visitor to report their own mood.
  - Every page loads js/participate.js, the one line that brings the site the
    prominent button on the bottom edge of every page that sends a visitor to a
    pre-shaped new issue on this repository. check_participate() refuses a plan
    that would leave a page without it, and the file behind it is fixed like the
    analytics and state ones: a visitor's way of saying what this site should
    become is not a run's to reword, move or drop.
  - Caution before a destructive action is a law of the site rather than a page's
    own choice. Any control that throws a visitor's saved state away reads as a
    warning button, and every press of one opens the one shared modal that names
    what is about to go -- written once in js/site.js and _sass/_controls.scss.
    check_destructive() refuses a plan that takes that component away, that
    leaves a control whose own words say it discards saved state without the
    warning treatment, or that writes a confirmation of its own with
    window.confirm.
  - Every world is a piece a visitor can finish. A world's page is not fixed
    content but a stage (js/stage.js) on which its module makes a small,
    randomly configured piece from a seed -- a few knobs, a clear end -- which
    vanishes when finished and is followed by the next card from the feed.
    check_completion() plays every listed world's piece to its end without a
    browser (.github/scripts/piece_harness.mjs) and refuses a plan that leaves a
    world without a module, without a piece, or with one that cannot be finished.

The files behind the analytics, state and participation axioms (FIXED_FILES) are
never shown to a model and are refused outright as a write or a delete.

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
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath

# The mission every run serves. It names the holistic aim issue #16 asks for -- the site gets more
# interesting by becoming a coherent whole, not only by growing -- while keeping "make the website
# more interesting" as its opening so the prompt, the console line and clean_summary's fallback all
# still read naturally. (The workflow name and commit-message prefix are separate strings in
# make-interesting.yml and are not affected by this constant.)
#
# Issue #36 added the one word "single". The aim was already holistic; what it did not say is that
# the whole is one thing rather than a well-behaved collection, which is the distinction WHOLE below
# turns into the posture of a run.
MISSION = "make the website more interesting as a single coherent whole"

# What the site has to add up to (issue #36). MISSION names the aim and INTERESTING below names the
# measure; this names the shape, because "more interesting" and "engagement time" are both satisfied
# by a pile of individually good pages, and a pile is not what this site is for.
#
# Like INTERESTING, it is a standard stated to the model rather than one held to in code: no check
# can settle whether a site reads as one experience, in the way check_reachability() can settle
# whether a page is orphaned. So it is said where it can do some good -- before a run chooses what
# to do, and again in the line it reads last -- and it is said insistently, because the failure it
# guards against is the comfortable one of adding another page and calling the hour spent.
WHOLE = "a single functioning excellent experience"

# What "interesting" means here (issue #32). MISSION names the aim; this names the measure, so a run
# is held to a standard instead of its own taste. Interesting is user engagement time: a visitor who
# stays, keeps going and wants one more go is the whole point, and a change that only looks tidy has
# not earned the run.
#
# It is a standard stated to the model, not a number read back from analytics. The site does measure
# engagement -- that is what the GA4 tag in js/analytics.js is for -- but nothing feeds it back into
# a run, and nothing could usefully: a model cannot be shown the engagement of a change it has not
# made yet, and the feedback loop for a change deployed within the hour is noise. Closing that loop
# is its own piece of work; what this constant does is make the aim of a run unambiguous.
INTERESTING = ("how long a person stays engaged -- how much they want to keep going, and how "
               "intrigued, astonished or entertained they are while they do")

# What the site has to read like (issue #46 and the usability work of 2026-10-05). MISSION names the
# aim, INTERESTING the measure and WHOLE the shape; this names the test a stranger puts it to.
# Confusion spends engagement time as surely as boredom does, and a site rewritten continuously by a
# model told to engage and to federate drifts, left to itself, towards more chrome: by the time
# this was written every sky page ended in eight stacked "relay" panels, three trail gadgets and a
# world index, nine of them ways of saying where to go next, and the home page explained none of
# its own words.
#
# Like WHOLE and INTERESTING it is a standard stated to the model rather than one held to in code:
# no check can settle whether a page reads clearly. It is stated before a run chooses what to do
# and again in the line it reads last, with the six holds a run can check its own change against
# (see LEGIBLE TO A STRANGER in build_prompt).
LEGIBLE = ("legible to a stranger -- a first-time visitor on a phone can tell what the site is, what "
           "any page is for, what to do on it and where to go next, without being told twice")

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
    "     the organization, and only the models its Copilot plan and policies offer can be picked.\n"
    "If a COPILOT_GITHUB_TOKEN secret already exists, it is used instead of the workflow's own token:\n"
    "renew it (check its expiry and its \"Copilot Requests\" permission), or delete it to use route 2."
)

ALLOWED_EXTENSIONS = {
    ".html", ".css", ".js", ".mjs", ".svg", ".txt", ".json", ".md", ".xml",
    ".webmanifest",
    # The build pipeline's own source types (issue #25). /site is no longer published as it stands:
    # build.mjs renders the templates and compiles the Sass into the artifact that is. The model
    # writes source here like anything else, so it has the same reach over the layout and the
    # shared styles as it has over a page.
    ".njk", ".scss",
}
# Where the build's shared files live inside /site, named here only so the prompt can point at
# them. They are Eleventy's conventions and are set in eleventy.config.mjs; nothing below depends
# on the names, because the build itself decides what is a page (see build_site).
INCLUDES_DIR = "_includes"
SASS_DIR = "_sass"

# The one line every page carries for the mood axiom (issue #30), and the file it brings. The
# whole flow lives in that one file: the orientations, the library of query mechanisms, the clock
# and time-zone signals and the partly-remembered drift. The persona card every page shows the
# reading on is js/persona.js, ordinary site source.
MOOD_SCRIPT = "js/threshold.js"
MOOD_TAG = f"<script src='{MOOD_SCRIPT}' defer></script>"

# May be rewritten, never deleted, and shown to the model first so it can always be rewritten.
# sitemap.xml is one of them because the reachability axiom below leans on it, and MOOD_SCRIPT
# because the mood axiom does: every page of the site loads it, so a run that deleted it would
# leave a dangling script tag on every page and no query for anyone arriving. Unlike FIXED_FILES
# it is always shown and always writable -- inventing another query mechanism in it is the single
# most interesting change a run can make.
PROTECTED_FILES = {"index.html", "error.html", "sitemap.xml", MOOD_SCRIPT}
# The one line every page carries, and the files it pulls in (issue #24). js/analytics.js brings the
# site both its cookie consent banner and -- only once a visitor accepts -- its Google Analytics
# tag, so a single line per page carries the whole of it and a single check can hold it in place.
ANALYTICS_SCRIPT = "js/analytics.js"
ANALYTICS_TAG = f"<script src='{ANALYTICS_SCRIPT}' defer></script>"
# Those files are the site's measurement, privacy, local-state and participation machinery rather
# than its content, so they are kept out of every run's reach: never shown to a model (see
# split_for_prompt, which hands them to validate_plan as unseen) and refused outright as a write or
# a delete. Two of them are a vendored release of orestbida/cookieconsent, which no model should be
# rewriting from memory in any case.
ANALYTICS_FILES = {ANALYTICS_SCRIPT, "js/cookieconsent.umd.js", "css/cookieconsent.css"}
# The other line every page carries, and the one file behind it (issue #31). js/state.js holds the
# whole of the site's local state in one JSON document, the shared accessor every page reads and
# writes through, and the small meta menu that exports, imports and clears that document. It is
# fixed for the same reason the analytics files are, and for one more: a visitor's own way to take
# their state out of this site has to be the one thing on it an hourly rewrite cannot touch.
STATE_SCRIPT = "js/state.js"
# Not deferred, unlike the analytics line: a page's own <script> runs while the body is parsed,
# which is before any deferred script, so the store has to be there already.
STATE_TAG = f"<script src='{STATE_SCRIPT}'></script>"
STATE_FILES = {STATE_SCRIPT}
# The line every page carries for the participation axiom (issue #43), and the one file behind it.
# js/participate.js draws the third and most prominent of the three affordances pinned to the
# bottom edge of every page -- "cookies" bottom-left, "steer the site" bottom-centre, "state"
# bottom-right -- and it is the only one that answers to the person reading the site rather than to
# the model writing it: one press opens a pre-shaped new issue on this repository, with the issue
# form already chosen and the page they were on already filled in.
#
# Fixed for the same reason the state file is, only more so. Every other word on this site is a
# run's to rewrite, which is exactly why the way to say something about it cannot be: a run that
# could reword the invitation, move it somewhere quieter or drop it altogether could close the one
# door that leads back to a person.
PARTICIPATE_SCRIPT = "js/participate.js"
PARTICIPATE_TAG = f"<script src='{PARTICIPATE_SCRIPT}' defer></script>"
PARTICIPATE_FILES = {PARTICIPATE_SCRIPT}
FIXED_FILES = ANALYTICS_FILES | STATE_FILES | PARTICIPATE_FILES
# How many files one run may touch. Roomy enough that a run which federates the site can rewrite
# every page of it and add the shared files those pages link to, which is what the whole-site
# review in build_prompt asks for; small enough that a runaway answer is still refused. A page is
# two files now that it has a template and a stylesheet, and the site grew a world per orientation
# when the mood axiom landed (issue #30), so this is bigger than it was.
MAX_CHANGES = 72
MAX_FILE_BYTES = 50_000
# How much of the site a prompt carries; comfortably inside every flagship model's context window.
# Generous on purpose: every run is asked to weigh the site as a whole and may choose to federate
# across all of it, and a file that is not shown cannot be changed. While the site fits in here it
# is shown whole and nothing is off limits. Once it outgrows this, the budget still always has room
# for index.html, error.html and any one other file, and which file that is rotates, so every file
# gets its turn (see split_for_prompt).
PROMPT_BUDGET_CHARS = 12 * MAX_FILE_BYTES
MAX_ATTEMPTS = 3

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_DIR = Path(os.environ.get("SITE_DIR", REPO_ROOT / "site")).resolve()

# The build that turns /site into the artifact that gets published (issue #25). It is run here too,
# so the reachability axiom below is checked against what a visitor would actually be served.
BUILD_SCRIPT = REPO_ROOT / "build.mjs"
NODE_BIN = os.environ.get("NODE_BIN", "node")
BUILD_TIMEOUT_SECONDS = 180


class RejectedChange(Exception):
    pass


class BuildError(Exception):
    """This site does not build, so there is nothing to check and nothing to publish."""


class BuildToolchainError(Exception):
    """The build cannot be run at all. Not the model's fault, so no answer can get past it."""


class ModelError(Exception):
    """This model could not produce an answer; another model may still work."""


class ModelUnavailable(ModelError):
    """Copilot does not offer this model to the account (retired, disabled or misspelled)."""


class CopilotAuthError(Exception):
    """Copilot rejected the credentials or policy; no model will work."""


class SiloBreach(Exception):
    """The model was able to use a tool. Nothing it returned may be trusted or applied."""


# One path segment: lowercase letters, digits, ".", "_" and "-", starting with a letter, a digit or
# "_" and ending with a letter or digit. Nothing else is ever needed for a web path or for the
# build's own source, and it rules out "..", hidden files, control characters (a newline in a path
# could smuggle a workflow command into the log) and names that collide on case-insensitive file
# systems. A leading "_" is allowed because that is how both halves of the build mark something
# that is not a page: "_includes" and "_sass" for the shared files, "_tokens.scss" for a Sass
# partial that is only ever @use'd.
PATH_SEGMENT = re.compile(r"[a-z0-9_](?:[a-z0-9._-]{0,98}[a-z0-9])?")
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


def require_build_toolchain():
    """Stop the run if the build cannot be run at all.

    Every answer is checked by building it, so a run without the toolchain could only ever waste a
    model call and then refuse the answer it paid for. Said here, before any model is asked.
    """
    if not BUILD_SCRIPT.is_file():
        sys.exit(f"The build script is missing ({BUILD_SCRIPT}), so no answer could be checked.")
    if not (REPO_ROOT / "node_modules").is_dir():
        sys.exit(f"The build's packages are not installed: run `npm ci` in {REPO_ROOT}.")
    if shutil.which(NODE_BIN) is None:
        sys.exit(f"The build needs Node, which was not found ({NODE_BIN!r}).")


def build_site(files):
    """The site mapping `files` as the build makes it: {path: content} of the generated artifact.

    /site is source now, not the published site (issue #25): build.mjs renders its templates and
    compiles its Sass into a folder, and that folder is what gets deployed. The reachability axiom
    is about what a visitor can reach, and a visitor only ever sees that folder -- a layout is not
    a page, and a page is whatever the templates make of it -- so the check below runs the real
    build on a copy rather than keeping a second guess at what it does.

    Raises BuildError if this site does not build, and BuildToolchainError if the build could not be
    run at all; those two must not be confused, because the first is the model's problem to fix and
    the second is nobody's answer to give.
    """
    if not BUILD_SCRIPT.is_file():
        raise BuildToolchainError(f"no build script at {BUILD_SCRIPT}")
    if not (REPO_ROOT / "node_modules").is_dir():
        raise BuildToolchainError(f"the build's packages are not installed: run `npm ci` in {REPO_ROOT}")
    with tempfile.TemporaryDirectory(prefix="site-build-") as work:
        source, out = Path(work) / "site", Path(work) / "out"
        for rel, content in files.items():
            target = source / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="")
        cmd = [NODE_BIN, str(BUILD_SCRIPT), "--source", str(source), "--out", str(out), "--quiet"]
        try:
            built = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                                   errors="replace", cwd=REPO_ROOT, timeout=BUILD_TIMEOUT_SECONDS)
        except FileNotFoundError:
            raise BuildToolchainError(f"the build needs Node, which was not found ({NODE_BIN!r})") from None
        except subprocess.TimeoutExpired:
            raise BuildError(f"the build did not finish within {BUILD_TIMEOUT_SECONDS}s") from None
        if built.returncode != 0:
            raise BuildError((built.stderr.strip() or built.stdout.strip() or "the build failed")[:1000])
        return {path.relative_to(out).as_posix(): path.read_text(errors="replace")
                for path in sorted(out.rglob("*")) if path.is_file()}


# The reachability axiom (issue #21). All of the content stays reachable from the root: index.html
# leads to every page, directly or by following links through pages it leads to, and sitemap.xml
# lists every page. The prompt states it as a standing rule for every run; the functions below let
# validate_plan hold the line, so a page a run adds is wired into both in the same run. They all
# work on a built site (issue #25), which is the one a visitor sees.
HOME_PAGE = "index.html"
SITEMAP = "sitemap.xml"
PAGE_SUFFIX = ".html"

# An href or src in HTML, quoted with ' or " or bare.
REFERENCE = re.compile(r"\b(?:href|src)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s\"'<>]+))", re.I)
# One <loc> of a sitemaps.org urlset.
SITEMAP_LOC = re.compile(r"<loc>([^<]*)</loc>", re.I)
# The start of a link that leaves the site: a scheme ("https:", "mailto:", "data:") or a host.
LEAVES_SITE = re.compile(r"[a-z][a-z0-9+.-]*:|//", re.I)


def html_pages(site):
    """The pages of a site mapping ({path: content}), as a set of site-relative paths."""
    return {rel for rel in site if rel.endswith(PAGE_SUFFIX)}


def resolve_link(rel, raw):
    """A link written on page `rel` as a site-relative path, or None if it names no file in /site.

    Fragments and queries are dropped, "." and ".." are followed, a link to a folder means that
    folder's home page, and anything that leaves the site is ignored.
    """
    target = raw.split("#", 1)[0].split("?", 1)[0].strip()
    if not target or LEAVES_SITE.match(target):
        return None
    if target.endswith("/"):
        target += HOME_PAGE
    # A site-absolute link starts at the site root; anything else starts in the linking page's folder.
    parts = [] if target.startswith("/") else list(PurePosixPath(rel).parent.parts)
    for part in PurePosixPath(target.lstrip("/")).parts:
        if part == "..":
            if not parts:
                return None  # climbs out of /site, so it is not a page of it
            parts.pop()
        elif part != ".":
            parts.append(part)
    return "/".join(parts) or None


def references_from(rel, site):
    """The files of `site` that page `rel` links to or loads, as site-relative paths."""
    found = set()
    for match in REFERENCE.finditer(site.get(rel) or ""):
        target = resolve_link(rel, next(group for group in match.groups() if group is not None))
        if target:
            found.add(target)
    return found


def links_from(rel, site):
    """The pages that page `rel` offers a way to reach.

    The pages it links to, plus the pages named by any stylesheet or script it loads: a federated
    site may well build its shared navigation in "js/site.js", and a page whose navigation arrives
    that way is reachable all the same.
    """
    pages = html_pages(site)
    reached = set()
    for target in references_from(rel, site):
        if target in pages:
            reached.add(target)
        elif target in site:  # a stylesheet or script, which may carry the shared navigation
            reached |= {page for page in pages if page in site[target]}
    return reached


def reachable_pages(site):
    """The pages of `site` that can be reached from the home page by following links."""
    if HOME_PAGE not in site:
        return set()
    seen, queue = {HOME_PAGE}, [HOME_PAGE]
    while queue:
        for page in links_from(queue.pop(), site) - seen:
            seen.add(page)
            queue.append(page)
    return seen


def listed_pages(site):
    """The pages of `site` that its sitemap lists.

    A <loc> may be a relative path -- which is what this site writes, having no fixed domain and
    being served under a sub-path -- or a full URL, so a loc counts for the page its path ends with.
    """
    locs = []
    for raw in SITEMAP_LOC.findall(site.get(SITEMAP) or ""):
        loc = raw.split("#", 1)[0].split("?", 1)[0].strip()
        locs.append(loc + HOME_PAGE if loc.endswith("/") else loc)
    return {page for page in html_pages(site)
            if any(loc == page or loc.endswith("/" + page) for loc in locs)}


def unreachable_pages(site):
    """The pages of `site` that the root cannot reach, as {page: [reason, ...]}.

    The axiom asks for both ways in, so there are two ways to fail it: a page that no chain of
    links from the home page arrives at, and a page the sitemap does not list.
    """
    reachable, listed = reachable_pages(site), listed_pages(site)
    missing = {}
    for page in html_pages(site):
        reasons = [reason for reason, ok in
                   ((f"not reachable from {HOME_PAGE}", page in reachable),
                    (f"not listed in {SITEMAP}", page in listed)) if not ok]
        if reasons:
            missing[page] = reasons
    return missing


def check_reachability(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` orphans a page.

    Only what this run breaks is refused. A page that was already unreachable stays the site's own
    problem to repair -- every run is asked to -- because refusing a plan over it would leave no
    plan able to repair it. What a run adds, though, it wires in itself.
    """
    was = unreachable_pages(before)
    for page, reasons in sorted(unreachable_pages(after).items()):
        broke = [reason for reason in reasons if reason not in was.get(page, ())]
        if broke:
            raise RejectedChange(
                f"every page must stay reachable from the root: {page} is " + " and ".join(broke))


# The analytics axiom (issue #24). Every page loads js/analytics.js, so every page asks for consent
# and -- once it is given -- reports to Google Analytics. The prompt states it as a standing rule and
# names the line to use; the functions below let validate_plan hold the line, so a page a run adds
# carries the tag and a page a run rewrites keeps it.


def pages_missing(site, script):
    """The pages of `site` that do not load `script`, as a set of site-relative paths.

    A site without that file is not held to the axiom at all: there is nothing for a page to load,
    and refusing every plan until someone puts the file back would leave no plan able to do it.
    """
    if script not in site:
        return set()
    return {page for page in html_pages(site) if script not in references_from(page, site)}


def pages_missing_analytics(site):
    """The pages of `site` that do not load ANALYTICS_SCRIPT."""
    return pages_missing(site, ANALYTICS_SCRIPT)


def check_analytics(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` leaves a page without
    the analytics and consent line.

    As with check_reachability, only what this run breaks is refused: a page that was already
    missing the line stays the site's own to repair, and the run that rewrites it can repair it.
    """
    broke = sorted(pages_missing_analytics(after) - pages_missing_analytics(before))
    if broke:
        raise RejectedChange(
            f"every page must load the analytics and consent banner script: {broke[0]} has no "
            f"{ANALYTICS_TAG} in its <head>")


# The responsive-and-accessible axiom (issue #26). The site is worth as much on a small screen as a
# large one, and is usable by a visitor who cannot see it, cannot use a mouse, or has asked for less
# motion. Like reachability, this is a property of the site as a whole that every run upholds rather
# than a one-off tidy-up of the pages that exist today: the prompt states it in full, and the
# functions below hold the line on the part of it that markup alone can settle, so a page a run
# writes is born responsive and accessible instead of being audited into shape later.
#
# Responsiveness is checked here as accessibility, because that is what it is: WCAG 2.2 names it
# Reflow (1.4.10) and Resize Text (1.4.4). A page that insists on a desktop-width window, or that
# forbids the pinch zoom people enlarge text with, has shut out the same visitor a missing alt text
# does.
#
# The standard is WCAG 2.2 level AA, and every reason below names the criterion it stands for, so
# the set can grow without becoming a matter of taste. What markup cannot settle is still required
# by the prompt and simply not checked here: contrast ratios need the rendered colours of a
# gradient, and tap target sizes and horizontal overflow need a layout. That is the same split the
# reachability axiom makes, where a nav built by a shared script counts as a way through without the
# script ever being run.

# Interactive elements that may take their accessible name from their own content: the text inside
# them, or the alt text of an image inside them.
NAMED_BY_CONTENT = {"a", "button", "summary"}
# Form controls whose content is not their name: it has to come from a <label for> or an attribute.
NAMED_BY_LABEL = {"input", "select", "textarea"}
# Attributes that name an element outright, wherever it sits.
NAMING_ATTRIBUTES = ("aria-label", "aria-labelledby", "title", "alt")
# <input type> values that need no label: a hidden field is not a control at all, and the button
# types carry their own text in "value" or fall back to one the browser supplies.
SELF_NAMING_INPUTS = {"hidden", "submit", "reset", "button"}


class PageFacts(HTMLParser):
    """The handful of facts the accessibility checks ask of one page's markup.

    HTMLParser hands over the body of <style> and <script> as raw text instead of parsing it, so
    markup a page builds inside a JavaScript string -- which every page that draws its own DOM is
    full of -- is never mistaken for markup of the page itself. Only the page as committed is
    judged, which is the same bargain the reachability check makes.
    """

    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.lang = ""
        self.viewport = None  # the content of the viewport meta tag, if the page has one
        self.title = ""
        self.headings = []  # heading levels, in document order
        self.mains = 0
        self.css = ""  # the text of every <style>
        self.js = ""  # the text of every <script>
        self.images_without_alt = 0
        self.positive_tabindex = False
        self.controls = []  # one record per interactive element; see control()
        self.labelled = set()  # the ids some <label for> points at
        self.raw = None  # "style" or "script" while inside one
        self.svg = 0  # how many <svg> elements are open: a <title> in one names the graphic
        self.in_title = False
        self.open = []  # controls still open, innermost last, named by what is written inside them
        self.feed(content)
        self.close()

    def control(self, tag, attr, by_content):
        """Record one interactive element, and start collecting its text if that can name it."""
        record = {"tag": tag, "id": attr.get("id", "").strip(),
                  "named": any(attr.get(name, "").strip() for name in NAMING_ATTRIBUTES)}
        self.controls.append(record)
        if by_content:
            self.open.append(record)

    def name_enclosing(self, text):
        """Text or alt text inside the open controls names every one of them, however deeply nested."""
        if text.strip():
            for record in self.open:
                record["named"] = True

    def handle_starttag(self, tag, attrs):
        attr = {key.lower(): (value or "") for key, value in attrs}
        if tag in ("style", "script"):
            self.raw = tag
        elif tag == "html":
            self.lang = attr.get("lang", "").strip()
        elif tag == "meta" and attr.get("name", "").strip().lower() == "viewport":
            self.viewport = attr.get("content", "")
        elif tag == "title":
            self.in_title = not self.svg  # inside an <svg> a <title> is the graphic's name
        elif tag == "svg":
            self.svg += 1
        elif tag == "main":
            self.mains += 1
        elif tag == "label" and attr.get("for", "").strip():
            self.labelled.add(attr["for"].strip())
        elif len(tag) == 2 and tag[0] == "h" and tag[1] in "123456":
            self.headings.append(int(tag[1]))
        elif tag == "img" and "alt" not in attr:
            self.images_without_alt += 1
        if attr.get("tabindex", "").strip().lstrip("+").isdigit() and attr["tabindex"].strip("+ ") != "0":
            self.positive_tabindex = True
        if tag in NAMED_BY_CONTENT and (tag != "a" or "href" in attr):  # an <a> with no href is a target
            self.control(tag, attr, by_content=True)
        elif tag in NAMED_BY_LABEL and attr.get("type", "").strip().lower() not in SELF_NAMING_INPUTS:
            self.control(tag, attr, by_content=False)
        if tag in ("img", "svg"):
            self.name_enclosing(attr.get("alt", "") or attr.get("aria-label", ""))

    def handle_data(self, data):
        if self.raw == "style":
            self.css += data
        elif self.raw == "script":
            self.js += data
        elif self.in_title and not self.svg:
            self.title += data
        else:
            self.name_enclosing(data)

    def handle_endtag(self, tag):
        if self.raw:
            if tag == self.raw:
                self.raw = None
            return
        if tag == "svg":
            self.svg = max(0, self.svg - 1)
        elif tag == "title":
            self.in_title = False
        for index in range(len(self.open) - 1, -1, -1):
            if self.open[index]["tag"] == tag:
                del self.open[index:]  # whatever sat inside it was left unclosed, so it closes too
                break

    def unnamed_controls(self):
        """The kinds of interactive element the page leaves without an accessible name.

        A <label for> may be written either side of the control it labels, so the ids it points at
        are only all known once the whole page has been read.
        """
        return sorted({record["tag"] for record in self.controls
                       if not record["named"] and record["id"] not in self.labelled})


# Motion the page commits to, in its CSS or its script, and the one thing a page that moves owes the
# visitor who has asked for less of it. Only unambiguous motion counts: a @keyframes rule, an
# animation or transition declaration, a frame loop, or the Web Animations API. A bare setInterval is
# left out on purpose -- it as often ticks a clock's text as moves anything -- so the check cannot
# refuse a run over something that does not actually move.
MOTION = re.compile(r"@keyframes|(?<![\w-])(?:animation|transition)(?:-[a-z]+)?\s*[:=]"
                    r"|requestAnimationFrame|\.animate\s*\(", re.I)
REDUCED_MOTION = "prefers-reduced-motion"
# A page may only take the browser's focus ring away if it draws one of its own (WCAG 2.4.7).
DROPS_FOCUS_RING = re.compile(r"outline\s*:\s*(?:none|0[a-z%]*)\b", re.I)
DRAWS_FOCUS_RING = re.compile(r":focus(?:-visible|-within)?\b", re.I)
# The viewport meta tag that makes a page lay out at the device's width instead of a desktop's
# (WCAG 1.4.10 Reflow), and the two ways of forbidding the zoom WCAG 1.4.4 asks to leave alone.
DEVICE_WIDTH = re.compile(r"\bwidth\s*=\s*device-width", re.I)
NO_USER_SCALING = re.compile(r"user-scalable\s*=\s*(?:no|0|false)", re.I)
MAXIMUM_SCALE = re.compile(r"maximum-scale\s*=\s*([0-9]*\.?[0-9]+)", re.I)


def assets_of(rel, site):
    """The stylesheets and scripts page `rel` loads, as site-relative paths that exist in `site`.

    A run is invited to lift shared styles and behaviour into "css/site.css" and "js/site.js", so a
    page's focus ring and its motion are as likely to live there as in the page. Reading them with
    the page keeps the checks true of a federated site, where a page's own <style> block may be empty.
    """
    found = []
    for match in REFERENCE.finditer(site.get(rel) or ""):
        target = resolve_link(rel, next(group for group in match.groups() if group is not None))
        if target in site and not target.endswith(PAGE_SUFFIX) and target not in found:
            found.append(target)
    return found


def page_violations(rel, site):
    """Why page `rel` fails the responsive-and-accessible axiom, as a list of short reasons.

    Every reason names one signal the page either plainly has or plainly lacks, so no judgement of
    taste is involved, and every reason is a fixed string: repairing one has to remove a reason and
    can never add a different one, which is what lets check_accessibility tell a repair from a
    regression. A page with no reasons is not thereby proved accessible -- contrast and tap targets
    are not judged here -- but a page with one is certainly not.
    """
    try:
        page = PageFacts(site.get(rel) or "")
    except (ValueError, AssertionError, RecursionError):
        return ["cannot be parsed as HTML"]
    css, js = page.css, page.js
    for asset in assets_of(rel, site):
        if asset.endswith(".css"):
            css += "\n" + site[asset]
        elif asset.endswith((".js", ".mjs")):
            js += "\n" + site[asset]
    scale = MAXIMUM_SCALE.search(page.viewport or "")
    reasons = [reason for reason, ok in (
        # Responsive: the page lays out at the device's width, and the visitor may still zoom.
        ("has no viewport meta tag with width=device-width",  # WCAG 1.4.10 Reflow
         bool(DEVICE_WIDTH.search(page.viewport or ""))),
        ("forbids zooming in its viewport meta tag",  # WCAG 1.4.4 Resize Text
         not NO_USER_SCALING.search(page.viewport or "") and not (scale and float(scale[1]) < 2)),
        # Accessible: named, structured, described, operable by keyboard, and calm when asked to be.
        ("has no lang attribute on <html>", bool(page.lang)),  # WCAG 3.1.1 Language of Page
        ("has no page title", bool(page.title.strip())),  # WCAG 2.4.2 Page Titled
        ("has no <main> landmark", page.mains >= 1),  # WCAG 1.3.1, and 2.4.1 Bypass Blocks
        ("has more than one <main> landmark", page.mains <= 1),
        ("has no <h1>", 1 in page.headings),  # WCAG 1.3.1 Info and Relationships
        ("skips a heading level", all(
            level <= previous + 1 for previous, level in zip([0] + page.headings, page.headings))),
        ("has an <img> with no alt attribute", not page.images_without_alt),  # WCAG 1.1.1
        ("takes the focus outline away without a :focus style of its own",  # WCAG 2.4.7
         not DROPS_FOCUS_RING.search(css) or bool(DRAWS_FOCUS_RING.search(css))),
        ("uses a positive tabindex", not page.positive_tabindex),  # WCAG 2.4.3 Focus Order
        (f"animates without honouring {REDUCED_MOTION}",  # WCAG 2.3.3, and 2.2.2 for anything long
         not MOTION.search(css + "\n" + js) or REDUCED_MOTION in css + js),
    ) if not ok]
    # WCAG 4.1.2 Name, Role, Value; 2.4.4 Link Purpose; 3.3.2 Labels or Instructions. One reason per
    # kind of element, so fixing the buttons takes the buttons' reason away and leaves the rest.
    reasons += [f"has a{'n' if tag[0] in 'aeiou' else ''} <{tag}> with no accessible name"
                for tag in page.unnamed_controls()]
    return reasons


def inaccessible_pages(site):
    """The pages of `site` that fail the axiom, as {page: [reason, ...]}."""
    failing = {}
    for page in sorted(html_pages(site)):
        reasons = page_violations(page, site)
        if reasons:
            failing[page] = reasons
    return failing


def check_accessibility(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` makes a page fail the
    responsive-and-accessible axiom.

    Only what this run breaks is refused, for the same reason check_reachability only refuses what
    this run breaks: a page that already falls short stays the site's own problem to repair -- every
    run is asked to -- and refusing every plan over it would leave no plan able to repair it. A page
    a run writes from scratch has no such excuse, so it is born responsive and accessible.
    """
    was = inaccessible_pages(before)
    for page, reasons in sorted(inaccessible_pages(after).items()):
        broke = [reason for reason in reasons if reason not in was.get(page, ())]
        if broke:
            raise RejectedChange(
                f"every page must be responsive and accessible: {page} " + " and ".join(broke))


# The local-state axiom (issue #31). Everything this site keeps in a visitor's browser lives in one
# JSON document, every page reads and writes it through one shared accessor, and a very small meta
# menu in the corner of every page lets a visitor copy that document out, paste someone else's in,
# or throw it away -- so a person can collect and share their experiences of this site. All of it
# arrives with one line, js/state.js, and that file is fixed: the one affordance a visitor has for
# getting their own state back out cannot be something an hourly rewrite might quietly reword.
#
# Two halves, as the issue asks: the line on every page, and nothing behind the store's back. The
# second is what makes the first worth having -- a page that parses localStorage itself is state
# the meta menu cannot export.

# A page reaching for the browser's storage on its own account. Only the fixed files may: state.js
# *is* the store, and the consent banner keeps the visitor's answer to it (which is the banner's,
# not the site's, so it is deliberately not in the document).
DIRECT_STORAGE = re.compile(r"\b(?:local|session)Storage\b")


def pages_missing_state(site):
    """The pages of `site` that do not load STATE_SCRIPT."""
    return pages_missing(site, STATE_SCRIPT)


def pages_touching_storage(site):
    """The pages of `site` that use the browser's storage themselves, as {page: [file, ...]}.

    A page is read along with every stylesheet and script it loads, as in the accessibility checks,
    because a federated site keeps its behaviour in shared files; the fixed files are skipped,
    being the ones the storage belongs to. A site without the store is not held to this at all, for
    the same reason it is not held to the line.
    """
    if STATE_SCRIPT not in site:
        return {}
    touching = {}
    for page in sorted(html_pages(site)):
        where = [rel for rel in [page, *assets_of(page, site)]
                 if rel not in FIXED_FILES and DIRECT_STORAGE.search(site.get(rel) or "")]
        if where:
            touching[page] = where
    return touching


def check_state(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` leaves a page without
    the local-state line, or has a page keep state behind the shared store's back.

    Only what this run breaks is refused, as with the three axioms above.
    """
    broke = sorted(pages_missing_state(after) - pages_missing_state(before))
    if broke:
        raise RejectedChange(
            "every page must load the shared local-state store and its meta menu: "
            f"{broke[0]} has no {STATE_TAG} in its <head>")
    was = pages_touching_storage(before)
    for page, files in sorted(pages_touching_storage(after).items()):
        new = [rel for rel in files if rel not in was.get(page, ())]
        if new:
            where = "its own script" if new[0] == page else new[0]
            raise RejectedChange(
                f"no page may use the browser's storage directly: {page} does, in {where}, where "
                f"it should read and write through window.interestingState (see {STATE_SCRIPT})")


# The cadence axiom (issue #32). Nothing a visitor reads ties the site to an update frequency. The
# site does not run nightly experiments: it iterates continuously, so copy that dates its content --
# "Tonight's experiment", "rewritten every hour" -- is false as often as it is true. Copy that
# defers a visitor to another day ("move one star tomorrow and ask again") is refused for a second
# reason: engagement time is the measure (see INTERESTING), and sending someone away is the one
# thing a run can do that spends it outright. The prompt states this, and the functions below hold
# the line, the same arrangement the four axioms above have.
#
# Deliberately narrow. Only words that date the site or defer the visitor are listed, so the
# night-sky theming the whole site is built on survives untouched: "midnight rain", "midnight
# tones", "night acoustics memo" and "before midnight" all name a mood rather than a schedule, and
# so does a page that merely shows an hour. The list is short enough to state in full in the prompt,
# which is what makes it a rule a run can follow rather than a trap it springs.
#
# The possessives allow any apostrophe a page might be written with -- straight, typographic, or
# either of the entities for them -- because "today&rsquo;s sky" promises a schedule just as plainly
# as "today's sky" does, and the bare words below would not catch it.
APOSTROPHE = r"(?:'|’|&(?:rsquo|apos|#39|#8217);)"
CADENCE_COPY = re.compile(
    r"\btonight\b|\btomorrow\b|\byesterday\b"            # dates the content, or defers the visitor
    rf"|\b(?:today|this hour|this week|this month){APOSTROPHE}s\b"   # the same, in the possessive
    r"|\b(?:hourly|nightly|daily|weekly)\b"              # names the rhythm outright
    r"|\bevery (?:hour|night|day|week)\b"
    r"|\beach (?:hour|night|day|week)\b"
    r"|\bonce (?:an hour|a day|a night|a week)\b",
    re.I)


def cadence_phrases(rel, site):
    """The cadence-tied phrases page `rel` would put in front of a visitor, lowercased and sorted.

    Read as text, not parsed as markup -- the one check here that is. Most of this site's prose
    lives in the JavaScript that draws the page rather than in its markup, so the readings in
    star-lantern.html and the notes in index.html would all be invisible to a parser that handed
    <script> bodies over as opaque text, which is exactly what the accessibility checks want it to
    do. A phrase in a comment counts too; a comment is a poor place to promise a schedule.

    The stylesheets and scripts the page loads are read with it, as in assets_of's own reasoning: a
    run is invited to federate shared copy into "js/site.js", and copy that moved there would
    otherwise slip the check. FIXED_FILES are left out. They are never a model's to write, so a
    phrase in one can never be a run's fault, and 55 KB of vendored consent library is not prose
    this repository gets to police -- a future version of it saying "daily" in a comment must not
    be able to fail every page of the site at once.
    """
    sources = [site.get(rel) or ""]
    sources += [site[asset] for asset in assets_of(rel, site) if asset not in FIXED_FILES]
    return sorted({match.group(0).lower() for source in sources
                   for match in CADENCE_COPY.finditer(source)})


def pages_dating_the_site(site):
    """The pages of `site` whose copy names an update rhythm, as {page: [phrase, ...]}."""
    found = {}
    for page in sorted(html_pages(site)):
        phrases = cadence_phrases(page, site)
        if phrases:
            found[page] = phrases
    return found


def check_cadence(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` ties a page to an
    update frequency.

    Only what this run breaks is refused, for the same reason the four checks above only refuse
    what this run breaks: a phrase a page already carries stays the site's own to clear away --
    every run is asked to -- and refusing every plan over one would leave no plan able to clear it.
    Each reason is one phrase, so taking a phrase out of a page can only ever take a reason away.
    """
    was = pages_dating_the_site(before)
    for page, phrases in sorted(pages_dating_the_site(after).items()):
        broke = [phrase for phrase in phrases if phrase not in was.get(page, ())]
        if broke:
            raise RejectedChange(
                f"no page may tie the site to an update frequency: {page} says "
                + " and ".join(f'"{phrase}"' for phrase in broke))


# The mood axiom (issue #30). The site asks before it offers. The target of interest is the whole
# population, not the part of it that happens to like the sky this site grew up as, so no page may
# put particular content in front of a visitor on the assumption that they want it: the site makes
# an effort to ascertain their mood or mental orientation first, and what is offered follows from
# that. The prompt states it, and the three signals below are the part of it that markup and source
# can settle, the same bargain the five axioms above make.
#
# What is checked, and why each is something a page either plainly has or plainly lacks:
#
#   1. Every page carries the flow. One line brings it, exactly as the analytics axiom works, so a
#      shared shell carries it to every page at once and a run that drops it is refused.
#   2. The library of query mechanisms does not collapse. A run may rewrite MOOD_SCRIPT freely --
#      that is where new mechanisms come from, and inventing them is the point -- but it may not
#      leave the site with fewer than MIN_MOOD_PROBES ways of asking, because "never the same way
#      twice" is only true while there are ways to spare.
#   3. No page asks a visitor to report their own mood. Querying sideways is the whole method; a
#      mood dropdown would be the one answer the issue ruled out.
#
# What is deliberately not checked: whether a particular question is a good question, whether the
# orientations are the right orientations, and whether a world suits the orientation that opens on
# to it. No code could judge any of that, so the prompt asks for it and this does not pretend to.

# How many distinct ways of asking the site has to keep. Twelve shipped with the axiom, so the
# floor leaves room to retire a mechanism that is not working without the rule becoming a ratchet
# that forbids ever simplifying.
MIN_MOOD_PROBES = 8
# How a query mechanism announces itself: `probe: 'doorway'` on the object that defines it. Named
# rather than counted by shape, so a run can add one by writing one, and so this check never has to
# parse JavaScript.
PROBE_DECLARATION = re.compile(r"""(?<![\w-])probe\s*:\s*['"]([a-z][a-z0-9-]*)['"]""")
# The one thing the site may never do: ask a visitor to name their own state. The list is short and
# stated in full in the prompt, so it is a rule a run can follow rather than a trap it springs, and
# it only catches a page addressing the visitor -- prose *about* the method ("it never asks you how
# you feel") is not a question and is not matched.
SELF_REPORT_COPY = re.compile(
    r"\bhow (?:are|do) you feel(?:ing)?\b"
    r"|\bhow are you (?:doing|today)\b"
    rf"|\bwhat{APOSTROPHE}?s your (?:mood|vibe|energy)\b"
    r"|\bwhat is your (?:mood|vibe|energy)\b"
    r"|\b(?:select|choose|pick|set|rate|describe|name|tell us|tell me) your "
    r"(?:mood|vibe|energy|feelings?|emotional state|state of mind)\b",
    re.I)


def pages_missing_mood(site):
    """The pages of `site` that do not load MOOD_SCRIPT, as a set of site-relative paths.

    A site without that file is not held to the axiom at all, for the same reason
    pages_missing_analytics is not: there would be nothing for a page to load. It cannot happen
    here, because MOOD_SCRIPT is in PROTECTED_FILES and so can never be deleted.
    """
    if MOOD_SCRIPT not in site:
        return set()
    return {page for page in html_pages(site)
            if MOOD_SCRIPT not in references_from(page, site)}


def probe_mechanisms(site):
    """The distinct query mechanisms `site` declares, as a set of ids.

    Read out of the site's own source rather than from a list kept here, so the library is the
    site's to grow: a run invents a mechanism by writing one, and the floor below starts counting
    it in the same run. FIXED_FILES are left out, as everywhere else -- a vendored library is not
    this site's apparatus.
    """
    found = set()
    for rel, content in site.items():
        if rel in FIXED_FILES or not rel.endswith((".js", ".mjs", PAGE_SUFFIX)):
            continue
        found |= set(PROBE_DECLARATION.findall(content))
    return found


def pages_asking_to_self_report(site):
    """The pages of `site` that ask a visitor to report their own mood, as {page: [phrase, ...]}.

    Read as text and followed into the page's stylesheets and scripts, exactly as cadence_phrases
    is and for the same reason: most of this site's prose, and all of its questions, live in the
    JavaScript that draws the page.
    """
    found = {}
    for page in sorted(html_pages(site)):
        sources = [site.get(page) or ""]
        sources += [site[asset] for asset in assets_of(page, site) if asset not in FIXED_FILES]
        phrases = sorted({match.group(0).lower() for source in sources
                          for match in SELF_REPORT_COPY.finditer(source)})
        if phrases:
            found[page] = phrases
    return found


def check_mood(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` stops the site asking
    before it offers.

    Only what this run breaks is refused, exactly as the four checks above only refuse what this
    run breaks: a page that already lacks the flow stays the site's own to repair -- every run is
    asked to -- and refusing every plan over it would leave no plan able to repair it.
    """
    broke = sorted(pages_missing_mood(after) - pages_missing_mood(before))
    if broke:
        raise RejectedChange(
            f"every page must carry the mood flow, so the site asks before it offers: {broke[0]} "
            f"has no {MOOD_TAG} in its <head>")

    had, has = probe_mechanisms(before), probe_mechanisms(after)
    if len(had) >= MIN_MOOD_PROBES > len(has):
        raise RejectedChange(
            f"the site must keep at least {MIN_MOOD_PROBES} ways of querying a visitor, so it "
            f"never asks the same way twice: this leaves {len(has)} "
            f"(gone: {', '.join(sorted(had - has)) or 'none'})")

    was = pages_asking_to_self_report(before)
    for page, phrases in sorted(pages_asking_to_self_report(after).items()):
        added = [phrase for phrase in phrases if phrase not in was.get(page, ())]
        if added:
            raise RejectedChange(
                f"no page may ask a visitor to report their own mood: {page} says "
                + " and ".join(f'"{phrase}"' for phrase in added))


# The participation axiom (issue #43). Every page carries a prominent, always-visible way for the
# person looking at the site to say what it should become: one press, and they are on a new issue
# of this repository with the form chosen and the page they came from filled in.
#
# It is an axiom rather than a nicety because of what the other six leave unsaid. A site rewritten
# continuously by a model is steered by whoever can reach the model, and the only standing channel
# from a visitor back to the people and the prompt behind it is an issue on this repository. A run
# that reworded the invitation, moved it somewhere quieter or dropped it would be closing that
# channel -- which is precisely the kind of change no run should be able to make and no reviewer
# would notice for a long time. So the line is required on every page like the analytics and state
# lines, and PARTICIPATE_SCRIPT is fixed like the files behind those: never shown to a model,
# refused outright as a write or a delete.
#
# Only the line and the file are held here. What the destination looks like is GitHub's side of it
# (.github/ISSUE_TEMPLATE/), and what a page says about it in its own prose is the run's business
# as usual, which is the same split every other axiom makes.


def pages_missing_participate(site):
    """The pages of `site` that do not load PARTICIPATE_SCRIPT."""
    return pages_missing(site, PARTICIPATE_SCRIPT)


def check_participate(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` leaves a page without
    the line that carries a visitor's way of steering the site.

    Only what this run breaks is refused, as with the six axioms above.
    """
    broke = sorted(pages_missing_participate(after) - pages_missing_participate(before))
    if broke:
        raise RejectedChange(
            "every page must carry a visitor's way of steering this site: "
            f"{broke[0]} has no {PARTICIPATE_TAG} in its <head>")


# ------------------------------------------------------------------------------------------------
# Caution before a destructive action: the eighth axiom (issue #42).
#
# Any control that throws a visitor's saved state away is a warning button, and pressing it opens
# the one modal that asks "are you sure you want to ______?" with the specific thing about to go in
# the blank. Both halves are about consistency rather than about friction, which is why one shared
# component writes them once: the button is recognised as dangerous before it is read, and the
# question is the same question in every corner of the site. There is no separate arming
# affordance -- no checkbox, no toggle, no hold-to-arm press. The warning treatment plus the modal
# is the safety switch.
#
# The threshold, because there is a spectrum of severity and this is where the caution begins:
#
#   above it, and held to both halves -- a press that is nothing but a loss. The whole local-state
#     document goes, or the whole of one name in it (a sky, a reading, a kept list), and nothing
#     takes its place. The site's own: the meta menu's "clear", the persona sheet's "clear the sky"
#     and "forget my reading", the atlas's "forget my reading", "clear omens", "empty the drawer",
#     "empty the kiln".
#   at it, and held to the modal but not the warning -- a trade rather than a loss. The whole of a
#     name goes, but something the visitor asked for arrives in its place: "seed a small sky" over
#     a placed one, "replace mine" over your own document. The question is the same; the paint is
#     not, because the one button that gets a beginner started must not read as a danger.
#   below it, and held to neither -- one thing rather than the whole thing ("remove this star",
#     one entry out of a list that can be added to again), and anything that only changes what is
#     on the screen ("sweep the floor", "reset decoder", "turn the soil").
#
# Three things are refused in code, each of them mechanical:
#
#   1. The shared component may not go. js/site.js offers it and the stylesheet every page links
#      paints it, and a change that leaves the site without either is refused -- the law is worth
#      nothing if every page has to improvise it again.
#   2. A control whose own words say it throws saved state away must wear the warning treatment.
#      Read off the page as committed, from the family of words named in full in the prompt.
#   3. No page may write a confirmation of its own. window.confirm is refused outright: a browser
#      dialog cannot say which of a visitor's things is about to go, and a question that reads
#      differently on every page is not a safety switch.
#
# What is deliberately not checked: whether a given control is above the threshold or below it, and
# whether the press of a warning button really is wired to the shared modal. No regex can tie a
# click handler to the button it was attached to, and no code can judge how much a visitor would
# miss what a press takes away. So the prompt asks for both, and this does not pretend to.

# Where the two halves of the shared component live. js/site.js is ordinary site source and may be
# rewritten freely -- what may not happen is the component disappearing out of it.
DESTRUCTIVE_SCRIPT = "js/site.js"
SHARED_STYLESHEET = "css/site.css"
# The one class a destructive control wears, under the same name in the markup and the styling.
WARNING_CLASS = "warning"
# How js/site.js offers the component, and how the shared stylesheet paints it. Named rather than
# matched by shape, so a run may rewrite either as long as the names survive.
OFFERS_DESTRUCTIVE = re.compile(r"(?<![\w.])destructive\s*:")
PAINTS_WARNING = re.compile(rf"\.{WARNING_CLASS}\b")
# The words that say a control takes the whole of a saved thing away. Short and stated in full in
# the prompt, so it is a rule a run can follow rather than a trap it springs, and deliberately
# narrow: "remove" is the site's word for one item out of a list, which is below the threshold, and
# "reset", "sweep" and "turn" name controls that discard nothing kept.
DISCARDS_SAVED_STATE = re.compile(
    r"\b(?:clear|clears|forget|forgets|empty|empties|erase|erases|wipe|wipes"
    r"|delete|deletes|discard|discards|throws? away|throws? out)\b", re.I)
# The browser's own question, which the shared modal replaces everywhere.
OWN_CONFIRMATION = re.compile(r"(?<![\w.$])(?:window\s*\.\s*)?confirm\s*\(")

# The controls of this site that act like buttons: a <button>, and a link wearing .action.
ACTS_LIKE_A_BUTTON = "action"


class DestructiveControls(HTMLParser):
    """The controls of one page whose own words say they throw saved state away, and which of them
    wear the shared warning treatment.

    Only <button> and the links that act like one (<a class='action'>) are controls here: an
    ordinary link navigates rather than destroys. HTMLParser hands the body of <script> over as raw
    text instead of parsing it, exactly as PageFacts relies on, so a control a page builds inside a
    JavaScript string is not a control of the page -- only the page as committed is judged, which is
    the same bargain the reachability and accessibility checks make.
    """

    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.controls = []  # (name, wears the warning) for every destructive-sounding control
        self.open = []  # the controls still open, innermost last
        self.raw = None  # "style" or "script" while inside one
        self.feed(content)
        self.close()
        for record in self.open:
            self.settle(record)  # left unclosed, and still a control
        self.open = []

    def settle(self, record):
        name = re.sub(r"\s+", " ", "".join(record["text"])).strip()
        if name and DISCARDS_SAVED_STATE.search(name):
            self.controls.append((name, WARNING_CLASS in record["classes"]))

    def handle_starttag(self, tag, attrs):
        attr = {key.lower(): (value or "") for key, value in attrs}
        if tag in ("style", "script"):
            self.raw = tag
            return
        if self.raw:
            return
        acts = tag == "button" or (tag == "a" and "href" in attr
                                   and ACTS_LIKE_A_BUTTON in attr.get("class", "").split())
        if acts:
            # A control's own words are its text and whatever names it outright, so a button whose
            # face is a glyph and whose aria-label says "clear everything" is not a way round this.
            named = " ".join(attr.get(name, "") for name in ("aria-label", "title"))
            self.open.append({"tag": tag, "classes": attr.get("class", "").split(),
                              "text": [named, " "] if named.strip() else []})

    def handle_data(self, data):
        if self.raw:
            return
        for record in self.open:
            record["text"].append(data)

    def handle_endtag(self, tag):
        if self.raw:
            if tag == self.raw:
                self.raw = None
            return
        for index in range(len(self.open) - 1, -1, -1):
            if self.open[index]["tag"] == tag:
                for record in self.open[index:]:
                    self.settle(record)  # whatever sat inside it was left unclosed, so it closes too
                del self.open[index:]
                return

    def bare(self):
        """The names of the destructive-sounding controls that do not wear the warning treatment."""
        warned = {name for name, wears in self.controls if wears}
        return sorted({name for name, wears in self.controls if not wears and name not in warned})


def pages_with_bare_destructive_controls(site):
    """The pages of `site` with a control whose own words say it throws saved state away and that
    does not wear the shared warning treatment, as {page: [name, ...]}."""
    found = {}
    for page in sorted(html_pages(site)):
        bare = DestructiveControls(site.get(page) or "").bare()
        if bare:
            found[page] = bare
    return found


def pages_improvising_confirmation(site):
    """The pages of `site` that ask a visitor to confirm in the browser's own dialog rather than
    through the one shared modal, as {page: [file, ...]}.

    Followed into the page's scripts and stylesheets, as cadence_phrases is and for the same
    reason: this site's behaviour lives in the JavaScript that draws the page. FIXED_FILES are left
    out, as everywhere else -- js/state.js keeps a window.confirm of its own as the fallback for a
    run having broken js/site.js, and 55 KB of vendored consent library is not this site's code to
    police.
    """
    found = {}
    for page in sorted(html_pages(site)):
        sources = [(page, site.get(page) or "")]
        sources += [(asset, site[asset]) for asset in assets_of(page, site)
                    if asset not in FIXED_FILES]
        where = sorted({rel for rel, source in sources if OWN_CONFIRMATION.search(source)})
        if where:
            found[page] = where
    return found


def shares_destructive_caution(site):
    """Is the one shared destructive-control component still there: the behaviour in js/site.js and
    the warning treatment in the stylesheet every page links?

    A site that carries neither is not held to the axiom at all, for the same reason
    pages_missing_mood is not: there would be nothing for a control to use.
    """
    offers = OFFERS_DESTRUCTIVE.search(site.get(DESTRUCTIVE_SCRIPT) or "")
    paints = PAINTS_WARNING.search(site.get(SHARED_STYLESHEET) or "")
    return bool(offers and paints)


def check_destructive(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` lets a control throw a
    visitor's saved state away without the warning treatment and the one shared confirmation.

    Only what this run breaks is refused, exactly as the seven checks above only refuse what this run
    breaks: a control that already falls short stays the site's own to repair -- every run is asked
    to -- and refusing every plan over it would leave no plan able to repair it.
    """
    if shares_destructive_caution(before) and not shares_destructive_caution(after):
        raise RejectedChange(
            "the one shared destructive-control component must stay: "
            f"{DESTRUCTIVE_SCRIPT} offers window.interestingSite.destructive() and "
            f"{SHARED_STYLESHEET} paints .{WARNING_CLASS}, and this leaves the site without one "
            "of them")

    was = pages_with_bare_destructive_controls(before)
    for page, names in sorted(pages_with_bare_destructive_controls(after).items()):
        added = [name for name in names if name not in was.get(page, ())]
        if added:
            raise RejectedChange(
                "a control that throws a visitor's saved state away must read as a warning "
                f"button, with class=\"{WARNING_CLASS}\": {page} has "
                + " and ".join(f'"{name}"' for name in added) + " without it")

    had = pages_improvising_confirmation(before)
    for page, where in sorted(pages_improvising_confirmation(after).items()):
        added = [rel for rel in where if rel not in had.get(page, ())]
        if added:
            raise RejectedChange(
                "no page may write a confirmation of its own: the one question is the modal "
                f"window.interestingSite.destructive() opens, and {added[0]} calls "
                "window.confirm()")


# ------------------------------------------------------------------------------------------------
# The completion axiom. Every world is a piece a visitor can finish: a world's page is a stage
# (js/stage.js, _includes/stage.njk) on which the world's module (js/modules/<world>.js) makes a
# small, randomly configured piece from a seed -- a title, a line, PIECE_MIN_STEPS to PIECE_MAX_STEPS
# knobs and a clear end -- which vanishes with some ceremony when it is finished and is followed by the next card
# from the feed, so one piece follows another without end. The prompt states the contract; the
# harness below plays every piece to its end without a browser, the way the stage would, and
# check_completion() holds every plan to it. The limits are the harness's own, repeated here for
# the prompt; RealSiteTest checks that the two agree.
PIECE_HARNESS_REL = ".github/scripts/piece_harness.mjs"
PIECE_HARNESS = REPO_ROOT / PIECE_HARNESS_REL
PIECE_TIMEOUT_SECONDS = 120
PIECE_MIN_STEPS = 2
PIECE_MAX_STEPS = 5
PIECE_MAX_TAPS = 12
PIECE_MAX_SECONDS = 45
STAGE_SCRIPT = "js/stage.js"
STAGE_INCLUDE = "_includes/stage.njk"
MODULES_DIR = "js/modules/"
# The one list of worlds the layout writes into every page for the scripts, as JSON in a script
# element; the stage opens pieces from it, and the check reads it to know which worlds there are.
WORLD_LIST_ID = "site-worlds"
WORLD_LIST = re.compile(r"<script[^>]*\bid=['\"]" + WORLD_LIST_ID + r"['\"][^>]*>(.*?)</script>", re.S | re.I)


def listed_worlds(site):
    """The worlds the built `site` lists for its scripts, as [page, ...], read off the home page.

    The list is the layout's #site-worlds JSON, rendered from _data/worlds.json, so what the stage
    can open and what the check requires a piece of are the same list. A site without the list has
    no worlds in this sense, and the check has nothing to say about it.
    """
    found = WORLD_LIST.search(site.get(HOME_PAGE) or "")
    if not found:
        return []
    try:
        data = json.loads(found.group(1))
    except ValueError:
        return []
    if not isinstance(data, list):
        return []
    return [entry["file"] for entry in data
            if isinstance(entry, dict) and isinstance(entry.get("file"), str)
            and entry["file"].endswith(PAGE_SUFFIX)]


def module_of(world):
    """The module a world's page is played from: quiet-room.html -> js/modules/quiet-room.js."""
    return f"{MODULES_DIR}{world[:-len(PAGE_SUFFIX)]}.js"


def run_piece_harness(site):
    """Play every module of `site` through the harness, as {module id: its report}.

    The report is the harness's own JSON: `hasPiece`, `ok` and `problems` per module. A site with
    no modules is not played at all. Raises BuildToolchainError if the harness or Node cannot be
    run, which is nobody's answer to give. The harness plays each module in a worker of its own
    with a limit of its own, so one piece that never ends is reported alone; only a harness that
    does not return at all is reported against every module.
    """
    modules = {rel: content for rel, content in site.items()
               if rel.startswith(MODULES_DIR) and rel.endswith(".js")
               and "/" not in rel[len(MODULES_DIR):]}
    if not modules:
        return {}
    if not PIECE_HARNESS.is_file():
        raise BuildToolchainError(f"no piece harness at {PIECE_HARNESS}")
    with tempfile.TemporaryDirectory(prefix="pieces-") as work:
        moddir = Path(work) / "modules"
        moddir.mkdir()
        # A module is an ES module (it exports default), but a bare ".js" file in a temp directory
        # with no package.json above it is read as CommonJS on every Node before syntax detection
        # was unflagged (20.19 / 22.7), and "export" fails to parse -- which would report every
        # world as having no piece() on a supported Node (engines: >=20), quietly stopping the
        # axiom from being enforced. A package.json here marks the modules ESM on all of them, as
        # the repository's own does for js/modules/ in the tree.
        (moddir / "package.json").write_text('{"type":"module"}\n', encoding="utf-8")
        for rel, content in modules.items():
            (moddir / PurePosixPath(rel).name).write_text(content, encoding="utf-8", newline="")
        report_file = Path(work) / "report.json"
        # The modules are model-written code, so the run gets nothing it could misuse: an empty
        # environment (no token, no secrets), and Node's permission model, under which it can read
        # the harness and the modules, write the one report, start its worker threads, and nothing
        # else -- no other file, no child process.
        cmd = [NODE_BIN, "--experimental-permission", f"--allow-fs-read={PIECE_HARNESS.parent}",
               f"--allow-fs-read={work}", f"--allow-fs-write={work}", "--allow-worker",
               str(PIECE_HARNESS), "--modules", str(moddir), "--out", str(report_file)]
        env = {"PATH": os.environ.get("PATH", ""), "HOME": work, "LANG": "C.UTF-8", "NODE_NO_WARNINGS": "1"}
        try:
            played = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                                    cwd=work, env=env, timeout=PIECE_TIMEOUT_SECONDS)
        except FileNotFoundError:
            raise BuildToolchainError(f"the piece harness needs Node, which was not found ({NODE_BIN!r})") from None
        except subprocess.TimeoutExpired:
            late = f"the pieces did not all finish within {PIECE_TIMEOUT_SECONDS}s of real time"
            return {PurePosixPath(rel).stem: {"id": PurePosixPath(rel).stem, "hasPiece": True, "ok": False,
                                              "problems": [late]} for rel in modules}
        try:
            report = json.loads(report_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise BuildToolchainError("the piece harness gave no report: "
                                      + one_line(played.stderr or played.stdout or "nothing", 500))
        return {entry["id"]: entry for entry in report.get("modules", [])
                if isinstance(entry, dict) and isinstance(entry.get("id"), str)}


def worlds_without_a_finish(site):
    """The listed worlds of `site` a visitor cannot finish, as {page: why}.

    A world is finished through its module: one that has no module, whose module exports no
    piece(), or whose piece the harness could not play to its end is a world a visitor opens and
    cannot complete, which is what the axiom forbids.
    """
    worlds = listed_worlds(site)
    if not worlds:
        return {}
    report = run_piece_harness(site)
    missing = {}
    for world in worlds:
        entry = report.get(world[:-len(PAGE_SUFFIX)])
        if entry is None:
            missing[world] = f"has no module at {module_of(world)}"
        elif not entry.get("hasPiece"):
            missing[world] = f"has a module, {module_of(world)}, that exports no piece()"
        elif not entry.get("ok"):
            problems = entry.get("problems") or ["its piece does not finish"]
            missing[world] = f"has a piece that cannot be finished ({problems[0]})"
    return missing


def check_completion(before, after):
    """Raise RejectedChange if the change from site `before` to site `after` leaves a world a
    visitor cannot finish.

    Only what this run breaks is refused, exactly as the eight checks above only refuse what this
    run breaks: a world that already could not be finished stays the site's own to repair -- every
    run is asked to -- and refusing every plan over it would leave no plan able to repair it. The
    one list of worlds is held to the same rule: a site that had it may not lose it, because the
    stage opens pieces from it.
    """
    if listed_worlds(before) and not listed_worlds(after):
        raise RejectedChange(
            f"every page must carry the one list of worlds (the #{WORLD_LIST_ID} JSON the layout "
            f"writes from _data/worlds.json), which the stage opens pieces from: {HOME_PAGE} has lost it")
    was = worlds_without_a_finish(before)
    for world, why in sorted(worlds_without_a_finish(after).items()):
        if world not in was:
            raise RejectedChange(f"every world must be a piece a visitor can finish: {world} {why}")


def apply_to(site, ops):
    """The site mapping `site` as it would be once `ops` have been applied."""
    after = dict(site)
    for action, target, content in ops:
        rel = target.relative_to(SITE_DIR).as_posix()
        if action == "write":
            after[rel] = content
        else:
            after.pop(rel, None)
    return after


def split_for_prompt(files):
    """Split the site into (shown, omitted): files whose content fits the prompt budget, and the
    names of the rest.

    While the whole site fits in the budget nothing is omitted, which is what lets a run federate
    across every page of it.

    The protected files are considered first, so they are the last to be left out: every run needs
    to be able to rewrite the home page, and to wire a page it adds into the sitemap. The other
    files are considered in a different random order each run: a file the model is not shown
    cannot be changed, and no file should stay unchangeable run after run.

    FIXED_FILES skip the budget entirely and go straight into the omitted list, which is exactly
    the protection the analytics, local-state and participation axioms want: validate_plan refuses
    to touch what was not shown, and the site's measurement, privacy, local-state and
    participation machinery never costs the prompt a byte.
    """
    def prompt_order(item):
        return (item[0] != HOME_PAGE, item[0] not in PROTECTED_FILES, item[0])

    spoken_for = PROTECTED_FILES | FIXED_FILES
    first = sorted((item for item in files if item[0] in PROTECTED_FILES), key=prompt_order)
    rest = [item for item in files if item[0] not in spoken_for]
    fixed = [rel for rel, _ in files if rel in FIXED_FILES]
    random.shuffle(rest)
    shown, omitted, used = [], fixed, 0
    for rel, content in first + rest:
        if used + len(content) > PROMPT_BUDGET_CHARS:
            omitted.append(rel)
            continue
        used += len(content)
        shown.append((rel, content))
    return sorted(shown, key=prompt_order), sorted(omitted)


def build_prompt(shown, omitted=()):
    system = (
        "You are the autonomous curator of a static website served from S3 behind a CDN. "
        f"Your mission, every single run: {MISSION}. What all of it has to add up to is {WHOLE} -- "
        "not a set of pages that happen to share a domain.\n\n"
        f"\"Interesting\" means one thing here, and it is the standard every change is held to: "
        f"{INTERESTING}. User engagement time is the measure. So judge a change by whether it "
        "gives a visitor a reason to stay and keep going -- something to play with, to discover, "
        "to be surprised by, to come back to one more time -- and not by whether it looks tidy or "
        "busy. A page nobody lingers on is not interesting however handsome it is, and coherence "
        "is worth doing because a site that holds together is one a visitor keeps exploring.\n\n"
        "ENVISION THE WHOLE FIRST. Every run begins this way, with no exceptions and nothing to "
        "decide about it: before you choose anything, read every file below and envision the site "
        "as one experience -- one navigation, one visual language, one through-line a visitor "
        "follows from the first page to the last. Then ask where what is there falls short of "
        "that: what the pages repeat, where they have drifted apart, which of them a visitor "
        "would not guess belong to the same site, and what the piece as a whole needs most right "
        "now. That look at the site as a whole is the first half of every run. What you do is the "
        f"second half, and it follows from what you saw, because the site has to become {WHOLE} "
        "and not a collection of individually decent pages.\n\n"
        "RE-FEDERATE, AGGRESSIVELY. This is the normal work of a run, not an alternative to it: "
        "every run should leave the site more of a single piece than it found it. Lift markup, "
        "styles and behaviour that the pages repeat into the shared files -- the layout and "
        f"partials in \"{INCLUDES_DIR}/\", a Sass partial in \"{SASS_DIR}/\", the shared "
        "stylesheet \"css/site.scss\" that every page links as \"css/site.css\", a shared "
        "script such as \"js/site.js\" -- and use them from every page that needs them. Give "
        "every page the same header and navigation, so the whole site is reachable from anywhere. "
        "Settle on one visual language and hold every page to it: palette, type, spacing, motion. "
        "Merge pages that overlap, and retire the ones that no longer earn their place: the site "
        "is better as fewer pages that belong together than as more that do not. Simplify, repair "
        "or remove what has stopped working. Be aggressive about it -- take on the consolidation "
        "that is overdue rather than the one that is merely easy, and do not leave a "
        "near-duplicate standing because no single page is to blame for it.\n\n"
        "ADD something -- new content, a new page, an interactive toy, better visuals, a hidden "
        "easter egg, a new way of querying a visitor's orientation, or a new world for an "
        "orientation that has none -- when a site that already holds together is what the whole "
        "needs next, because then it gets more interesting by growing. Adding is never a way "
        "around the paragraph above, though, and it is the exception rather than the default: "
        "whatever you add arrives already federated, in the same run, inside the shared layout, "
        "in the one visual language, wired into the one navigation, sharing the styles and "
        "behaviour it has in common with the rest. A page that stands apart leaves the site less "
        "of a whole, however good that page is on its own.\n\n"
        "A run whose entire change is a holistic improvement -- consolidating, unifying, merging, "
        "or only deleting -- is a complete and successful run. It needs no new page alongside it. "
        "The site becomes more interesting by becoming a single coherent whole, not only by "
        "growing, so do not add for the sake of adding: when the site is repetitive, scattered or "
        "inconsistent, re-federating it is the more interesting change. Either way, build on what "
        "is already there rather than starting over.\n\n"
        f"LEGIBLE TO A STRANGER. Everything above is held to one more standard, which no check can "
        f"judge and the prompt therefore has to: the site is {LEGIBLE}. Confusion spends "
        "engagement time as surely as boredom does, so hold every change to these six, and undo "
        "what already breaks them:\n"
        "- One name per page, used everywhere: its <title>, its <h1>, every link to it, the site "
        "map and the mood flow all say the same words, and the one list of pages is "
        "\"_data/worlds.json\". A link's label is the name of the page it opens, with nothing in "
        "front of it.\n"
        "- One sentence of plain purpose: a page's first line says what it is and what to do, in "
        "plain words. The site's own terms -- the threshold, an orientation, a world, the "
        "persona -- are explained once, where a visitor first meets them, and never used as if "
        "self-evident.\n"
        "- One way to do each thing: one navigation, one suggestion of where to go next, one index "
        "of every world, one place that asks. When a job already has a control, improve that "
        "control; never add a second beside it. The shared shell -- the header, the persona card and "
        "the index of every world, which is the feed -- gains nothing from a page: what a page "
        "offers lives inside its own <main>, under its own heading.\n"
        "- Content first, chrome small: the whole of the shared chrome is two marks floating over "
        "the page -- the sparkles logo in the upper left, which opens the site's navigation as a "
        "constellation, and the persona in the upper right -- and there is no app bar; a "
        "page's <main> is its feature and fills the first screen, unbordered, in the page's own "
        "palette; what follows it is the feed and nothing else, with no caption. Nothing shared "
        "keeps score, fills a meter, mints a title, logs a visitor's moves, or describes itself: "
        "no heading that names the grid under it, no line that counts the worlds or tells the "
        "visitor to keep scrolling. Every typographical region and every boundary draws on a "
        "visitor's attention, so none is spent on what the page already shows.\n"
        "- Copy speaks to the visitor, never about the machinery: no axioms, models, runs, "
        "federation, state documents or 'browser contexts' in anything a visitor reads. A status "
        "line says what is true now; nothing reads 'loading' or ends in an ellipsis unless "
        "something is loading, and nothing that scripting fills is written as if it already had.\n"
        "- Never a dead end: see POWERED DOWN, NEVER BROKEN.\n\n"
        "POWERED DOWN, NEVER BROKEN. Where a component depends on something the visitor has not "
        "done yet -- a saved sky, a kept list, storage this browser does not offer -- its only "
        "announcement of that is the solution, in place: the component presents as unpowered, not "
        "failed, and carries the one button that powers it by doing the prerequisite itself, in "
        "the background, writing to the shared state exactly as the visitor's own action would "
        "(overwriting what is there). Never \"make one on the wish constellation page first\"; "
        "never \"refresh after creating\". A quieter second choice may follow the button, never "
        "replace it: for the sky, a button that opens the persona, where stars are placed by hand. This "
        "holds when the prerequisite cannot be kept, too: a browser that stores nothing still gets "
        "the button, and what it seeds lasts for the page. The shared helper is "
        "window.interestingSite.unlock(host, { onReady }) in \"js/site.js\", styled by "
        "\"_sass/_unlock.scss\": pass it the element to power down and the function to run once a "
        "sky exists, and it renders the unpowered state, the 'seed a sky to begin' button and the "
        "quiet second choice, then calls back -- now, when the button is pressed, and again whenever "
        "the sky changes in the persona while the page is open. Every world that reads the saved sky "
        "uses it; follow its shape for any prerequisite it does not cover.\n\n"
        "How the site is built:\n"
        "What you write is source. A small build turns it into the files that are served, and only "
        "the built site is ever published or checked. The whole pipeline is two conventions:\n"
        "- An .html file is a template, with optional YAML front matter between --- lines and "
        "Nunjucks syntax in the body. \"layout: layout.njk\" wraps the page in the shared shell in "
        f"\"{INCLUDES_DIR}/layout.njk\", which writes the <head>, the stylesheet links and the "
        "closing tags, so the page itself is only its <main>; that layout documents the front "
        "matter it reads. Nothing in "
        f"\"{INCLUDES_DIR}/\" is a page: it holds the layouts and the partials other templates "
        "include. Because the body is a template, write any literal \"{{\" or \"{%\" inside "
        "{% raw %} ... {% endraw %}.\n"
        "- A .scss file compiles to .css at the same path, so \"css/site.scss\" becomes "
        "\"css/site.css\" and a page links the .css. A .scss file whose name starts with \"_\" is a "
        f"partial: it is built into whatever @use's it and never on its own, which is what "
        f"\"{SASS_DIR}/\" holds -- the palette, the base rules and the mixins every stylesheet "
        "shares. Every other file type is copied through untouched.\n"
        "- \"_data/worlds.json\" is data every template can read as `worlds`: the one flat list of "
        "the site's worlds, each with its file, its name, the orientation it answers to, the mood "
        "id that gives it its palette, the aspect ratio of its card and a one-line description, "
        "which is what the world's pieces are like. There are no groups: a world is a world, "
        "whether or not it reads the sky. The feed of every world (the index, as cards), the site "
        "map, the mood atlas and every world page's own <h1> are all rendered from it. Three "
        "things are not, and change with it by hand: the page's title in its front matter, its "
        f"worldName in {MOOD_SCRIPT}, and its <loc> in {SITEMAP}.\n"
        "- The one visual language is Material Design 3 (m3.material.io), written once in "
        f"\"{SASS_DIR}/\": the tokens in _tokens.scss (every M3 colour role derived with "
        "color-mix() from four seeds, --bg, --bg2, --accent and --accent2; the shape scale; the "
        "motion scheme; the elevation levels), the type scale as a mixin in _type.scss, and the "
        "components -- the floating logo and the chips of its constellation, the tonal, filled, "
        "outlined and text buttons, the chips, "
        "the slider, the text field, the sheet a page sits on, the filled card, the dialog, the "
        "feed's cards. A page uses the roles (var(--md-sys-color-primary), "
        "var(--md-sys-color-surface-container), var(--md-sys-shape-corner-large)) and the shared "
        "classes (main, .panel, .panel-title, .panel-note, .panel-status, .controls, button, "
        "a.action, .btn-filled, .btn-text, .row with input[type=range]) and never a colour, a "
        "radius or a font size of its own. A page's palette is its world's: the layout writes "
        "<html data-world='...'> from the list, and _mood.scss gives every mood its four seeds, "
        "so a page stylesheet holds only what is true of that page alone, which is often "
        "nothing but a cursor.\n"
        "- Every page ends in the feed (\"_includes/worlds.njk\" and \"js/feed.js\"): every world "
        "as a card in masonry columns, which keeps dealing as a visitor scrolls -- the things the "
        "worlds make, between the worlds themselves, without end. It has no caption: its heading "
        "is for screen readers only, and it says nothing about itself. A world's part in it is its "
        "module, \"js/modules/<world>.js\", an ES module exporting { id, needsSky, paint(ctx, w, "
        "h, env), animate(ctx, w, h, env, t), spark(env), piece(env) }: paint draws its card in the "
        "world's own palette, spark makes one thing for the feed to deal (a title, a line, a "
        "readout, with or without a picture), piece makes the piece the stage plays when the card "
        "is opened (the axiom below), needsSky says it reads the persona's stars. js/feed.js "
        "documents the card half of the contract and what env carries; js/stage.js the piece "
        "half. Pressing a card opens its piece on the page's stage and takes the card out of the "
        "feed; a finished piece is followed by the next card in the feed's order.\n"
        "- \"js/persona.js\" is the persona: the one thing a visitor configures here, shown as the "
        "avatar floating in the upper right of every page and set up in the sheet that avatar "
        "opens, the way an app shows its account. It holds the sky that several worlds read -- "
        "placed, moved and read there, and nowhere else -- and shows the reading the mood flow has "
        "taken. A page reads the sky through window.interestingPersona.stars(), changes it only "
        "through window.interestingPersona.addStar() and its kin, and follows changes through "
        "window.interestingPersona.onSky(fn) or the unlock helper below. No page places stars "
        "itself, and no page adds a second way to open the persona: the avatar is the one way. "
        "The threshold alone hosts the sideways question in its <main> (#persona-probe), so the "
        "question is asked in that page's feature and never in the chrome.\n"
        "- The whole of the site's navigation is \"_includes/layout.njk\" and \"js/site.js\": the "
        "sparkles logo floating in the upper left of every page, which says the site's name on "
        "rollover and opens a lightbox with the navigation branching out of it as a constellation "
        "of chips, and the persona floating opposite it. There is no app bar and no nav of a "
        "page's own: a page that wants to send a visitor somewhere does it in its own prose, "
        "inside its <main>. The logo is a <details> whose summary is the mark, so the disclosure "
        "and the keyboard are the browser's and the options are plain links with no script at "
        "all; js/site.js places the stars, holds the page still behind the lightbox, and settles "
        "which options are in the constellation, since the set changes with the visitor's state. "
        "The near orbit is the destinations (\"_data/worlds.json\" wayIn, and the world a reading "
        "opens onto once there is one) and the far orbit is the apparatus (\"cookies\", "
        "\"state\", and the finePrint pages). Styled in \"_sass/_nav.scss\".\n"
        "- A page's <main> is its feature. It is unbordered and full-bleed, the page's own palette "
        "washing to the viewport's edges, and at least the first screen tall (the viewport less "
        "the room the floating nav leaves and a margin), so the feed peeks above the fold; every "
        "direct child of <main> lands in one centred column (_panel.scss). A world page's <main> "
        "is the stage: the page "
        f"is nothing but front matter and {{% set stageWorld = 'thing' %}}{{% include "
        f"'stage.njk' %}}, and \"{STAGE_INCLUDE}\" with \"{STAGE_SCRIPT}\" (styled by "
        "_sass/_stage.scss) does the rest -- the world's name, the piece's title and line, the "
        "scene beside the knobs, the progress, the finish, the vanish and the next. The "
        "threshold's feature is the same stage in its asking state: the question itself, and once "
        "answered a piece of the world the reading opens onto.\n"
        "So one new world is four edits: \"thing.html\", which is front matter naming the layout "
        "and the two lines that include the stage, its line in \"_data/worlds.json\" with a mood "
        "and an aspect, its module \"js/modules/thing.js\" with its card and its piece, and its "
        f"<loc> in {SITEMAP} (plus an orientation in js/threshold.js if it is to be offered, and a "
        "palette in _mood.scss if its mood is new). A world needs no stylesheet of its own: its "
        "scene is drawn, not styled.\n"
        "A plan whose source does not build is refused, so keep the templates and the stylesheets "
        "valid, and change the shared files with the care they deserve: the layout and "
        f"\"{SASS_DIR}/\" reach every page at once.\n\n"
        "Rules:\n"
        "- Only files of these types: "
        + ", ".join(sorted(ALLOWED_EXTENSIONS)) + ". No external "
        "dependencies that require keys, nothing harmful or deceptive. The site's own analytics, "
        "described below, are the only measurement it carries and the only one it needs: add no "
        "tracking, telemetry, beacon or third-party script of your own.\n"
        "- Paths are relative to the site root (e.g. \"index.html\", \"css/style.css\"). "
        "Use relative links between pages, so the site works wherever it is published. "
        "File and folder "
        "names may only contain lowercase letters, digits, \".\", \"_\" and \"-\", and only a "
        "leading \"_\" is allowed, which is how the build marks what is not a page.\n"
        f"- index.html, error.html and {SITEMAP} must always exist and remain valid.\n"
        "- AXIOM, every run: all of the content stays reachable from the root. index.html must "
        "lead to every page of the site -- directly, or by following links through the pages it "
        f"leads to, such as a site map page -- and {SITEMAP} must list every page. Wire a page you "
        "add into both in the same run, and take a page you delete out of both: a plan that leaves "
        f"a page the root cannot reach is refused. {SITEMAP} is a sitemaps.org urlset whose <loc> "
        "values are the same relative paths used in links, because the site has no fixed domain. "
        "This is checked on the built site, so the pages it counts are the ones the templates "
        "produce, and a layout or a partial is not one of them.\n"
        "- AXIOM, every run: every page carries the site's analytics and cookie consent banner. "
        f"One line in the <head> of a page brings both:\n    {ANALYTICS_TAG}\n"
        "Keep that line on every page you rewrite, exactly as it is, and put it on every page you "
        "add (a page in a sub-folder uses the matching relative src, such as "
        f"\"../{ANALYTICS_SCRIPT}\"). It loads a consent banner and, only once a visitor accepts, "
        f"Google Analytics. The files behind it ({', '.join(sorted(ANALYTICS_FILES))}) are fixed: they "
        "are not shown to you, you may not write or delete them, and they need nothing from you. A "
        "plan that leaves a page of the site without that line is refused.\n"
        "- AXIOM, every run: every page is responsive and accessible. It works on a small phone as "
        "well as a wide desktop, and it works for a visitor who cannot see it, cannot use a mouse, "
        "or has asked their system for less motion. Hold to WCAG 2.2 level AA. Concretely, on every "
        "page you write: a <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> "
        "that does not forbid zooming; lang on <html>; a <title>; exactly one <main> landmark, with "
        "headings that start at <h1> and skip no level; alt on every <img> (alt=\"\" if it is purely "
        "decorative); an accessible name on every link, button and form control, from its own text, "
        "a <label for>, or aria-label; a visible :focus-visible style wherever you take the "
        f"browser's outline away; no positive tabindex; and a {REDUCED_MOTION} rule, in CSS or "
        "through matchMedia, wherever the page animates. Lay out with fluid units, wrapping and "
        "media queries so that nothing overflows sideways at 320px wide, keep tap targets around "
        "44px, and keep text contrast at 4.5:1. A plan that makes a page fail the mechanical half "
        "of this is refused, exactly as one that orphans a page is. This is checked on the built "
        "site, so a layout or a Sass partial is judged through the pages and stylesheets it "
        "produces.\n"
        "- AXIOM, every run: every page carries the site's local-state store and its meta menu. "
        f"One line in the <head> of a page brings both:\n    {STATE_TAG}\n"
        "Keep that line on every page you rewrite, exactly as it is, and put it on every page you "
        "add (a page in a sub-folder uses the matching relative src, such as "
        f"\"../{STATE_SCRIPT}\"). It is not deferred on purpose: a page's own script runs while the "
        "body is parsed, which is before any deferred script, so the store has to be there "
        "already. Everything this site keeps in a visitor's browser lives in one JSON document, "
        "and no page may touch localStorage or sessionStorage itself -- a plan in which one does "
        "is refused. This is read of a page along with every script and stylesheet it loads, so a "
        f"shared file counts as the pages that load it: {MOOD_SCRIPT} keeps its reading through "
        "the store for exactly that reason. Read and write through the shared store:\n"
        "    var state = window.interestingState;\n"
        "    var saved = state.read('constellation', []);  // { status, value }, where status is\n"
        "                                                  // 'ok', 'missing', 'unreadable' or\n"
        "                                                  // 'unavailable' and value is the\n"
        "                                                  // fallback unless it is 'ok'\n"
        "    state.get('omens', []);                       // just the value, or the fallback\n"
        "    state.set('omens', omens);                    // false if it could only be kept in\n"
        "                                                  // memory, which is worth telling a\n"
        "                                                  // visitor in the page's own words\n"
        "The store owns the parsing, the defaults and every failure path, so a page needs no "
        "try/catch and no JSON.parse of its own. The names the site keeps today are "
        "\"constellation\" (the sky several pages reinterpret), \"capsules\", \"omens\", "
        "\"threshold\" (what the mood flow has read about this visitor), \"kiln\", \"loam\", "
        f"\"quiet-room\" and \"apocrypha\"; to keep something new, pick a name and set it. "
        f"{STATE_SCRIPT} is fixed like "
        "the analytics files: it is not shown to you, you may not write or delete it, and the very "
        "small meta menu it puts in the corner of every page -- where a visitor copies that "
        "document out, pastes someone else's in, or clears it -- is not yours to change or to "
        "restyle. Leave room for it: it sits in the bottom-right corner, opposite the consent "
        "banner's button in the bottom-left, with the participation button of the axiom below "
        "between the two.\n"
        "- AXIOM, every run: nothing on the site is tied to an update frequency. This site "
        "iterates continuously. It runs no nightly experiment and publishes no daily or hourly "
        "edition, so no page may say or imply that it does: never write \"Tonight's experiment\", "
        "\"today's sky\", \"this week's theme\" or \"rewritten every hour\". Never defer a visitor "
        "to another day either -- not \"move one star tomorrow and ask again\" but \"move one star "
        "and ask again\" -- because engagement time is the measure and the next move is the one "
        "worth asking for. Concretely, these are refused in anything a page carries, markup, "
        "script and comments alike: the words tonight, tomorrow, yesterday, hourly, nightly, daily "
        "and weekly; the possessives today's, this hour's, this week's and this month's; and "
        "\"every hour\", \"each day\", \"once a week\" and the rest of that family. Night-sky "
        "atmosphere is untouched and welcome: midnight, dusk, night, starlight and the like name a "
        "mood, not a schedule, so \"midnight rain\" and \"before midnight\" are fine. A plan that "
        "adds one of the refused phrasings to a page is refused, and this too is checked on the "
        "built site, including the shared scripts and stylesheets a page loads.\n"
        "- AXIOM, every run: the site asks before it offers. The whole population is the target "
        "of interest, not the part of it that happens to like whatever aesthetic the site is "
        "wearing, so no page may put particular content in front of a visitor on the assumption "
        "that they want it. The site makes an effort to ascertain their mood or mental "
        "orientation first, and what is offered follows from that. One line in the <head> of a "
        f"page carries the whole flow:\n    {MOOD_TAG}\n"
        "Keep that line on every page you rewrite and put it on every page you add, exactly as "
        f"with the analytics line above. \"{MOOD_SCRIPT}\" holds the orientations, the world "
        "each one opens onto, the library of query mechanisms, the clock and time-zone signals "
        "read alongside an answer, and how much of a past visit is remembered. Unlike the "
        "analytics files it is yours to rewrite and extend; it may never be deleted. Three "
        "things about how the asking is done, each of them refused in code:\n"
        "  * Query, never self-report. Ask about a door, a stone, the thing they would put in a "
        "pocket, the rate at which they tap, how long they hold a button down, where they put "
        "one mark in an empty field. Never ask a visitor to name their own state: \"how are you "
        "feeling\", \"how do you feel\", \"how are you doing\", \"what's your mood\", "
        "\"pick your mood\", \"rate your energy\", \"describe your feelings\" and the rest "
        "of that family are refused outright, in markup, script and comments alike.\n"
        "  * Never the same way twice. The site keeps at least "
        f"{MIN_MOOD_PROBES} distinct query mechanisms, each one declaring itself as "
        "probe: 'some-id', and a plan that leaves fewer than that is refused. Inventing another "
        "mechanism is the single most interesting change there is to make here, and a run whose "
        "whole change is one new mechanism -- or one new world for an orientation that has "
        "none -- is a complete and successful run.\n"
        "  * Never a gate. The query is an offer. Every page stays reachable with it ignored, "
        "declined, or scripting switched off altogether, which is what the reachability axiom "
        "demands anyway: do not hide a world behind an answer.\n"
        "This is checked on the built site, like the five above.\n"
        "- AXIOM, every run: every page carries a visitor's way of steering this site. One line "
        f"in the <head> of a page brings it:\n    {PARTICIPATE_TAG}\n"
        "Keep that line on every page you rewrite, exactly as it is, and put it on every page you "
        "add (a page in a sub-folder uses the matching relative src, such as "
        f"\"../{PARTICIPATE_SCRIPT}\"). It draws the prominent button in the middle of the bottom "
        "edge of every page -- \"steer the site\" -- which sends whoever is reading to a new issue "
        "on this repository, with the issue form already chosen and the page they were on already "
        f"filled in. {PARTICIPATE_SCRIPT} is fixed like the analytics files and the local-state "
        "store: it is not shown to you, you may not write or delete it, and neither the button nor "
        "its wording is yours to change, to restyle or to reproduce. It is the one thing on this "
        "site that answers to the person reading it rather than to you, which is why no run may "
        "touch it: every other word here is yours to rewrite, so the way to say something about "
        "that cannot be. A plan that leaves a page of the site without the line is refused, and "
        "this too is checked on the built site. Three affordances belong to the fixed files and to "
        "no page -- the consent banner's \"cookies\" button, this \"steer the site\" button in the "
        "middle of the bottom edge, and the local-state \"state\" menu. Leave the bottom edge to "
        "them: nothing of yours goes there, and nothing of yours restyles them, reproduces them or "
        "rewords them. The shared shell adopts two of them into the main nav rather than copying "
        "them: \"js/site.js\" hides the corner buttons that js/analytics.js and js/state.js draw "
        "for themselves and offers \"cookies\" and \"state\" in the logo's constellation, which "
        "presses those same buttons -- so there is still exactly one of each on the site and "
        "neither fixed file is touched. Keep it that way: never draw a second cookies or state "
        "control of your own. Inviting a visitor to steer the site in a page's own prose is "
        "welcome, and is not a substitute for the line.\n"
        "- AXIOM, every run: caution before a destructive action is a law of the site and not a "
        "page's own choice. Any control that throws a visitor's saved state away reads as a "
        f"warning button -- class=\"{WARNING_CLASS}\" -- and every press of one opens the one "
        "shared modal that asks \"are you sure you want to ______?\" with the specific thing "
        "about to go in the blank (\"clear your constellation\", not \"are you sure?\"). Both "
        "halves are about consistency, not friction: the button is recognised before it is read, "
        "and the question is the same question everywhere. There is no arming step beyond "
        "them -- no checkbox, no toggle, no hold-to-arm press -- and the modal is a plain "
        "confirm/cancel: never ask a visitor to type a word or press twice. One shared component "
        "writes all of it, and every destructive control on the site uses that one:\n"
        f"    window.interestingSite.destructive(button, {{\n"
        f"      what: 'clear your omen archive',      // the blank, in the site's own voice\n"
        f"      detail: function () {{ return 'The ' + omens.length + ' omens would go.'; }},\n"
        f"      when: function () {{ return omens.length > 0; }},  // nothing to lose, nothing to ask\n"
        f"      onConfirm: clearHistory, onCancel: function () {{ say('As it was.'); }}\n"
        f"    }});\n"
        f"It lives in \"{DESTRUCTIVE_SCRIPT}\" and is painted by \"{SASS_DIR}/_controls.scss\" "
        f"through \"{SHARED_STYLESHEET}\"; both are yours to rewrite, but a plan that leaves the "
        "site without the component, or without that warning styling, is refused. Where the "
        "caution begins, because there is a spectrum of severity:\n"
        "  * Above the threshold, and held to both halves: a press that is nothing but a loss -- "
        "the whole local-state document goes, or the whole of one name in it (a sky, a reading, a "
        "kept list), and nothing takes its place.\n"
        "  * At the threshold, and held to the modal but not the warning: a trade rather than a "
        "loss -- the whole of a name goes but something the visitor asked for arrives in its "
        "place, as with seeding a fresh sky over a placed one. Use "
        "window.interestingSite.areYouSure(options) for those, with `opener` naming the control.\n"
        "  * Below the threshold, and held to neither: one thing rather than the whole thing, and "
        "anything that only changes what is on the screen.\n"
        "Two consequences in code. A control named with one of these words -- in its own text or "
        "in the aria-label or title that names it -- is read as destructive and refused without "
        "the warning class, in the markup of the page as you commit it: "
        "clear, forget, empty, erase, wipe, delete, discard, throw away, throw out. Name a control "
        "that takes one item out of a list \"remove\" instead -- that is the site's word for it, "
        "and it is below the threshold. And window.confirm is refused outright, anywhere in a page "
        "or a script it loads: a browser dialog cannot say which of a visitor's things is about to "
        "go, and a question that reads differently on every page is not a safety switch.\n"
        "- AXIOM, every run: every world is a piece a visitor can finish. A world's page is not "
        "fixed content but a stage, and what a visitor opens there is a piece: a small, randomly "
        "configured item -- think of a fidget toy with a few levers and knobs on it -- generated "
        "on the spot by the world's module from a seed, with a clear flow that asks them to make a "
        "few choices and finish, expediently. When it is finished the whole piece vanishes with "
        "some ceremony and the next card in the feed opens in its place, so one piece follows "
        "another without end and no two are quite the same; the river of cards is the river of "
        f"pieces. Concretely: every listed world's module exports piece(env), and \"{STAGE_SCRIPT}\" "
        "documents the contract and runs it. A piece is { title, brief, aspect, steps, start(ctx), "
        f"apply(id, value, ctx), frame(t, dt, ctx), tap(x, y, ctx), end(ctx) }}: {PIECE_MIN_STEPS} to "
        f"{PIECE_MAX_STEPS} knobs (steps), each {{ id, ask, kind, ... }} of a kind the stage renders -- "
        "choice (two to four options), toggle, range, press, hold, tap, wait -- and it is finished "
        "when every knob is set (a tap or a wait knob is set by the piece itself, through "
        "ctx.satisfy(id); a tap anywhere on the scene must count, because the stage's own 'tap "
        "for me' button and the check tap at random points; only a tap or a wait knob is the "
        "piece's to set, and never before the visitor has set something), or, with auto: false, "
        "when it calls ctx.complete() -- and it is finished by its visitor, never by itself "
        "before they have set a knob. frame's t is seconds since the piece started. The same seed "
        "makes the same piece and different seeds make different pieces. A piece is pure drawing "
        "and arithmetic on what the stage hands it (ctx: the canvas and its 2d context, the size, "
        "the world's colours, a seeded random source, the stars, status(), progress()) and never "
        "reaches for the document, the window, the clock, Math.random or the browser's storage; "
        "a module imports nothing and is self-contained. The "
        "world's old interactive page is the piece's material, and re-thinking a world as a piece "
        "is the normal work of a run: what it let a visitor do becomes the knobs, what it showed "
        "becomes the scene, what it said becomes the title and the one line under it, in the "
        "site's own voice. Make the pieces differ as much as they can, between worlds and between "
        "seeds of one world: a second shape of piece for a world is as good a change as a new "
        "world. This is checked on the built site by playing every piece to its end without a "
        f"browser (\"{PIECE_HARNESS_REL}\", which a run cannot change): a plan that leaves a listed "
        "world without a module, without a piece, with a piece that does not finish within "
        f"{PIECE_MAX_TAPS} taps and {PIECE_MAX_SECONDS} seconds of play, that is not the same for the "
        "same seed, or that is the same for every seed, is refused.\n"
        "- Leave the site working at the end of the run. If you extract something into a shared "
        "file, or merge or delete a page, update every page that refers to it in the same run: "
        "never leave a link, a stylesheet, a script, a layout or an @use pointing at something "
        "that is not there.\n"
        f"- Keep each file small (at most {MAX_FILE_BYTES // 1000} KB); return the COMPLETE new "
        "content of every file you change.\n"
        f"- At most {MAX_CHANGES} files per run, and keep the whole answer inside your output "
        "limit: an answer that is cut off is discarded. A federation too large for one answer is "
        "better carried out in coherent stages, one per run, than attempted all at once.\n\n"
        "Respond with ONLY a JSON object, no prose and no markdown fences, shaped as:\n"
        '{"summary": "one sentence describing this change", '
        '"files": [{"path": "index.html", "content": "<full file content>"}], '
        '"delete": ["old-page.html"]}\n'
        "Either list may be empty or absent as long as the other has something in it: a plan that "
        "only deletes is accepted and applied like any other.\n"
        "It must be valid JSON, or it is discarded. Inside each \"content\" string write every "
        "line break as \\n, every double quote as \\\" and every backslash as \\\\ (so a "
        "JavaScript '\\n' or \\d becomes '\\\\n' or \\\\d)."
    )
    parts = [f"=== {rel} ===\n{content}" for rel, content in shown]
    total = len(shown) + len(omitted)
    user = (f"Current contents of the website, {total} file{'s' if total != 1 else ''} in all:\n\n"
            + "\n\n".join(parts))
    if omitted:
        user += (
            "\n\nOther existing files, whose content is not shown to you: " + ", ".join(omitted)
            + "\nYou cannot see these files, so you may not change or delete them. Still count "
            "them as part of the piece when you weigh the site as a whole, and keep whatever you "
            "do compatible with them. Most are left out only for size, and a different selection "
            "is shown each run, so a federation that has to reach one of those can be carried on "
            "by a later run."
        )
    user += (
        f"\n\nThis run's mission: {MISSION}, measured in {INTERESTING}. Envision all of the above "
        f"as {WHOLE} -- one navigation, one visual language, one through-line -- and then make the "
        "one change that brings it closest to being that: re-federate what is already there, "
        f"aggressively, and add something new only as part of the same whole. Keep it {LEGIBLE}: one "
        "name per page, one way to do each thing, content before chrome, and never a dead end. "
        "Respond with the JSON object only."
    )
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

    A plan that would leave a page of the site unreachable from the root, leave one without the
    analytics and consent line, make one fail the responsive-and-accessible axiom, leave one without
    the local-state store and its meta menu, tie one to an update frequency, stop the site asking
    before it offers, leave one without a visitor's way of steering the site, let a control throw a
    visitor's saved state away without the shared warning button and its confirmation, or leave a
    world a visitor cannot finish is refused: all nine axioms hold however the prompt is answered.
    All nine are judged on the built site (issue #25), which is the only site a visitor ever sees,
    so the plan is built before any of them is asked, and a plan that does not build is refused for
    that alone.
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
        if rel in FIXED_FILES:
            raise RejectedChange(f"refusing to rewrite {rel}: the fixed files carry the analytics "
                                 "tag, the consent banner, the local-state store with its meta "
                                 "menu and a visitor's way of steering the site, and are not a "
                                 "model's to change")
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
        if rel in PROTECTED_FILES or rel in FIXED_FILES:
            raise RejectedChange(f"refusing to delete {rel}")
        if rel in unseen:
            raise RejectedChange(f"refusing to delete {rel}: its content was not shown to the model")
        ops.append(("delete", target, None))
    before = dict(read_site())
    try:
        built_after = build_site(apply_to(before, ops))
    except BuildError as err:
        raise RejectedChange(f"the site does not build with this change: {one_line(err, 500)}") from None
    try:
        built_before = build_site(before)
    except BuildError as err:
        # The site as committed does not build, so there is no "before" to compare against and the
        # axioms have nothing to say this run. Same reasoning as check_reachability's: every run is
        # asked to repair the site, and refusing a plan over damage it did not do would leave no
        # plan able to. This run still had to build, and the next is held to all nine axioms again.
        print(f"::warning::the site as committed does not build ({one_line(err, 300)}), so this "
              "run's change was only checked for building, not against the axioms")
        return ops
    check_reachability(built_before, built_after)
    check_analytics(built_before, built_after)
    check_accessibility(built_before, built_after)
    check_state(built_before, built_after)
    check_cadence(built_before, built_after)
    check_mood(built_before, built_after)
    check_participate(built_before, built_after)
    check_destructive(built_before, built_after)
    check_completion(built_before, built_after)
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
    require_build_toolchain()

    shown, omitted = split_for_prompt(read_site())
    prompt = build_prompt(shown, omitted)
    candidates = pick_candidates()
    requested = bool((os.environ.get("MODEL") or "").strip())  # named by hand, not drawn from the pool
    attempts, unavailable, tried = 0, [], set()

    def report_unavailable():
        # Worth saying out loud: when most of the pool is off limits, the pick is hardly random.
        # Only the models tried this run are known; the rest of the pool was never asked.
        if unavailable:
            pool = "" if requested else f"The pool has {len(candidates)}. "
            print(
                f"::notice::{len(unavailable)} of the {len(tried)} models tried this run are not "
                f"available to this Copilot account ({one_line(', '.join(unavailable), 300)}). "
                f"{pool}See Setup in the README."
            )

    queue, answering = list(candidates), []
    while queue and attempts < MAX_ATTEMPTS:
        model = queue.pop(0)
        print(f"Mission: {MISSION}\nModel:   {model}", flush=True)
        tried.add(model)
        attempts += 1  # counted up front, so every path below that asks again is bounded
        try:
            plan = parse_response(call_model(model, prompt))
            ops = validate_plan(plan, unseen=omitted)
        except ModelUnavailable as err:
            attempts -= 1  # no model was asked, so this does not count as an attempt
            more = ", trying another model" if queue or answering else ""
            print(f"{model} is not available{more}: {one_line(err, 200)}")
            unavailable.append(model)
        except CopilotAuthError as err:
            print(f"::error::GitHub Copilot authentication failed: {one_line(err, 300)}")
            sys.exit(AUTH_HELP)
        except SiloBreach as err:
            sys.exit(f"Stopping without applying anything: {err}. The Copilot CLI flags no longer disable every tool.")
        except BuildToolchainError as err:
            # Not this model's fault and not the next one's either: nothing can be checked.
            sys.exit(f"Stopping without applying anything: the build could not be run ({err}).")
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
    sys.exit("No model produced a usable change this run.")


if __name__ == "__main__":
    main()
