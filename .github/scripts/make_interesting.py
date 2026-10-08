#!/usr/bin/env python3
"""Make the website more interesting: one run grows it, the next consolidates it.

Picks one of the heaviest models GitHub Copilot offers, at near-maximum reasoning
effort, shows it the current contents of the /site folder, and asks it to work on
the website. Runs alternate between two kinds (run_kind()): an odd-numbered run
makes the site more interesting, and an even-numbered run adds nothing and
instead consolidates, federates, refactors and cleans up what is there.

Every run of either kind starts the same way, unconditionally: the model is told
to envision the site as one experience -- one navigation, one visual language,
one through-line -- before it chooses anything. WHOLE names what that experience
has to be. A growing run then makes the one change that most lengthens a
visitor's stay, and whatever it adds arrives federated in the same run. A
consolidating run lifts repeated markup, styles and behaviour into the shared
files, unifies navigation and visual language across every page, merges or
retires pages that overlap, and removes what has stopped earning its place. So
the site is made more interesting by becoming one piece and not only by growing,
and each kind of run gets a whole answer to itself.

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
    link that sends a visitor to a pre-shaped new issue on this repository --
    which the shared shell adopts into the logo's constellation as "change this
    site". check_participate() refuses a plan that would leave a page without
    it, and the file behind it is fixed like the analytics and state ones: a
    visitor's way of saying what this site should become is not a run's to
    reword, move or drop.
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

An answer that holds to all nine is then held to the repository's own tests, the
ones deploy.yml runs before every deploy: require_passing_tests() runs test.yml's
command on a copy of the repository with the change applied, and refuses the
answer if any test fails. A refused answer is never written, and if main moves on
before the push, the workflow runs the tests again on the rebased commit, so the
hourly run cannot push a commit that blocks the deploy.

A refused answer is not the end of the model's turn, though. The model is shown
its own answer and the refusal -- the failing tests by name and message, the edit
that matched nowhere, the axiom the change broke -- and asked for the whole plan
again with that put right, up to REPAIR_ROUNDS times, before the run moves on to
another model (see repair_feedback and main). The change itself travels as edits
wherever it can: a file that exists is changed by quoting the passages that change
(apply_edits), and only a new file, or one rewritten end to end, is sent whole. That
is what keeps an answer inside a model's output limit and inside the quarter of an
hour it has to write it, which is where most of a day's runs were being lost. A
run that loses an answer to the limit or to the clock all the same asks the rest of
its calls to think one step less hard (lower_effort), and no call is started past
the run's own deadline (RUN_BUDGET_SECONDS), so the hourly cadence holds.

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
import time
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

# The two kinds of run, which alternate: a run either grows the site or consolidates it, never
# both in one answer. An odd-numbered run makes the site more interesting and an even-numbered
# run consolidates, federates, refactors and cleans up. The number is the workflow's own
# (github.run_number, passed in as RUN_NUMBER), so which kind a run was is visible in the run's
# name, and `n % 2` is the whole of the rule. RUN_KIND names a kind outright (the workflow's
# manual "kind" input), and a run with neither -- the script run by hand -- grows the site.
#
# Why alternate rather than ask every run for both, as the prompt used to: a run told to federate
# aggressively and to add something arrives at neither. It adds a page and tidies a stylesheet,
# and the consolidation that is overdue stays overdue. Giving each kind the whole of a run lets
# the growing run spend its answer on the change that most lengthens a visitor's stay, and the
# consolidating run spend its answer on the merge that touches forty files, with nothing new to
# make room for. A run the guard skips, or one that fails, still takes a number, so two runs of
# one kind can occasionally land in a row; the alternation is a rhythm, not an invariant.
INTERESTING_RUN = "interesting"
CONSOLIDATION_RUN = "consolidate"
RUN_KINDS = (INTERESTING_RUN, CONSOLIDATION_RUN)

# What a consolidating run serves, in every place MISSION serves a growing run: the opening of the
# prompt, the line it reads last, the console line and clean_summary's fallback.
CONSOLIDATION_MISSION = ("consolidate, federate, refactor and clean up the website into a single "
                         "coherent whole")

# The first words of the commit message and of the run summary, by kind: what a reader of
# `git log` sees before the model's own sentence. The workflow reads them from the "headline"
# output rather than carrying a prefix of its own.
HEADLINES = {
    INTERESTING_RUN: "Make the website more interesting",
    CONSOLIDATION_RUN: "Consolidate the website",
}


def mission_of(kind):
    """The mission a run of this kind serves."""
    return CONSOLIDATION_MISSION if kind == CONSOLIDATION_RUN else MISSION


def run_kind():
    """Which kind of run this is.

    RUN_KIND, if it names one, wins: it is a person's choice through the workflow's manual input.
    Otherwise the parity of RUN_NUMBER decides -- odd grows the site, even consolidates it -- and
    a run with neither is a growing run.
    """
    named = (os.environ.get("RUN_KIND") or "").strip().lower()
    if named in RUN_KINDS:
        return named
    if named and named != "auto":
        print(f"::warning::RUN_KIND {one_line(named, 60)!r} is not one of {', '.join(RUN_KINDS)}; "
              "deciding by run number instead.")
    number = (os.environ.get("RUN_NUMBER") or "").strip()
    if number.isdigit():
        return CONSOLIDATION_RUN if int(number) % 2 == 0 else INTERESTING_RUN
    return INTERESTING_RUN

COPILOT_BIN = os.environ.get("COPILOT_BIN", "copilot")

# The models a random pick may draw from: only the heaviest models, as of 2026-10-06. These are
# the top of each provider's current line as GitHub Copilot CLI offers it through `--model`, and
# nothing older or lighter: Anthropic's Fable and the Opus beneath it, the Sol and Astra lines of
# OpenAI's GPT-6, and Moonshot's Kimi K3. Every run goes to one of them at near-maximum reasoning
# effort (see REASONING_EFFORT below): the heaviest model there is, thinking as hard as it can
# short of the limit, and nothing less. So flagships of an earlier generation (claude-opus-5,
# claude-opus-4.8, gpt-5.6-sol), the general-purpose model a tier down (gpt-5.5) and the
# coding-tuned sibling (gpt-5.3-codex) are deliberately absent, and small and mid-tier models
# always were: is_small_model() below refuses the ones it can recognise even if one is added.
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
    "gpt-6.1-sol",
    "gpt-6-sol",
    "gpt-6-astra",
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

# How hard the model is asked to think. Every run goes to one of the heaviest models at
# near-maximum reasoning effort: "xhigh", one step below the CLI's "max", on the scale Copilot CLI
# 1.0.91 accepts through `--reasoning-effort`. The REASONING_EFFORT repository variable overrides
# it, and "none" sends no flag at all, leaving the model at its own default. Not every model has
# an effort dial, and the CLI's wording for one that does not is not known here, so call_model()
# asks once more without the flag when the CLI's error names the effort or the reasoning: a heavy
# model without a dial is still the heavy model, and the run should not lose it over the flag.
REASONING_EFFORT_LEVELS = ("none", "minimal", "low", "medium", "high", "xhigh", "max")
DEFAULT_REASONING_EFFORT = "xhigh"


def reasoning_effort():
    """The effort level to ask for: REASONING_EFFORT if set, else the default; "" for none."""
    level = (os.environ.get("REASONING_EFFORT") or "").strip().lower() or DEFAULT_REASONING_EFFORT
    if level == "none":
        return ""
    if level not in REASONING_EFFORT_LEVELS:
        print(f"::warning::REASONING_EFFORT {one_line(level, 40)!r} is not one of "
              f"{', '.join(REASONING_EFFORT_LEVELS)}; using {DEFAULT_REASONING_EFFORT}.")
        return DEFAULT_REASONING_EFFORT
    return level


def effort_flags(effort):
    """The CLI flags that ask for `effort`, or none for ""."""
    return ["--reasoning-effort", effort] if effort else []


# The least a run steps the reasoning effort down to (lower_effort). A run starts every call at the
# effort asked for above; once an answer has run past the model's output limit or the clock, the
# rest of that run's calls are asked for one step less, and so on down to this. Why: on 2026-10-07
# three runs in five were lost to exactly those two failures, at xhigh, by the heaviest models in
# the pool, and an answer that never arrives has no quality to weigh. The step is per run, never
# remembered, so every run still opens at the effort the repository asks for.
LOWEST_FALLBACK_EFFORT = "medium"


def lower_effort(effort):
    """One step less reasoning than `effort`, never below LOWEST_FALLBACK_EFFORT; "" (no flag)
    and a level already at or under the floor stay as they are."""
    if effort not in REASONING_EFFORT_LEVELS:
        return effort
    floor = REASONING_EFFORT_LEVELS.index(LOWEST_FALLBACK_EFFORT)
    at = REASONING_EFFORT_LEVELS.index(effort)
    return effort if at <= floor else REASONING_EFFORT_LEVELS[at - 1]


# How much the model is asked for room to write in one answer, in tokens (issue #77). A run that
# rewrites half the site writes a long answer, and an answer that runs past the model's output
# limit is cut off mid-run and thrown away, so the budget is asked for as large as every model in
# the pool can be expected to grant: 64k output tokens, roughly a quarter of a megabyte of JSON,
# which is the cap the current flagships carry. The MAX_OUTPUT_TOKENS repository variable
# overrides it, and "none" (or 0) asks for nothing, leaving every model at its own default.
#
# Copilot CLI 1.0.91 -- the pinned version, whose flags this silo relies on -- has no flag for it.
# The only maximum-output control it reads is COPILOT_PROVIDER_MAX_OUTPUT_TOKENS, which binds the
# cap on a custom-provider route (BYOK, or a GHES proxy) and is ignored on GitHub's own model
# routing, where the cap comes from the model catalog; the rest of the CLI's output-token machinery
# (`clientOptions.maxOutputTokens`, `capabilities.limits.max_output_tokens`) is reachable only
# through its SDK session API, not from the command line. So the budget is asked for the two ways
# the pinned CLI allows: the environment variable it does read (see run_copilot), and the prompt,
# which names the budget so a model on GitHub's routing can shape an answer that fits inside it
# rather than discovering the limit halfway through (see build_prompt). Should the pin move to a
# CLI that grants more, raising the number here is the only change needed.
#
# An answer that runs past it even so is not lost either: the CLI carries a cut-off answer on in a
# second turn, and extract_answer puts the pieces back together. Only an answer that cannot be put
# back together is refused, and then the run retries with another model, as it always did.
DEFAULT_MAX_OUTPUT_TOKENS = 64_000
# Roughly how many bytes a token of JSON runs to, used only to say the budget in the units the
# rest of the prompt speaks: files are measured there in KB, not in tokens.
BYTES_PER_TOKEN = 4


def max_output_tokens():
    """The output budget to ask for, in tokens: MAX_OUTPUT_TOKENS if set, else the default.

    0 means ask for nothing: the CLI is told no budget and the prompt names none, leaving every
    model at whatever its own output limit happens to be. "none" and "0" both mean that.
    """
    asked = (os.environ.get("MAX_OUTPUT_TOKENS") or "").strip().lower()
    if not asked:
        return DEFAULT_MAX_OUTPUT_TOKENS
    if asked == "none":
        return 0
    if asked.isdigit():
        return int(asked)  # "0" asks for none, like "none"
    print(f"::warning::MAX_OUTPUT_TOKENS {one_line(asked, 40)!r} is not a whole number of tokens "
          f"or \"none\"; using {DEFAULT_MAX_OUTPUT_TOKENS}.")
    return DEFAULT_MAX_OUTPUT_TOKENS


def output_budget_env(budget):
    """The environment the CLI reads the output budget from, or nothing for 0."""
    return {"COPILOT_PROVIDER_MAX_OUTPUT_TOKENS": str(budget)} if budget else {}


def budget_note(budget):
    """How the prompt names `budget`: in tokens and in the KB the rest of the prompt counts in."""
    if not budget:
        return ""
    return (f", for which this run asks up to {budget:,} tokens -- about "
            f"{budget * BYTES_PER_TOKEN // 1000} KB of JSON, all of your files together, or your "
            "own limit if that is lower")


# A heavy model at near-maximum effort reads a prompt the size of the whole site and may write
# back most of it, and it is given the time that takes: a quarter of an hour, where eight minutes
# used to do. A call started late in the run gets what is left of the run's budget below instead.
MODEL_TIMEOUT_SECONDS = 900

# How long a run gives itself for asking models, counted from the start of main(). No call starts
# once this much has passed, and a call started near the end is given only what is left (see
# MIN_CALL_SECONDS). The workflow runs hourly and a run that outlasts the hour makes the next one
# skip itself (the guard job in make-interesting.yml), so a run that keeps asking costs the run
# after it; and the job's own timeout-minutes is a hard stop that would throw away whatever the
# last call was writing. Fifty minutes leaves the last answer its build, its harnesses and the
# tests every deploy waits on (together up to a quarter of an hour: BUILD_TIMEOUT_SECONDS,
# PIECE_TIMEOUT_SECONDS, STAGE_TIMEOUT_SECONDS and TESTS_TIMEOUT_SECONDS), and the push, inside
# the job's eighty.
RUN_BUDGET_SECONDS = 50 * 60
# No call is started with less than this left. The quickest usable answer a heavy model has
# given to a prompt the size of this site took about four minutes, so a call with less than
# five is a call whose answer cannot arrive.
MIN_CALL_SECONDS = 5 * 60

# How many times one model is asked to repair its own refused answer before the run moves on to
# the next model. A refusal is specific -- the tests it failed by name and message, the edit that
# matched nowhere, the page it orphaned -- and the model that wrote the answer is the one that
# can put it right with the least change, where a fresh model starts over from nothing and
# runs into something else. Two rounds: the first fixes what was named, and the second is for
# what the fix uncovered. A model whose answer did not arrive in time is not asked again (see
# ModelTimeout); one whose answer ran past its output limit is, for a smaller one.
REPAIR_ROUNDS = 2
# How much of a refused answer is shown back to its model, in characters. Past this, only what
# the answer said it did and which files it touched are shown, with the refusal, and the model
# is asked for a smaller answer: a prompt is not the place to carry a quarter of a megabyte
# twice, and an answer that size was the problem in the first place.
PRIOR_ANSWER_LIMIT = 120_000
# How much of a refusal's detail -- the failing tests, one paragraph each -- is shown back.
REFUSAL_DETAIL_LIMIT = 12_000

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
# js/participate.js draws one of the three affordances the fixed files pin over the page -- this
# one takes the middle of the bottom edge, "cookies" the bottom-left corner and "state" the
# bottom-right -- and it is the only one that answers to the person reading the site rather than to
# the model writing it: one press opens a pre-shaped new issue on this repository, with the issue
# form already chosen and the page they were on already filled in.
#
# Where a visitor finds it is the shell's business and not this file's. The whole of the site's
# navigation is two marks floating in the top corners (issue #54), so js/site.js hides all three of
# those pinned controls and offers each one as an option in the logo's constellation instead --
# "change this site" for this one (issue #64). What is held here is the line, the file, and the one
# link it draws; which chip presses that link is the shell's to arrange, and the fixed file is
# never edited either way.
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
    """A plan that is not applied. `details` is what there is to show the model beyond the one-line
    reason when it is asked to repair the answer: the failing tests' report, for instance."""

    def __init__(self, message, details=""):
        super().__init__(message)
        self.details = details


class BuildError(Exception):
    """This site does not build, so there is nothing to check and nothing to publish."""


class BuildToolchainError(Exception):
    """The build cannot be run at all. Not the model's fault, so no answer can get past it."""


class ModelError(Exception):
    """This model could not produce an answer; another model may still work."""


class ModelTimeout(ModelError):
    """No answer arrived in the time the call had. The next model is asked instead of this one
    again: a model that is still writing after a quarter of an hour is not one more round away."""


class AnswerCutOff(ModelError):
    """The answer ran past the model's output limit and could not be put back together."""


class EffortRefused(ModelError):
    """The CLI refused the reasoning effort asked for, not the model: worth asking again without it."""


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
PIECE_TIMEOUT_SECONDS = 240  # every module, every play, sequentially: see MODULE_TIMEOUT_MS in the harness
PIECE_MIN_STEPS = 2
PIECE_MAX_STEPS = 5
PIECE_MAX_TAPS = 12
PIECE_MAX_SECONDS = 45
STAGE_SCRIPT = "js/stage.js"
# The configuration a card and the feature it opens as share (issue #80): js/stage.js imports it,
# so it travels with the stage into the stage harness's temporary site.
VARIANT_SCRIPT = "js/variant.js"
STAGE_INCLUDE = "_includes/stage.njk"
MODULES_DIR = "js/modules/"
# The one list of worlds the layout writes into every page for the scripts, as JSON in a script
# element; the stage opens pieces from it, and the check reads it to know which worlds there are.
WORLD_LIST_ID = "site-worlds"
WORLD_LIST = re.compile(r"<script[^>]*\bid=['\"]" + WORLD_LIST_ID + r"['\"][^>]*>(.*?)</script>", re.S | re.I)


def world_entries(site):
    """The layout's #site-worlds JSON of the built `site`, as the entries its scripts read.

    The list is rendered from _data/worlds.json, so what the stage can open and what the checks
    require a piece of are the same list. A site without the list has no worlds in this sense, and
    the checks have nothing to say about it.
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
    return [entry for entry in data if isinstance(entry, dict) and isinstance(entry.get("file"), str)]


def listed_worlds(site):
    """The worlds the built `site` lists for its scripts, as [page, ...], read off the home page."""
    return [entry["file"] for entry in world_entries(site) if entry["file"].endswith(PAGE_SUFFIX)]


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


# The stage is the completion axiom's other half. Every world's piece is played on it, and a piece
# that finishes perfectly on its own can still leave a visitor stuck if the stage will not take one
# of its knobs: issue #60 was a slider nobody could set by leaving it where it already stood, which
# the piece harness could never see because it sets a range knob by fiat rather than through the
# stage's own control. The harness below runs js/stage.js against a stub browser -- a document of
# the elements _includes/stage.njk writes and a clock a scenario steps by hand -- and reports what
# the stage did; StageTest and RealSiteTest make the assertions.
STAGE_HARNESS_REL = ".github/scripts/stage_harness.mjs"
STAGE_HARNESS = REPO_ROOT / STAGE_HARNESS_REL
STAGE_TIMEOUT_SECONDS = 180


def run_stage_harness(site, deal=()):
    """Play the stage of `site` through the harness, as the harness's own JSON report.

    `deal` is the worlds the stub feed hands over in order, which is how a world is brought round
    twice in one session; with none given the harness deals the first world, the second, and the
    first again. Raises BuildToolchainError if the harness, the stage or Node cannot be run, which
    is nobody's answer to give.
    """
    stage = site.get(STAGE_SCRIPT)
    if stage is None:
        raise BuildToolchainError(f"the site has no {STAGE_SCRIPT}")
    entries = world_entries(site)
    if not entries:
        raise BuildToolchainError(f"the site lists no worlds (no #{WORLD_LIST_ID} on {HOME_PAGE})")
    if not STAGE_HARNESS.is_file():
        raise BuildToolchainError(f"no stage harness at {STAGE_HARNESS}")
    modules = {rel: content for rel, content in site.items()
               if rel.startswith(MODULES_DIR) and rel.endswith(".js")
               and "/" not in rel[len(MODULES_DIR):]}
    with tempfile.TemporaryDirectory(prefix="stage-") as work:
        root = Path(work) / "js"
        moddir = root / "modules"
        moddir.mkdir(parents=True)
        # The stage and the modules are ES modules; a package.json marks them so on every Node the
        # repository supports, exactly as run_piece_harness does for the modules alone.
        (root / "package.json").write_text('{"type":"module"}\n', encoding="utf-8")
        (root / "stage.js").write_text(stage, encoding="utf-8", newline="")
        # The stage imports the configuration a card and its feature share, so that file goes with
        # it; a site without one is played with whatever the stage can do on its own.
        variant = site.get(VARIANT_SCRIPT)
        if variant is not None:
            (root / PurePosixPath(VARIANT_SCRIPT).name).write_text(variant, encoding="utf-8", newline="")
        for rel, content in modules.items():
            (moddir / PurePosixPath(rel).name).write_text(content, encoding="utf-8", newline="")
        # The same care as the piece harness: the site is model-written code, so the run gets an
        # empty environment and only the reads it needs. It writes no file at all, only stdout.
        cmd = [NODE_BIN, "--experimental-permission", f"--allow-fs-read={STAGE_HARNESS.parent}",
               f"--allow-fs-read={work}", "--allow-worker", str(STAGE_HARNESS),
               "--stage", str(root), "--worlds", json.dumps(entries)]
        if deal:
            cmd += ["--deal", ",".join(deal)]
        env = {"PATH": os.environ.get("PATH", ""), "HOME": work, "LANG": "C.UTF-8", "NODE_NO_WARNINGS": "1"}
        try:
            played = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                                    cwd=work, env=env, timeout=STAGE_TIMEOUT_SECONDS)
        except FileNotFoundError:
            raise BuildToolchainError(f"the stage harness needs Node, which was not found ({NODE_BIN!r})") from None
        except subprocess.TimeoutExpired:
            raise BuildToolchainError(f"the stage did not finish within {STAGE_TIMEOUT_SECONDS}s of real time") from None
        try:
            return json.loads(played.stdout)
        except ValueError:
            raise BuildToolchainError("the stage harness gave no report: "
                                      + one_line(played.stderr or played.stdout or "nothing", 500))


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
            # The harness refuses a piece that cannot be finished and a piece that is the same
            # whichever of its world's cards it was opened from (the alignment axiom, issue #80).
            # Both are reported here, in the harness's own words, so a run is told which it was.
            missing[world] = f"has a piece the harness refused ({problems[0]})"
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


def build_prompt(shown, omitted=(), kind=INTERESTING_RUN, budget=None, feedback=""):
    """The whole prompt for a run of this kind: the standards every run is held to, then what this
    kind of run does (grow the site, or consolidate it), then the axioms and the site itself.

    `budget` is the output budget the run asks for, in tokens (max_output_tokens() unless given);
    0 leaves it unnamed. The prompt says it out loud so the model can size the answer to fit, which
    is the only way the budget reaches a model on GitHub's own routing (see
    DEFAULT_MAX_OUTPUT_TOKENS).

    `feedback` is what this run has already learned, if anything, written for the model that is
    asked now (repair_feedback, lesson_feedback): it goes after the site and before the line the
    model reads last, so the site it answers about is always the site as committed."""
    if budget is None:
        budget = max_output_tokens()
    mission = mission_of(kind)
    consolidating = kind == CONSOLIDATION_RUN
    system = (
        "You are the autonomous curator of a static website served from S3 behind a CDN. "
        f"Your mission this run: {mission}. What all of it has to add up to is {WHOLE} -- "
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
        + (consolidation_block() if consolidating else growth_block()) +
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
        "feed; a finished piece is followed by the next card in the feed's order. Because the feed "
        "repeats every world as a visitor scrolls, each card it deals carries a randomized "
        "configuration from \"js/variant.js\" -- dials for the card's colour inside its own mood, "
        "its frame, and env.variant.density, env.variant.scale and env.variant.turn for the "
        "picture -- so a repeat looks like a different card rather than a reprint. A module reads "
        "those three; the card the template wrote carries the configuration that changes nothing, "
        "so a world still leads with its own palette. That configuration is the piece's as much as "
        "the card's, and the alignment is an axiom of this site: every content piece is "
        "procedurally configured, and the configuration is the same whether the piece appears as a "
        "card in the feed or as the feature it opens as. Pressing a card hands the stage the "
        "card's seed, its variant, its four palette seeds and the content it was showing, and the "
        "stage hands a module env.variant and env.card, frames the scene by the same stretch and "
        "titles the feature from the card -- so a visitor lands on the very thing they pressed. A "
        "spark says what its card is of on its spec (`of`: the rule number, the coinage, the star "
        "it was drawn from -- the module's own data, which the stage hands straight back as "
        "env.card.of), and piece(env) opens on that rather than rolling another. A world's "
        "one-line description from the list is never a feature's title: it is the same line for "
        "every card of that world, which is what made every card of it open the same generic "
        "page.\n"
        "- \"js/persona.js\" is the persona: the one thing a visitor configures here, shown as the "
        "avatar floating in the upper right of every page and set up in the sheet that avatar "
        "opens, the way an app shows its account. It holds the sky that several worlds read -- "
        "placed, moved and read there, and nowhere else -- and shows the reading the mood flow has "
        "taken. A page reads the sky through window.interestingPersona.stars(), changes it only "
        "through window.interestingPersona.addStar() and its kin, and follows changes through "
        "window.interestingPersona.onSky(fn) or the unlock helper below. No page places stars "
        "itself, and no page adds a second way to open the persona: the avatar is the one way. "
        "The threshold alone hosts the sideways question in its <main> (#persona-probe), so the "
        "question is asked in that page's feature and never in the chrome. The sheet opens inside "
        "the shared lightbox below, like everything else on this site that floats over the whole "
        "page.\n"
        "- The whole of the site's navigation is \"_includes/layout.njk\" and \"js/site.js\": the "
        "sparkles logo floating in the upper left of every page, which says the site's name on "
        "rollover and opens a lightbox with the navigation branching out of it as a constellation "
        "of chips, and the persona floating opposite it. There is no app bar and no nav of a "
        "page's own: a page that wants to send a visitor somewhere does it in its own prose, "
        "inside its <main>. The logo is a <details> whose summary is the mark, so the disclosure "
        "and the keyboard are the browser's and the options are plain links with no script at "
        "all; js/site.js places the stars and settles which options are in the constellation, "
        "since the set changes with the visitor's state. "
        "The near orbit is the destinations (\"_data/worlds.json\" wayIn, and the world a reading "
        "opens onto once there is one) and the far orbit is the apparatus (\"cookies\", "
        "\"state\", and the finePrint pages). Styled in \"_sass/_nav.scss\".\n"
        "- One lightbox, shared. Everything that floats over the whole page opens through the same "
        "component, so the whole site has one such effect rather than one per overlay: the "
        "constellation the logo branches out, the persona sheet, and the \"are you sure?\" modal "
        "below. It is "
        f"window.interestingSite.lightbox({{ name: 'persona', keep: sheetElement, onPress: "
        "closeSheet }), which returns { up, down }; it lives in "
        f"\"{DESTRUCTIVE_SCRIPT}\", is painted by \"{SASS_DIR}/_lightbox.scss\" and raises the "
        "one #lightbox-veil the layout writes. Raising one dims, blurs and desaturates the page "
        "behind the veil, makes every other child of <body> inert and hidden from a screen reader "
        "(marking each one data-lightbox-aside, which is what pauses its CSS animations) and lifts "
        "the one thing open over the veil (data-lightbox-front), holds the page's "
        "requestAnimationFrame loop so nothing moves behind it, and writes <html data-lightbox>. "
        "They nest, so a question asked from inside the sheet leaves the sheet in front of the veil "
        "and hands it back when it is answered. Anything new that floats over the whole page opens "
        "through this and paints no backdrop of its own: a native <dialog> keeps its own focus "
        "trap, Escape and backdrop press, and borrows the veil.\n"
        "- A page's <main> is its feature. It is unbordered and full-bleed, the page's own palette "
        "washing to the viewport's edges, and at least the first screen tall (the viewport less "
        "the room the floating nav leaves and a margin), so the feed peeks above the fold; every "
        "direct child of <main> lands in one centred column (_panel.scss). A world page's <main> "
        "is the stage: the page "
        f"is nothing but front matter and {{% set stageWorld = 'thing' %}}{{% include "
        f"'stage.njk' %}}, and \"{STAGE_INCLUDE}\" with \"{STAGE_SCRIPT}\" (styled by "
        "_sass/_stage.scss) does the rest -- the world's name, the piece's title and line, the "
        "scene beside the knobs, the progress, the finish, and the one mark pinned in the lower "
        "right that the visitor presses to vanish the piece and open the next. The "
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
        "restyle. You need leave it no room: the shared shell hides the button it pins to the "
        "bottom-right corner and offers \"state\" as an option in the logo's constellation "
        "instead, beside the consent banner's \"cookies\" and the participation axiom's "
        "\"change this site\" below.\n"
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
        f"\"../{PARTICIPATE_SCRIPT}\"). It draws one link -- \"steer the site\" -- which it pins "
        "to the middle of the bottom edge of every page, and which sends whoever is reading to a "
        "new issue on this repository, with the issue form already chosen and the page they were "
        "on already filled in. The shared shell hides that link where this file pinned it and "
        "offers it in the logo's constellation as \"change this site\" (see the cadre below), so "
        f"what a visitor presses is always the one link this file drew. {PARTICIPATE_SCRIPT} is "
        "fixed like the analytics files and the local-state "
        "store: it is not shown to you, you may not write or delete it, and neither the button nor "
        "its wording is yours to change, to restyle or to reproduce. It is the one thing on this "
        "site that answers to the person reading it rather than to you, which is why no run may "
        "touch it: every other word here is yours to rewrite, so the way to say something about "
        "that cannot be. A plan that leaves a page of the site without the line is refused, and "
        "this too is checked on the built site. Three affordances belong to the fixed files and to "
        "no page -- this \"steer the site\" link, the consent banner's \"cookies\" button and "
        "the local-state \"state\" menu -- and each of them pins itself over the page where its "
        "own file says. Nothing of yours restyles them, reproduces them or rewords them. The "
        "shared shell adopts all three into the main nav rather than copying them: \"js/site.js\" "
        "hides the control that js/participate.js, js/analytics.js and js/state.js each pinned "
        "over the page, and offers \"change this site\", \"cookies\" and \"state\" in the "
        "logo's constellation, which presses those same controls -- so there is still exactly one "
        "of each on the site and no fixed file is touched. The words on those three options are "
        "the shell's own and are already written: leave them as they are too. That is also what "
        "keeps the two-item "
        "rule true: at rest the only things floating over a page are the sparkles logo in the top "
        "left and the persona in the top right, nothing floats at the bottom edge, and nothing "
        "floats beside either mark. Keep it that way: never draw a second new-issue, cookies or "
        "state control of your own, and pin nothing of yours to an edge of the viewport. Inviting "
        "a visitor to steer the site in a page's own prose is welcome, and is not a substitute for "
        "the line.\n"
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
        "site without the component, or without that warning styling, is refused. The modal is "
        "asked over the shared lightbox above, so the page behind it is dimmed, stilled and out of "
        "reach while the question stands. Where the "
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
        "few choices and finish, expediently. When it is finished it plays its ceremony and lights "
        "up the way on -- one mark pinned in the lower right of the screen, dim for the whole "
        "piece -- and waits: the stage never moves on by itself, and that press is what vanishes "
        "the whole piece and opens the next card in the feed in its place, so one piece follows "
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
        "before they have set a knob. Every knob must be one its visitor can actually set, and a "
        "piece must be finishable whatever order they reach its knobs in: nothing makes anyone "
        "work down the page, and a piece that only finishes from the top down leaves someone "
        "holding a finished-looking toy that will not finish. A piece is one instantiation and "
        "keeps nothing between them: all its state lives inside piece(env), so a world the feed "
        "deals a second time plays exactly as it did the first. "
        "frame's t is seconds since the piece started. The same seed "
        "makes the same piece and different seeds make different pieces. A piece is also the card "
        "it was opened from: the stage hands it the pressed card's configuration on env.variant "
        "and the content that card was showing on env.card, so piece(env) reads env.card and opens "
        "on the very thing a visitor pressed -- its card's rule, its coinage, its star -- and rolls "
        "a subject of its own only when there is no card (env.card is null). A piece that is the "
        "same piece whichever of its world's cards it was opened from is refused, because then "
        "pressing two different cards of one world would open the same feature twice. A piece "
        "reads the card it is handed defensively, since a sky can change under one. A piece is pure drawing "
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
        "same seed, whose knobs reached in another order or played a second time do not finish the "
        "same way, that is the same for every seed, or that is the same piece whichever of its "
        "world's cards it was opened from, is refused. The stage itself is held to the "
        f"same axiom, by a second harness that runs \"{STAGE_SCRIPT}\" against a stub browser "
        f"(\"{STAGE_HARNESS_REL}\", which a run cannot change): a world dealt twice in one session "
        "plays the second time like the first, a slider a visitor leaves where it stands counts as "
        "set, a knob nobody set is named rather than silently holding the piece shut, a hold knob is "
        "set the moment its bar fills rather than when the visitor lets go, a finished piece stays "
        "on the stage with the way on lit and the keyboard on it rather than showing itself out, "
        "a piece that is over leaves nothing of itself on the stage or still running, and a card "
        "pressed opens as that card -- its title, its line, its configuration -- rather than as "
        "the world's one line. That one is checked on the site as committed rather than on a plan, "
        "because it reads the stage's own elements and those are yours to rewrite -- so if you "
        "rewrite the stage, keep all seven true.\n"
        "- Leave the site working at the end of the run. If you extract something into a shared "
        "file, or merge or delete a page, update every page that refers to it in the same run: "
        "never leave a link, a stylesheet, a script, a layout or an @use pointing at something "
        "that is not there.\n"
        f"- A file you send whole is at most {MAX_FILE_BYTES // 1000} KB. A file that already exists "
        "is changed by edits (the format below), which carry only the passages that change and "
        "can take a file past that size; send the COMPLETE new content only of a file that is "
        "new or rewritten from its first line to its last.\n"
        f"- At most {MAX_CHANGES} files per run, and keep the whole answer well inside your output "
        f"limit{budget_note(budget)}: aim for a quarter of it and never pass half, because an "
        "answer that runs past the limit is pieced back together where it can be and discarded "
        "where it cannot, and the time it took is gone either way. Edits are how an answer stays "
        "small: a passage sent as an edit costs what the passage weighs, where a file sent whole "
        "costs the whole file. Decide how much to change from that budget before you start "
        "writing. A federation too large for one answer is better carried out in coherent "
        "stages, one per run, than attempted all at once.\n\n"
        "Respond with ONLY a JSON object, no prose and no markdown fences, shaped as:\n"
        '{"summary": "one sentence describing this change", '
        '"files": [{"path": "js/modules/thing.js", "content": "<the whole file>"}, '
        '{"path": "_data/worlds.json", "edits": [{"find": "<a passage of the file as shown above>", '
        '"replace": "<what takes its place>"}]}], '
        '"delete": ["old-page.html"]}\n'
        "A file entry carries either \"content\" -- the COMPLETE new content, for a file that is "
        "new or rewritten from its first line to its last -- or \"edits\", for a file that exists: "
        "a list of replacements applied in order, each quoting a passage of the file exactly as "
        "shown above (\"find\") and what takes its place (\"replace\"). Each \"find\" has to "
        "occur exactly once in the file, so quote enough of it -- a few whole lines -- to be "
        "unmistakable; an edit that matches nowhere or in two places refuses the whole answer. To "
        "insert, find the line before and replace it with itself followed by the new lines; to "
        "take a passage out, replace it with \"\". Prefer edits for every file that already "
        "exists, and send a file whole only when it is new or when most of it changes.\n"
        "Either list may be empty or absent as long as the other has something in it: a plan that "
        "only deletes is accepted and applied like any other.\n"
        "It must be valid JSON, or it is discarded. Inside every string -- \"content\", \"find\" "
        "and \"replace\" alike -- write every line break as \\n, every double quote as \\\" and "
        "every backslash as \\\\ (so a JavaScript '\\n' or \\d becomes '\\\\n' or \\\\d)."
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
    if feedback:
        user += "\n\n" + feedback
    if consolidating:
        then = ("make the one change that brings it closest to being that: re-federate what is "
                "already there, aggressively, refactor and clean up, and add nothing")
    else:
        then = ("make the one change that gives a visitor the most reason to stay and keep going: "
                "add something new only as part of the same whole, already federated, and leave "
                "the consolidating to the run that follows")
    user += (
        f"\n\nThis run's mission: {mission}, measured in {INTERESTING}. Envision all of the above "
        f"as {WHOLE} -- one navigation, one visual language, one through-line -- and then {then}. "
        f"Keep it {LEGIBLE}: one name per page, one way to do each thing, content before chrome, "
        "and never a dead end. Respond with the JSON object only."
    )
    return system + "\n\n" + user


# The two kinds of run differ in one block of the system prompt, between ENVISION THE WHOLE FIRST
# and LEGIBLE TO A STRANGER: what the run does, now that it has looked. Everything before it (the
# mission, the measure, the look at the whole) and everything after it (the legibility holds, the
# build, the axioms, the format) is the same for both.

ALTERNATION = ("Runs alternate: one makes the site more interesting and the next consolidates it, "
               "and this is the ")


def growth_block():
    """What a growing run does: add the one thing that most lengthens a visitor's stay, federated."""
    return (
        f"THIS RUN GROWS THE SITE. {ALTERNATION}growing run. Spend the whole of this answer on the "
        "one change that most lengthens a visitor's stay, and none of it on tidying: the "
        "consolidation that is overdue belongs to the run that follows this one, which adds "
        "nothing and lifts, merges and retires instead. Leave that run no more to do than you "
        "found, though: nothing you add may repeat what a shared file already does, and a change "
        "that needs a shared file changed makes that change rather than copying the shared "
        "thing.\n\n"
        "ADD something -- new content, a new world for an orientation that has none, a second "
        "shape of piece for a world that has one, a new way of querying a visitor's orientation, "
        "an interactive toy, better visuals, a hidden easter egg -- or deepen what is already "
        "there, so a world a visitor finishes in one go holds them for three. Whatever you add "
        "arrives already federated, in the same run: inside the shared layout, in the one visual "
        "language, wired into the one navigation, sharing the styles and behaviour it has in "
        "common with the rest. A page that stands apart leaves the site less of a whole, however "
        "good that page is on its own, so a growing run is held to the whole as firmly as a "
        "consolidating one. Build on what is already there rather than starting over, and do not "
        "add for the sake of adding: one change that gives a visitor a reason to keep going is "
        "the run, and a second page beside it is not.\n\n"
    )


def consolidation_block():
    """What a consolidating run does: re-federate, refactor and clean up, and add nothing."""
    return (
        f"THIS RUN CONSOLIDATES THE SITE. {ALTERNATION}consolidating run. It adds nothing: no new "
        "page, no new world, no new piece, no new query mechanism, no new feature, and no new "
        "copy that is not the plainer form of copy already there. The whole of this answer is "
        "consolidation, federation, refactoring and cleanup, and the measure above is served by "
        "that all the same: a site that holds together is one a visitor keeps exploring, and the "
        "growing run that follows this one builds on what this run leaves.\n\n"
        "RE-FEDERATE, AGGRESSIVELY. Leave the site more of a single piece than you found it. Lift "
        "markup, styles and behaviour that the pages repeat into the shared files -- the layout "
        f"and partials in \"{INCLUDES_DIR}/\", a Sass partial in \"{SASS_DIR}/\", the shared "
        "stylesheet \"css/site.scss\" that every page links as \"css/site.css\", a shared "
        "script such as \"js/site.js\" -- and use them from every page that needs them. Give "
        "every page the same header and navigation, so the whole site is reachable from anywhere. "
        "Settle on one visual language and hold every page to it: palette, type, spacing, motion. "
        "Merge pages that overlap, and retire the ones that no longer earn their place: the site "
        "is better as fewer pages that belong together than as more that do not. Be aggressive "
        "about it -- take on the consolidation that is overdue rather than the one that is merely "
        "easy, and do not leave a near-duplicate standing because no single page is to blame for "
        "it.\n\n"
        "REFACTOR AND CLEAN UP. Simplify, repair or remove what has stopped working. Take out dead "
        "code, styles nothing uses, partials nothing includes, variables nothing reads, and "
        "comments that describe what is no longer there. Give each thing one name and use it "
        "everywhere. Undo the drift from the six holds under LEGIBLE TO A STRANGER below: a "
        "second control beside the first, a caption on the feed, a term used as if self-evident. "
        "What a visitor can do stays what it is, except where a merge or a retirement takes a "
        "near-duplicate away on purpose: a consolidation that changes behaviour by accident is a "
        "regression, not a cleanup.\n\n"
        "WHAT THE DEPLOY'S TESTS HOLD IN PLACE. An answer is only written once it passes the tests "
        "every deploy waits on, and those tests read the shared shell as committed, by name: the "
        "ids, classes and data attributes the layout writes (sparknav-*, lightbox-veil, "
        "persona-*, stage-*), the names js/site.js exports on window.interestingSite (lightbox, "
        "destructive, areYouSure, unlock), the rule blocks and the section comments of "
        f"{SASS_DIR}/_nav.scss, _lightbox.scss, _stage.scss, _persona.scss and _controls.scss, "
        "the three lists of _data/worlds.json, and the pages index.html, moods.html, "
        "sitemap.html, privacy.html, terms.html and error.html. Consolidate around the shell, "
        "not through it: change those files by edits that leave every id, name, class, section "
        "and file where it is, never rewrite one of them whole or merge two of them, and never "
        "retire one of those pages. A consolidation that renames or removes any of it is refused "
        "by the tests and has to be undone, and the run is spent undoing it. The pages, the "
        "modules in js/modules/ and the page stylesheets are where the overdue consolidation "
        "is.\n\n"
        "A run whose entire change is a holistic improvement -- consolidating, unifying, merging, "
        "refactoring, or only deleting -- is a complete and successful run. It needs no new page "
        "alongside it, and must have none. The site becomes more interesting by becoming a single "
        "coherent whole, not only by growing, so do not add for the sake of adding: when the site "
        "is repetitive, scattered or inconsistent, re-federating it is the more interesting "
        "change. Build on what is already there rather than starting over.\n\n"
    )


def repair_feedback(answer, reason, details="", digest=""):
    """The block a model reads when it is asked again after its own answer was refused (see main):
    what it answered, why that was refused, and what to do about it -- answer again, whole, with
    the refusal put right and the rest kept. The site in the prompt around it is the site as
    committed, the same one it was shown the first time, so an answer is always a plan against
    that site and never a patch on its own earlier draft, and the composition of two plans is
    nothing this script has to get right.

    `answer` is the text of the refused answer, or None if none arrived whole (cut off at the
    model's output limit); `reason` is the refusal in one line, `details` what else there is to
    show of it (the failing tests, from failure_digest), and `digest` what the answer said it did
    and which files it touched, for when the answer is too long to show back (PRIOR_ANSWER_LIMIT).
    """
    lines = ["YOUR PREVIOUS ANSWER WAS REFUSED. This run has asked you once already, and what you "
             "answered was not written. The site shown above is unchanged: it is the site as "
             "committed, and the plan you answer with now is a whole plan against it, not a patch "
             "on your earlier answer."]
    smaller = ("Answer again, much smaller: edits rather than whole files, fewer files, one coherent "
               "stage of the change rather than all of it, and no more than a quarter of your "
               "output limit.")
    if answer is None:
        lines.append(f"What went wrong: {reason}. Nothing of that answer survived, so it cannot be "
                     f"shown back to you. {smaller}")
        return "\n\n".join(lines)
    lines.append(f"Why it was refused: {reason}.")
    if details:
        lines.append("The details:\n" + details)
    if len(answer) > PRIOR_ANSWER_LIMIT:
        lines.append(f"Your answer was too long to show back to you ({len(answer):,} characters)"
                     + (f"; it said: {digest}" if digest else "") + f". {smaller} Put right what the "
                     "refusal names, and keep the rest of what you meant to do.")
        return "\n\n".join(lines)
    lines.append("Your answer was:\n" + answer)
    lines.append("Answer again with the whole plan, revised: keep every part of it the refusal does "
                 "not name, change what it does, and nothing else. If the refusal names something "
                 "you removed, renamed or rewrote, put it back exactly as the site above shows it; "
                 "if it names something you added, correct it or take it out; if it names an edit "
                 "that matched nowhere or in two places, quote the passage as the file shows it, "
                 "with enough around it to be unmistakable; if it names a test, the test's name "
                 "says what the site is held to, and its message says how your answer fell short.")
    return "\n\n".join(lines)


def plan_digest(plan):
    """What a plan said it did and which files it touched, in a line: what stands in for the plan
    itself when it is too long to show back (repair_feedback)."""
    files = plan.get("files") if isinstance(plan.get("files"), list) else []
    deletes = plan.get("delete") if isinstance(plan.get("delete"), list) else []
    touched = [str(entry.get("path")) for entry in files if isinstance(entry, dict)]
    touched += [str(raw) for raw in deletes]
    return f"{one_line(plan.get('summary') or '', 200)!r}, touching {one_line(', '.join(touched), 1000)}"


def lesson_feedback(reason):
    """The block a model reads when another model was asked before it this run and failed: the one
    line of what went wrong, which is worth a sentence even to a model that starts over, because
    it says what the checks and the deploy's tests hold to in practice, on this site, now."""
    return ("EARLIER THIS RUN. Another model was asked first and its answer was refused: "
            f"{reason}. Nothing of it was written, and the site above is the site as committed. "
            "Do not repeat that: keep the answer well inside your output limit -- edits rather "
            "than whole files, and one coherent stage rather than everything -- and leave what "
            "the deploy's tests hold in place where it is.")


AUTH_FAILURE = re.compile(r"authentication failed|no authentication information|access denied by policy", re.I)
# What the CLI says when the account cannot use a model: retired or misspelled, not reachable by
# this CLI version, or listed but not enabled by the plan's or the organization's model policy.
MODEL_UNAVAILABLE = re.compile(
    r"is not available|is not accessible via|in interactive mode to enable this model"
    r"|requires enablement|disabled by your organization", re.I)
# What the CLI might say when a model has no dial for the reasoning effort asked of it. The exact
# wording is not known, so this reads any error that names the effort or the reasoning as that:
# the cost of a false match is one more call to the same model, without the flag.
EFFORT_REFUSED = re.compile(r"reasoning|effort", re.I)


def call_model(model, prompt, effort=None, budget=None, timeout=None):
    """Ask one model for its answer through the Copilot CLI and return the text.

    `effort` is the reasoning effort to ask for (reasoning_effort() unless given); "" asks for
    none. A model that refuses the level is asked once more without it, and that is the one
    retry: a second refusal is the model's failure like any other.

    `budget` is the maximum output to ask for in tokens (max_output_tokens() unless given); 0 asks
    for none. It is resolved once here, so a retry asks for the same room to write as the first
    call did.

    `timeout` is how long to wait for the answer, in seconds (MODEL_TIMEOUT_SECONDS unless
    given): the run passes what is left of its own budget when that is less.
    """
    if effort is None:
        effort = reasoning_effort()
    if budget is None:
        budget = max_output_tokens()
    if timeout is None:
        timeout = MODEL_TIMEOUT_SECONDS
    try:
        return run_copilot(model, prompt, effort, budget, timeout)
    except EffortRefused as err:
        if not effort:
            raise ModelError(str(err)) from None
        print(f"::notice::{model} did not take reasoning effort {effort} ({one_line(err, 200)}); "
              "asking again without it.")
        try:
            return run_copilot(model, prompt, "", budget, timeout)
        except EffortRefused as again:
            raise ModelError(str(again)) from None


def run_copilot(model, prompt, effort, budget=0, timeout=None):
    """One call to the Copilot CLI: the model's answer, or the error classified."""
    if timeout is None:
        timeout = MODEL_TIMEOUT_SECONDS
    cmd = [COPILOT_BIN, "--model", model, *effort_flags(effort), *COPILOT_FLAGS]
    # The output budget travels in the environment rather than in argv: the pinned CLI has no flag
    # for it (see DEFAULT_MAX_OUTPUT_TOKENS). Passing it is free where it is ignored, so there is
    # nothing to omit and nothing to retry without.
    env = dict(os.environ, NO_COLOR="1", COPILOT_AUTO_UPDATE="false", **output_budget_env(budget))
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
            stdout, stderr = proc.communicate(prompt, timeout=timeout)
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
        raise ModelTimeout(f"no answer within {timeout:g}s")
    # Before the session starts, errors are plain text on stderr; after, they are session.error
    # events. Only that text is classified: stdout also carries the model's own words, and a page
    # that says "this page is not available" is not a Copilot error.
    errors = [describe_error(e) for e in events if e.get("type") == "session.error"]
    problem = "; ".join(errors) or stderr.strip()
    if errors or proc.returncode != 0:
        if AUTH_FAILURE.search(problem) or any(error.startswith("authentication") for error in errors):
            raise CopilotAuthError(problem)
        # Before the unavailable check: "effort xhigh is not available for this model" is about
        # the flag, not the model, and the model is worth asking again without it.
        if EFFORT_REFUSED.search(problem):
            raise EffortRefused(problem[:300])
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
    answers = [event_data(e).get("content") for e in events if e.get("type") == "assistant.message"]
    answers = [a for a in answers if isinstance(a, str) and a.strip()]
    if not answers:
        raise ModelError("empty response")
    if sum(e.get("type") == "assistant.turn_start" for e in events) > 1:
        # More than one turn means the answer did not fit: the CLI carries a cut-off answer on in
        # a new turn. The piece of each turn is the message it ended on, as a lone turn's answer is
        # its last message (below) -- so an earlier draft inside a turn is not glued onto the front.
        return rejoin_answer(last_message_per_turn(events), model)
    return answers[-1]


def last_message_per_turn(events):
    """The non-empty assistant.message each turn ended on, in order: the pieces of a cut-off
    answer. Joining these rather than every message keeps the rejoin per turn, not per message."""
    pieces, current = [], None
    for event in events:
        kind = event.get("type")
        if kind == "assistant.turn_start":
            if current is not None:
                pieces.append(current)
            current = None
        elif kind == "assistant.message":
            content = event_data(event).get("content")
            if isinstance(content, str) and content.strip():
                current = content
    if current is not None:
        pieces.append(current)
    return pieces


def rejoin_answer(pieces, model):
    """One whole answer out of the pieces of an answer that ran past the model's output limit.

    The run asks for as much room to write as the CLI allows (see DEFAULT_MAX_OUTPUT_TOKENS) and
    tells the model how much that is, but an answer can still run past it, and then the whole
    answer is there in pieces rather than gone: joined in order and with no separator, because a
    continuation resumes exactly where the model stopped. A model that started the answer over
    instead of carrying it on leaves pieces that do not join, and then its last piece is the whole
    answer. Whichever of the two reads as a plan is the answer.

    An answer that reads as a plan neither way really was lost, and is refused as it always was:
    the run then tries another model, which is the backstop and not the first line of defence.
    """
    candidates = {"".join(pieces): "the pieces it reported join into one",
                  pieces[-1]: "its last piece is a whole answer"}
    for candidate, how in candidates.items():
        try:
            parse_response(candidate)
        except (ValueError, RecursionError):
            continue
        print(f"::notice::{model} ran past its output limit, but {how}: the answer was put back "
              f"together from the {len(pieces)} pieces the CLI reported, rather than discarded.")
        return candidate
    raise AnswerCutOff("the answer ran past the model's output limit")


def parse_response(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model response")
    plan = json.loads(text[start:end + 1])
    if not isinstance(plan, dict):
        raise ValueError("model response is not a JSON object")
    return plan


def find_passage(text, passage):
    """Every place `passage` occurs in `text`, as (start, end) spans: character for character if it
    occurs that way anywhere, else line for line with the spaces at line ends and in the
    indentation forgiven, which are what a model most often misremembers of a file it was shown.
    The forgiving match hands back the span of the file's own lines, so what replaces it takes
    the place of whole lines and the file's line endings around it stand."""
    spans, start = [], 0
    while passage:
        at = text.find(passage, start)
        if at == -1:
            break
        spans.append((at, at + len(passage)))
        start = at + len(passage)
    if spans:
        return spans
    wanted = [line.strip() for line in passage.split("\n")]
    while wanted and not wanted[0]:
        wanted.pop(0)
    while wanted and not wanted[-1]:
        wanted.pop()
    if not wanted:
        return []
    lines, offsets, at = text.split("\n"), [], 0
    for line in lines:
        offsets.append(at)
        at += len(line) + 1
    stripped = [line.strip() for line in lines]
    for i in range(len(lines) - len(wanted) + 1):
        if stripped[i:i + len(wanted)] == wanted:
            last = i + len(wanted) - 1
            spans.append((offsets[i], offsets[last] + len(lines[last])))
    return spans


def apply_edits(rel, text, edits):
    """The content of `rel` once `edits` are applied to `text`, in order, or raise RejectedChange.

    An edit is {"find": passage, "replace": passage}: the find text gives way to the replace text,
    and has to occur exactly once in the file as it stands when the edit's turn comes (see
    find_passage for how far a mismatch of whitespace is forgiven). An edit that matches nowhere,
    or in more than one place, refuses the whole answer, naming the file and the passage so the
    model can be asked again (repair_feedback): an edit landed in the wrong place would be a
    change nobody asked for, and a plan is applied whole or not at all.

    This is what lets an answer stay small (issue #77 by another road): a file that exists costs
    the answer only the passages that change, where sending it whole cost the whole file, and the
    files that outgrew MAX_FILE_BYTES -- the shell's own scripts -- are within a run's reach again.
    """
    if not isinstance(edits, list) or not edits:
        raise RejectedChange(f"invalid edits for {rel}: \"edits\" is a non-empty list of "
                             "{\"find\": ..., \"replace\": ...}")
    for number, edit in enumerate(edits, 1):
        if (not isinstance(edit, dict) or not isinstance(edit.get("find"), str)
                or not isinstance(edit.get("replace"), str)):
            raise RejectedChange(f"invalid edit {number} of {rel}: an edit is "
                                 "{\"find\": ..., \"replace\": ...}, both strings")
        find, replacement = edit["find"], edit["replace"]
        if not find.strip():
            raise RejectedChange(f"edit {number} of {rel} finds nothing: \"find\" has to quote a "
                                 "passage of the file")
        if len(replacement.encode()) > MAX_FILE_BYTES:
            raise RejectedChange(f"edit {number} of {rel} is too large")
        spans = find_passage(text, find)
        if not spans:
            raise RejectedChange(f"edit {number} of {rel} matches nowhere: the file has no passage "
                                 f"reading {one_line(find, 80)!r}, so quote it as the file shows it")
        if len(spans) > 1:
            raise RejectedChange(f"edit {number} of {rel} is ambiguous: {one_line(find, 80)!r} occurs "
                                 f"{len(spans)} times, so quote more of the file around it")
        start, end = spans[0]
        text = text[:start] + replacement + text[end:]
    return text


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
    before = dict(read_site())
    ops = []
    for entry in files:
        if not isinstance(entry, dict):
            raise RejectedChange(f"invalid file entry: {entry!r:.200}")
        target = safe_site_path(entry.get("path"))
        rel = target.relative_to(SITE_DIR).as_posix()
        if rel in FIXED_FILES:
            raise RejectedChange(f"refusing to rewrite {rel}: the fixed files carry the analytics "
                                 "tag, the consent banner, the local-state store with its meta "
                                 "menu and a visitor's way of steering the site, and are not a "
                                 "model's to change")
        if rel in unseen:
            raise RejectedChange(f"refusing to overwrite {rel}: its content was not shown to the model")
        if target.is_dir():
            raise RejectedChange(f"{rel} is a folder")
        # A file arrives whole, as "content", or as "edits" to the file as it is (apply_edits):
        # the one way to change a file bigger than MAX_FILE_BYTES, and the cheap way to change
        # any file that exists.
        edits = entry.get("edits")
        if edits is not None and "content" in entry:
            raise RejectedChange(f"{rel} is sent both whole and as edits: send one or the other")
        if edits is not None:
            if rel not in before:
                raise RejectedChange(f"cannot edit {rel}: there is no such file, and a new file is "
                                     "sent whole as \"content\"")
            content = apply_edits(rel, before[rel], edits)
        elif isinstance(entry.get("content"), str):
            content = entry["content"]
            if len(content.encode()) > MAX_FILE_BYTES:
                raise RejectedChange(f"file too large: {rel} (a file that exists is changed by edits, "
                                     "which have no such limit)")
        else:
            raise RejectedChange(f"invalid file entry: {entry!r:.200}")
        if STRAY_CONTROL_CHARACTER.search(content):
            raise RejectedChange(f"control character in the content of {rel} (broken JSON escaping?)")
        if rel in PROTECTED_FILES and not content.strip():
            raise RejectedChange(f"refusing to empty {rel}")
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


# The tests every deploy waits on. deploy.yml runs test.yml on each commit that lands on main and
# publishes nothing until it passes, and the nine axioms are only part of what it checks:
# RealSiteTest holds the site as committed to much more besides (the shell's shared lines, the
# stage's markup, what every module says its cards are of). On 2026-10-06 the hourly run twice
# pushed a commit that had passed every check in validate_plan and failed those tests, and every
# deploy after it was blocked until a person repaired main. So an answer that has passed the axioms
# is then held to the whole suite, run with test.yml's own command on a copy of the repository with
# the change applied, and one that fails it is refused like any other: nothing is written to /site,
# and the next model is asked. The suite is run rather than restated here, because a second copy of
# it would drift from the first.
TESTS_DIR = ".github/scripts"
TEST_COMMAND = ["-m", "unittest", "discover", "-s", TESTS_DIR, "-v"]  # after `python3`, as in test.yml
# test.yml gives its whole job ten minutes, setup and the infrastructure checks included, so a suite
# that needs longer than this would time out there as well.
TESTS_TIMEOUT_SECONDS = 480
# All the suite is given of this run's environment: where the tools are, and CI, under which a test
# that cannot find the toolchain fails instead of skipping, as it does in test.yml. Nothing that
# could hold a token, and none of this run's settings, which the tests do not expect to find set.
TEST_ENVIRONMENT = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "CI", "NODE_BIN")
# Set for the suite the gate runs. A test that reaches main() inside it must not start the suite
# again inside itself.
INSIDE_THE_GATE = "MAKE_INTERESTING_TESTING"
# How a failing test is named in unittest's report: "FAIL: test_x (module.Class.test_x)", with the
# class alone on Pythons before 3.11, and "ERROR: setUpClass (module.Class)" for a class that
# could not even start.
FAILED_TEST = re.compile(r"^(?:FAIL|ERROR): (\w+) \(([\w.]+)\)", re.M)
UNITTEST_RULE = "=" * 70  # opens each failure in the report


def copy_repository(root):
    """Copy the repository to `root` as it would be committed: everything but .git, node_modules
    (linked, not copied) and the bytecode Python leaves behind, with SITE_DIR as its /site."""
    def skip(folder, names):
        skipped = {"__pycache__"}
        if Path(folder).resolve() == REPO_ROOT:
            skipped |= {".git", "node_modules", "site"}
        return skipped & set(names)

    shutil.copytree(REPO_ROOT, root, symlinks=True, ignore=skip)
    shutil.copytree(SITE_DIR, root / "site", symlinks=True, ignore=skip)
    if (REPO_ROOT / "node_modules").exists():
        (root / "node_modules").symlink_to(REPO_ROOT / "node_modules", target_is_directory=True)


def failing_tests(report):
    """The tests unittest's `report` says failed, as ["Class.test_name", ...] in report order."""
    named = []
    for test, where in FAILED_TEST.findall(report):
        parts = where.split(".")
        owner = parts[-2] if parts[-1] == test and len(parts) > 1 else parts[-1]
        if f"{owner}.{test}" not in named:
            named.append(f"{owner}.{test}")
    return named


def failure_digest(report, limit=REFUSAL_DETAIL_LIMIT):
    """The failures in unittest's `report`, one short paragraph each -- the test's name, its
    docstring if it has one, and the exception line -- within `limit` characters in all. What a
    model is shown when it is asked to repair the answer: the names say what each test holds
    the site to, and the exception says how the answer fell short of it."""
    dashes = UNITTEST_RULE.replace("=", "-")
    if "\n" + dashes in report:
        report = report[:report.rfind("\n" + dashes)]  # the trailer: "Ran N tests", "FAILED (...)"
    paragraphs = []
    for block in report.split(UNITTEST_RULE)[1:]:
        lines = block.strip("\n").splitlines()
        if not lines or not FAILED_TEST.match(lines[0].strip()):
            continue
        paragraph, i = [lines[0].strip()], 1
        doc = []
        while i < len(lines) and lines[i].strip() != dashes:
            doc.append(lines[i].strip())
            i += 1
        if doc:
            paragraph.append(one_line(" ".join(doc), 300))
        for line in lines[i + 1:]:
            if line and not line[0].isspace() and not line.startswith("Traceback"):
                paragraph.append(one_line(line, 400))
                break
        paragraphs.append("\n".join(paragraph))
    return "\n\n".join(paragraphs)[:limit]


def first_failure(report):
    """The exception line of the first failure in unittest's `report`, or its last line if none."""
    found = FAILED_TEST.search(report)
    if found:
        # Past the rule under the test's name (and its docstring, if it has one), the traceback,
        # whose first unindented line after "Traceback" is the exception.
        traceback = report[found.end():].split(UNITTEST_RULE.replace("=", "-"), 1)[-1]
        for line in traceback.splitlines():
            if line and not line[0].isspace() and not line.startswith("Traceback"):
                return line
    lines = [line for line in report.splitlines() if line.strip()]
    return lines[-1] if lines else "the tests failed and said nothing"


def require_passing_tests(ops):
    """Raise RejectedChange if the repository's tests fail once `ops` are applied.

    The suite runs on a copy, so /site is untouched whatever it finds, and in a process given only
    TEST_ENVIRONMENT: the tests run the site's own scripts, which a model wrote.
    """
    if os.environ.get(INSIDE_THE_GATE):
        return
    with tempfile.TemporaryDirectory(prefix="tested-") as work:
        root = Path(work) / "repository"
        copy_repository(root)
        for action, target, content in ops:
            path = root / "site" / target.relative_to(SITE_DIR)
            if action == "write":
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
            elif path.is_file():
                path.unlink()
        env = {name: os.environ[name] for name in TEST_ENVIRONMENT if name in os.environ}
        env[INSIDE_THE_GATE] = "1"
        proc = subprocess.Popen([sys.executable, *TEST_COMMAND], stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                                cwd=root, env=env, start_new_session=True)
        try:
            report, _ = proc.communicate(timeout=TESTS_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            stop_process_group(proc)
            raise RejectedChange(f"the tests did not finish within {TESTS_TIMEOUT_SECONDS}s with this "
                                 "change, so test.yml would time out and block every deploy") from None
        except BaseException:
            stop_process_group(proc)  # interrupted: leave nothing running
            raise
    if proc.returncode == 0:
        return
    # Every failure in full, for whoever reads the log. The model wrote what they quote, so the
    # runner is told to take none of it as a workflow command.
    details = report[report.find(UNITTEST_RULE):] if UNITTEST_RULE in report else report
    token = uuid.uuid4().hex
    print(f"::group::The tests this change fails\n::stop-commands::{token}\n{details.rstrip()}\n"
          f"::{token}::\n::endgroup::")
    failed = ", ".join(failing_tests(report)) or f"status {proc.returncode}"
    raise RejectedChange(f"the tests every deploy waits on (test.yml) fail with this change: {failed} "
                         f"({first_failure(report)})", details=failure_digest(report))


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


def clean_summary(text, fallback=MISSION):
    """The model's summary as one plain line that is safe in a commit message and in Markdown.

    Only letters, digits, spaces and plain punctuation survive. That drops "#" and "@" (GitHub acts
    on "fixes #1" and mentions in commit messages) as well as links, markup and control characters.
    "GH-1", GitHub's other way to write "#1", is taken apart as well.
    """
    lines = str(text or "").strip().splitlines()
    first = re.sub(r"[^\w .,;:!?'\"()+%&=-]", "", lines[0] if lines else "")
    first = re.sub(r"(?i)(gh)-(?=\d)", r"\1 ", first)
    return " ".join(first.split())[:200] or fallback


def main():
    if not SITE_DIR.is_dir():
        sys.exit(f"site directory not found: {SITE_DIR}")
    require_build_toolchain()
    started = time.monotonic()

    def time_left():
        return RUN_BUDGET_SECONDS - (time.monotonic() - started)

    kind = run_kind()
    mission = mission_of(kind)
    shown, omitted = split_for_prompt(read_site())
    # Resolved once for the whole run: the prompt names the budget and every call asks for it, so
    # the answer the model plans for is the answer the CLI is told to allow.
    budget = max_output_tokens()
    # Resolved once too, and stepped down within the run after an answer is lost to the output
    # limit or the clock (lower_effort): the next call, whoever answers it, thinks a step less hard.
    effort = reasoning_effort()
    candidates = pick_candidates()
    requested = bool((os.environ.get("MODEL") or "").strip())  # named by hand, not drawn from the pool
    attempts, unavailable, tried = 0, [], set()
    lesson = ""  # the last refusal this run, told to the next model asked

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

    def step_down():
        # An answer that never arrived has no quality to weigh: the rest of the run asks for one
        # step less reasoning, which is the one dial this script has on how long an answer takes.
        nonlocal effort
        lowered = lower_effort(effort)
        if lowered != effort:
            print(f"::notice::Reasoning effort {effort} -> {lowered} for the rest of this run.")
            effort = lowered

    queue, answering = list(candidates), []
    while queue and attempts < MAX_ATTEMPTS:
        if time_left() < MIN_CALL_SECONDS:
            print(f"::warning::Out of time: the run's {RUN_BUDGET_SECONDS // 60} minutes for asking "
                  "models are spent, so no more model is asked.")
            break
        model = queue.pop(0)
        tried.add(model)
        attempts += 1  # counted up front, so every path below that asks again is bounded
        feedback = lesson_feedback(lesson) if lesson else ""
        repairs = 0
        # The same model is asked again, with its refused answer and the refusal, up to
        # REPAIR_ROUNDS times (see repair_feedback); then the next model is asked.
        while True:
            rounds = f" (repair {repairs} of {REPAIR_ROUNDS})" if repairs else ""
            print(f"Mission: {mission} ({kind} run)\nModel:   {model}{rounds}\n"
                  f"Effort:  {effort or 'the model' + chr(39) + 's own'}", flush=True)
            prompt = build_prompt(shown, omitted, kind, budget, feedback)
            answer = plan = None
            try:
                answer = call_model(model, prompt, effort=effort, budget=budget,
                                    timeout=min(MODEL_TIMEOUT_SECONDS, max(time_left(), 1)))
                plan = parse_response(answer)
                ops = validate_plan(plan, unseen=omitted)
                print("The change holds to every axiom; running the tests every deploy waits on.", flush=True)
                require_passing_tests(ops)
            except ModelUnavailable as err:
                attempts -= 1  # no model was asked, so this does not count as an attempt
                more = ", trying another model" if queue or answering else ""
                print(f"{model} is not available{more}: {one_line(err, 200)}")
                unavailable.append(model)
                break
            except CopilotAuthError as err:
                print(f"::error::GitHub Copilot authentication failed: {one_line(err, 300)}")
                sys.exit(AUTH_HELP)
            except SiloBreach as err:
                sys.exit(f"Stopping without applying anything: {err}. The Copilot CLI flags no longer disable every tool.")
            except BuildToolchainError as err:
                # Not this model's fault and not the next one's either: nothing can be checked.
                sys.exit(f"Stopping without applying anything: the build could not be run ({err}).")
            except (ModelError, ValueError, RecursionError, RejectedChange) as err:
                if not repairs:
                    answering.append(model)
                reason = one_line(err, 500)
                if not isinstance(err, (ModelError, RejectedChange)):
                    reason = f"the answer was not one JSON object ({reason})"
                print(f"::warning::{model} failed: {reason}")
                if not isinstance(err, ModelError) or isinstance(err, (ModelTimeout, AnswerCutOff)):
                    lesson = reason  # about the answer, so worth a line to the next model; a CLI failure is not
                if isinstance(err, (ModelTimeout, AnswerCutOff)):
                    step_down()
                if isinstance(err, ModelTimeout) or repairs >= REPAIR_ROUNDS or time_left() < MIN_CALL_SECONDS:
                    break
                repairs += 1
                if isinstance(err, AnswerCutOff):
                    feedback = repair_feedback(None, reason)
                elif isinstance(err, ModelError):
                    feedback = ""  # the CLI failed, not the model: the same question, once more
                elif isinstance(err, RejectedChange):
                    feedback = repair_feedback(answer, reason, err.details, plan_digest(plan))
                else:
                    feedback = repair_feedback(answer, reason)
                continue
            else:
                try:
                    apply_ops(ops)
                except OSError as err:
                    # The site may be half written, so stop here: the workflow only commits after success.
                    sys.exit(f"Could not apply the change from {model}: {one_line(err, 300)}")
                summary = clean_summary(plan.get("summary"), mission)
                print(f"Summary: {summary}")
                set_output("model", model)
                set_output("summary", summary)
                set_output("kind", kind)
                set_output("headline", HEADLINES[kind])
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
