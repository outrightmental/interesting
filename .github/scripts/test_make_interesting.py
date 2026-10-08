#!/usr/bin/env python3
"""Tests for make_interesting.py. Standard library only; no model is ever called.

Run with:  python3 -m unittest discover -s .github/scripts -v
"""

import json
import os
import random
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_interesting as mi  # noqa: E402


def event(kind, **data):
    return json.dumps({"type": kind, "data": data})


def process_is_running(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    # A killed child of the test process's children is reparented and reaped by init; a zombie
    # still answers signal 0, so ask ps for its state.
    state = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return bool(state) and not state.startswith("Z")


def read_outputs(text):
    """Parse a GITHUB_OUTPUT file written with `name<<delimiter` heredocs, as the runner does."""
    outputs, lines = {}, text.split("\n")
    while lines and lines[0]:
        name, delimiter = lines.pop(0).split("<<", 1)
        end = lines.index(delimiter)
        outputs[name], lines = "\n".join(lines[:end]), lines[end + 1:]
    return outputs


# The coded axioms, by the name of the check that holds each one. Written down once, so adding or
# retiring an axiom is one edit here rather than one per test that counts them.
CODED_AXIOMS = ["check_accessibility", "check_analytics", "check_cadence", "check_completion",
                "check_destructive", "check_mood", "check_participate", "check_reachability",
                "check_state"]


def sitemap(*pages):
    """A sitemaps.org urlset listing `pages`, written the way /site writes one: relative <loc>s."""
    locs = "".join(f"  <url><loc>{page}</loc></url>\n" for page in pages)
    return ("<?xml version='1.0' encoding='UTF-8'?>\n"
            "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>\n" + locs + "</urlset>\n")


def home(*links):
    """A home page whose navigation links to `links`.

    It is a bare fragment, so it fails the responsive-and-accessible axiom in several ways -- which
    is deliberate: the throwaway /site below starts out failing the axiom, and that is what exercises
    the rule that a page which already falls short blocks no plan. Pages a plan *adds* use page().
    """
    return "<h1>interesting</h1>\n<nav>" + "".join(f"<a href='{to}'>{to}</a>" for to in links) + "</nav>"


def tagged(body):
    """A bare fragment that loads the shared analytics and consent script, and nothing more.

    It carries the analytics line but, being a fragment, fails the responsive-and-accessible axiom
    from the start -- which is what keeps the analytics tests about analytics: a page that already
    falls short blocks no plan, so only the analytics check can refuse a fixture built from this.
    A page a plan *adds* has no such excuse and uses page().
    """
    return f"<head>{mi.ANALYTICS_TAG}</head>\n<body>{body}</body>"


def stored(body):
    """A bare fragment that loads the shared local-state store and its meta menu, and nothing more.

    The local-state counterpart of tagged(): it carries the one line the axiom is about but, being
    a fragment, falls short of the responsive-and-accessible axiom from the start, so only
    check_state can refuse a fixture built from it.
    """
    return f"<head>{mi.STATE_TAG}</head>\n<body>{body}</body>"


def in_the_shell(tag):
    """A pattern matching `tag` as the shared shell may write it, with or without siteRoot.

    The axioms spell their lines out as a *page* carries them: mi.STATE_TAG and mi.PARTICIPATE_TAG
    are what the built site is checked for, and what the prompt tells a run to keep, exactly as it
    is. _includes/layout.njk is free to reach that through siteRoot instead -- which renders empty on
    every page but error.html, served from an arbitrary missing path and so needing the absolute
    form -- and it does. Either way one line in the template carries the axiom to every page, which
    is the whole of what the tests below are about, so both forms match and neither is prescribed.
    """
    src, rest = tag.split("src='", 1)
    return re.escape(src + "src='") + r"(\{\{ siteRoot \}\})?" + re.escape(rest)


def steered(body):
    """A bare fragment that loads the shared participation script, and nothing more.

    The participation counterpart of tagged(): it carries the one line the axiom is about -- the
    way a visitor says what the site should become -- and, being a fragment, falls short of the
    responsive-and-accessible axiom from the start, so only check_participate can refuse a fixture
    built from it.
    """
    return f"<head>{mi.PARTICIPATE_TAG}</head>\n<body>{body}</body>"


def queried(body):
    """A bare fragment that loads the shared mood script, and nothing more.

    The mood counterpart of tagged(): it carries the one line and, being a fragment, fails the
    responsive-and-accessible axiom from the start, so only the mood check can refuse a fixture
    built from it.
    """
    return f"<head>{mi.MOOD_TAG}</head>\n<body>{body}</body>"


def mood_script(*probes):
    """A stand-in for the shared mood script, declaring `probes` as its query mechanisms."""
    declared = ",\n".join(f"  {{ probe: '{name}', kind: 'choice' }}" for name in probes)
    return "var PROBES = [\n" + declared + "\n];\n"


def page(body="<p>a page</p>", title="a page", lang="en",
         viewport="width=device-width, initial-scale=1", css="", focus=True, calm=True,
         analytics=mi.ANALYTICS_SCRIPT, state=mi.STATE_SCRIPT, mood=mi.MOOD_SCRIPT,
         participate=mi.PARTICIPATE_SCRIPT):
    """A whole page that satisfies every axiom: responsive and accessible (issue #26), and carrying
    the analytics and consent line (issue #24).

    This is what a page a run adds has to look like, so it is also what a fixture standing in for one
    has to look like. Every argument takes one part of the axiom away again, so a test can break
    exactly one thing: the style block always animates (`transition`) and always drops the browser's
    focus ring (`outline: none`), so `calm=False` and `focus=False` really do leave a page failing.
    `analytics`, `state`, `mood` and `participate` are the srcs of the four shared scripts, so a
    page in a sub-folder can load them by the matching relative path, and `analytics=""`,
    `state=""`, `mood=""` or `participate=""` leaves one line off without touching anything else.
    """
    style = ["  * { box-sizing: border-box; }",
             "  .panel { max-width: 60rem; padding: clamp(0.8rem, 3vw, 2rem); }",
             "  a { transition: color 0.2s ease; }",
             "  button { outline: none; min-height: 44px; }"]
    if focus:
        style.append("  a:focus-visible, button:focus-visible { outline: 2px solid #8db8ff; }")
    if calm:
        style.append("  @media (prefers-reduced-motion: reduce) { * { transition: none; } }")
    return (f"<!DOCTYPE html>\n<html{f' lang={lang!r}' if lang else ''}>\n<head>\n"
            "  <meta charset='utf-8'>\n"
            + (f"  <meta name='viewport' content='{viewport}'>\n" if viewport else "")
            + (f"  <script src='{analytics}' defer></script>\n" if analytics else "")
            + (f"  <script src='{state}'></script>\n" if state else "")
            + (f"  <script src='{mood}' defer></script>\n" if mood else "")
            + (f"  <script src='{participate}' defer></script>\n" if participate else "")
            + f"  <title>{title}</title>\n  <style>\n"
            + "\n".join(style + ([f"  {css}"] if css else [])) + "\n  </style>\n</head>\n<body>\n"
            f"  <main class='panel'>\n    <h1>{title}</h1>\n    {body}\n  </main>\n</body>\n</html>\n")


# A page a plan may add without either the responsive-and-accessible axiom or the analytics axiom
# having anything to say about it, so a test about reachability only ever fails on reachability.
NEW_PAGE = page(title="new")


class Stylesheet:
    """A built stylesheet, read the way a viewport of a given size reads it.

    Enough of the cascade to settle a question of layout from the sheet a browser is served rather
    than from the Sass it was compiled out of: which rules apply at this viewport, which declaration
    of a property wins among them, and what a length in one comes to in pixels. Custom properties
    resolve by inheritance down the stage's own nesting, so --nav-h on :root and --stage-h on .stage
    reach .stage-scene the way a browser takes them there, and `given` stands in for what a script
    sets on an element inline (js/stage.js sets --piece-ratio from the piece's own aspect).
    """

    # The nesting a declaration inherits down, from the root to the scene (_includes/stage.njk).
    LINEAGE = [":root", "main", ".stage", ".stage-inner", ".stage-body", ".stage-scene"]

    def __init__(self, css, width, height, root=16.0):
        self.width, self.height, self.root = float(width), float(height), float(root)
        self.rules = self._flatten(css.replace("\ufeff", ""))  # the sheet is served with a byte-order mark

    # ---- the cascade, as far as a layout needs it ----------------------------------------------

    @staticmethod
    def blocks(text):
        """(prelude, body) for every block at this level of a compressed stylesheet, in order."""
        found, start, i = [], 0, 0
        while i < len(text):
            if text[i] != "{":
                i += 1
                continue
            depth, j = 1, i + 1
            while j < len(text) and depth:
                depth += {"{": 1, "}": -1}.get(text[j], 0)
                j += 1
            found.append((text[start:i].strip(), text[i + 1:j - 1]))
            start = i = j
        return found

    def _flatten(self, text):
        rules = []
        for prelude, body in self.blocks(text):
            if prelude.startswith("@media"):
                if self._matches(prelude):
                    rules += self._flatten(body)
            elif prelude.startswith("@supports"):
                rules += self._flatten(body)  # every unit and function the site asks after exists
            elif prelude.startswith("@"):
                continue  # keyframes and the like: no layout is read off one
            else:
                rules += [(one.strip(), body) for one in prelude.split(",")]
        return rules

    def _matches(self, prelude):
        """Whether this viewport reads a media query. Only the features the site's own sheets ask
        about are understood, and a query asking after anything else is treated as not matching, so
        a new kind of query can never quietly turn a check of a layout into a check of nothing."""
        asked = re.findall(r"\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)", prelude)
        if not asked or " or " in prelude:
            return False
        for feature, asks in asked:
            if feature not in ("min-width", "max-width", "min-height", "max-height"):
                return False
            have = self.width if feature.endswith("width") else self.height
            want = float(re.sub(r"[a-z]+$", "", asks))  # the sheets write every breakpoint in px
            if (have < want) if feature.startswith("min") else (have > want):
                return False
        return True

    def value(self, selector, prop):
        """What `prop` is left with on `selector`: the last declaration of it, which is how a browser
        settles rules of one specificity. None if nothing this viewport reads declares it."""
        found = None
        for one, declarations in self.rules:
            if one != selector:
                continue
            for declaration in declarations.split(";"):
                name, _, value = declaration.partition(":")
                if name.strip() == prop:
                    found = value.strip()
        return found

    def var(self, name, at):
        """What a custom property inherits down to the element `at` of the stage's nesting."""
        for selector in reversed(self.LINEAGE[:self.LINEAGE.index(at) + 1]):
            found = self.value(selector, name)
            if found is not None:
                return found
        return None

    # ---- and the arithmetic in one -------------------------------------------------------------

    @staticmethod
    def parts(value):
        """A shorthand's components, split on the spaces that are not inside brackets."""
        found, depth, token = [], 0, ""
        for ch in value:
            depth += {"(": 1, ")": -1}.get(ch, 0)
            if ch.isspace() and not depth:
                found, token = found + [token] if token else found, ""
            else:
                token += ch
        return found + ([token] if token else [])

    def px(self, value, at, percent=None, given=None):
        """A length in pixels: calc(), min(), max() and clamp() over px, rem, vh, svh, vw and
        percentages of `percent`, with every var() in it resolved as read on the element `at`."""
        expr = value
        for _ in range(12):  # a custom property may be written out of others, as --stage-h is
            def one(found):
                name, fallback = found.group(1), found.group(2)
                known = (given or {}).get(name)
                if known is None:
                    known = self.var(name, at)
                if known is None:
                    known = fallback
                assert known is not None, f"nothing gives {name} a value"
                return known
            grown = re.sub(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^(),]*))?\)", one, expr)
            if grown == expr:
                break
            expr = grown
        assert "var(" not in expr, expr
        for unit, scale in (("rem", self.root), ("svh", self.height / 100), ("dvh", self.height / 100),
                            ("vh", self.height / 100), ("vw", self.width / 100), ("px", 1.0)):
            expr = re.sub(r"(\d*\.?\d+)" + unit + r"\b",
                          lambda found, scale=scale: repr(float(found.group(1)) * scale), expr)
        expr = re.sub(r"(\d*\.?\d+)%", lambda found: repr(float(found.group(1)) * (percent or 0) / 100), expr)
        return float(eval(expr.replace("calc", ""), {"__builtins__": {}},  # noqa: S307 -- the site's own sheet
                          {"min": min, "max": max,
                           "clamp": lambda low, value, high: max(low, min(value, high))}))


class SiteDirTestCase(unittest.TestCase):
    """Points the script at a throwaway /site so no test touches the real one.

    The build is stood in for as well, by the identity: these fixtures are plain HTML with no front
    matter and no Sass, which is exactly what the build leaves alone, and running Node twice per
    validate_plan() call would make the suite slow and need `npm ci` to run at all. What the real
    build does, and that the reachability axiom is judged on its output, is BuildPipelineTest's job.
    """

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name).resolve()
        self.site = self.root / "site"
        self.site.mkdir()
        (self.site / "index.html").write_text("<h1>interesting</h1>")
        (self.site / "error.html").write_text("<h1>not found</h1>")
        for name, value in [("SITE_DIR", self.site), ("build_site", dict)]:
            patcher = mock.patch.object(mi, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)


class SafeSitePathTest(SiteDirTestCase):
    def test_accepts_paths_inside_site(self):
        self.assertEqual(mi.safe_site_path("index.html"), self.site / "index.html")
        self.assertEqual(mi.safe_site_path("toys/clock.html"), self.site / "toys" / "clock.html")
        self.assertEqual(mi.safe_site_path("site/css/style.css"), self.site / "css" / "style.css")
        self.assertEqual(mi.safe_site_path("a_b/c-d.e/2048.min.js"), self.site / "a_b" / "c-d.e" / "2048.min.js")
        for fine in ["console.js", "aux-page.html", "com10.css", "nullable/x.html", "a.html"]:
            self.assertEqual(mi.safe_site_path(fine), self.site / fine)

    def test_accepts_the_files_the_build_is_made_of(self):
        # Issue #25: the model writes the layout and the shared styles too, so a leading "_" -- how
        # both halves of the build mark what is not a page -- and the two source types are allowed.
        for fine in ["_includes/layout.njk", "_sass/_tokens.scss", "css/site.scss", "_data/nav.json"]:
            with self.subTest(fine=fine):
                self.assertEqual(mi.safe_site_path(fine), self.site / fine)
        for extension in [".njk", ".scss"]:
            self.assertIn(extension, mi.ALLOWED_EXTENSIONS)

    def test_rejects_paths_that_leave_site_or_are_not_static(self):
        bad = [
            "", "   ", None, 7,
            "/etc/passwd", "../README.md", "a/../../x.html", "C:\\x.html", "a\\b.html",
            ".github/workflows/x.yml", ".hidden.html", "a/.git/config.txt", "x\x00.html",
            "run.sh", "page.php", "noextension", "site",
            # Only lowercase letters, digits, ".", "_" and "-": no way to start a new log line,
            # no case games with the protected files, nothing exotic.
            "a\n::error title=Leaked::rotate now.html", "a\rb.html", "a\x1b[31m.html", "a\u2028b.html",
            "Index.html", "ERROR.HTML", "my page.html", "caf\u00e9.html", "a/-b/c.html", "x.html ", "x.html.",
            "a/" * 8 + "x.html", "a" * 101 + ".html",
            # A Windows checkout refuses these, which would break every clone there.
            "aux.html", "con.js", "nul.txt", "prn.css", "com1.css", "lpt9.svg", "con/x.html", "a./b.html", "a-/b.html",
        ]
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(mi.RejectedChange):
                mi.safe_site_path(raw)

    def test_rejects_symlink_escape(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.site / "link").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(mi.RejectedChange):
            mi.safe_site_path("link/evil.html")


class ParseResponseTest(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(mi.parse_response('{"summary": "s", "files": []}'), {"summary": "s", "files": []})

    def test_json_wrapped_in_prose_fences_and_thinking(self):
        text = '<think>{"not": "this"}</think>Here you go:\n```json\n{"summary": "s"}\n```\nEnjoy!'
        self.assertEqual(mi.parse_response(text), {"summary": "s"})

    def test_rejects_answers_without_a_json_object(self):
        for text in ["", "no json here", "[1, 2, 3]", "}{"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                mi.parse_response(text)

    def test_invalid_json_is_rejected_not_repaired(self):
        # \' and \d are not JSON escapes. A model that writes them has stopped escaping its code,
        # and its valid-looking \n and \b cannot be trusted either, so the whole answer goes.
        for text in ['{"a": "it\\\'s"}', '{"a": "\\d+"}', '{"a": "line1\nline2"}', '{"a": ']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                mi.parse_response(text)


def events(*lines):
    return mi.parse_events("\n".join(lines))


class ExtractAnswerTest(unittest.TestCase):
    def test_parse_events_ignores_everything_that_is_not_an_event_object(self):
        parsed = mi.parse_events("\n".join(["not json at all", "[1]", '"x"', "", event("session.info", message="hi")]))
        self.assertEqual(parsed, [{"type": "session.info", "data": {"message": "hi"}}])

    def test_unusual_line_separators_inside_an_answer_do_not_split_the_event(self):
        content = "before\u2028middle\u2029after\x85end"
        line = json.dumps({"type": "assistant.message", "data": {"content": content}}, ensure_ascii=False)
        self.assertEqual(mi.extract_answer(mi.parse_events(line + "\r\n"), "m"), content)

    def test_absurdly_nested_output_is_ignored_not_fatal(self):
        self.assertEqual(mi.parse_events("[" * 100_000), [])
        with self.assertRaises((ValueError, RecursionError)):
            mi.parse_response('{"files": ' + "[" * 100_000 + "}")

    def test_returns_last_non_empty_assistant_message(self):
        parsed = events(
            event("session.info", message="Disabled tools: bash"),
            event("session.tools_updated", model="m"),
            event("assistant.turn_start", turnId="0"),
            event("assistant.message", content="first"),
            event("assistant.message", content="second", toolRequests=[], model="m"),
            event("assistant.message", content="   "),
            json.dumps({"type": "result", "exitCode": 0}),
        )
        self.assertEqual(mi.extract_answer(parsed, "m"), "second")

    def test_no_answer_is_a_model_error(self):
        for parsed in [[], events(event("assistant.message", content=None)),
                       events('{"type": "assistant.message", "data": "oops"}')]:
            with self.subTest(parsed=parsed), self.assertRaisesRegex(mi.ModelError, "empty response"):
                mi.extract_answer(parsed, "m")

    def test_any_tool_use_is_a_silo_breach(self):
        breaches = [
            events(event("tool.execution_start", toolName="bash"), event("assistant.message", content="{}")),
            events(event("assistant.message", content="{}", toolRequests=[{"name": "view"}])),
        ]
        for parsed in breaches:
            with self.subTest(parsed=parsed), self.assertRaises(mi.SiloBreach):
                mi.extract_answer(parsed, "m")

    def test_answer_from_a_different_model_is_rejected(self):
        for kind in ["assistant.message", "session.tools_updated"]:
            parsed = events(event(kind, model="some-small-model"), event("assistant.message", content="{}"))
            with self.subTest(kind=kind), self.assertRaisesRegex(mi.ModelError, "instead of m"):
                mi.extract_answer(parsed, "m")

    def test_answer_continued_past_the_output_limit_is_rejected(self):
        parsed = events(event("assistant.turn_start", turnId="0"), event("assistant.turn_start", turnId="1"),
                        event("assistant.message", content='the tail of a cut-off answer"}'))
        with self.assertRaisesRegex(mi.ModelError, "output limit"):
            mi.extract_answer(parsed, "m")

    def continued(self, *pieces):
        """The events of an answer the model wrote across one turn per piece."""
        lines = []
        for turn, piece in enumerate(pieces):
            lines.append(event("assistant.turn_start", turnId=str(turn)))
            lines.append(event("assistant.message", content=piece))
        return events(*lines)

    def test_an_answer_carried_on_past_the_output_limit_is_put_back_together(self):
        # What the failing run threw away (issue #77): the answer did not fit in one turn, the CLI
        # carried it on in a second, and both pieces are there to be joined. No separator: a
        # continuation resumes exactly where the model stopped, which can be mid-token.
        whole = '{"summary": "a long answer", "files": [{"path": "a.html", "content": "<p>x</p>"}]}'
        for cut in range(1, len(whole)):
            with self.subTest(cut=cut), mock.patch("builtins.print") as printed:
                parsed = self.continued(whole[:cut], whole[cut:])
                self.assertEqual(mi.extract_answer(parsed, "m"), whole)
                self.assertIn("m ran past its output limit", printed.call_args.args[0])
        self.assertEqual(mi.parse_response(whole)["summary"], "a long answer")

    def test_a_model_that_started_the_answer_over_keeps_its_last_piece(self):
        # The other way a model can answer across turns: not carrying the cut-off answer on but
        # writing a fresh one. Joining those two would be nonsense, so the whole piece wins.
        parsed = self.continued('{"summary": "cut off half way th', '{"summary": "all over again"}')
        with mock.patch("builtins.print"):
            self.assertEqual(mi.extract_answer(parsed, "m"), '{"summary": "all over again"}')

    def test_pieces_that_do_not_make_an_answer_either_way_are_still_refused(self):
        # The backstop is unchanged: an answer that cannot be put back together is the model's
        # failure, and the run goes to another model.
        for pieces in [('{"summary": "cut off half way th', 'rough, and cut off aga'),
                       ("prose, not a plan", "more prose")]:
            with self.subTest(pieces=pieces), self.assertRaisesRegex(mi.ModelError, "output limit"):
                mi.extract_answer(self.continued(*pieces), "m")

    def test_a_single_turn_still_reports_only_its_last_message(self):
        # The joining is for turns, not for messages: inside one turn the last message is the
        # answer, as it always was, and an earlier draft of it is not glued onto the front.
        parsed = events(event("assistant.turn_start", turnId="0"),
                        event("assistant.message", content='{"summary": "first thought"}'),
                        event("assistant.message", content='{"summary": "second thought"}'))
        self.assertEqual(mi.extract_answer(parsed, "m"), '{"summary": "second thought"}')

    def test_across_turns_each_turn_contributes_only_the_message_it_ended_on(self):
        # The same rule holds across turns: a turn that drafted before writing the piece it ended
        # on contributes only that last piece, so a stray draft is not joined into the answer.
        whole = '{"summary": "a long answer", "files": [{"path": "a.html", "content": "<p>x</p>"}]}'
        cut = len(whole) // 2
        parsed = events(event("assistant.turn_start", turnId="0"),
                        event("assistant.message", content="let me think about this first"),
                        event("assistant.message", content=whole[:cut]),
                        event("assistant.turn_start", turnId="1"),
                        event("assistant.message", content=whole[cut:]))
        with mock.patch("builtins.print"):
            self.assertEqual(mi.extract_answer(parsed, "m"), whole)


class ValidatePlanTest(SiteDirTestCase):
    def test_accepts_writes_and_deletes(self):
        (self.site / "old.html").write_text("old")
        ops = mi.validate_plan({
            "files": [{"path": "index.html", "content": "<h1>new</h1>"}, {"path": "a/b.css", "content": ""}],
            "delete": ["old.html"],
        })
        self.assertEqual([(a, t.relative_to(self.site).as_posix()) for a, t, _ in ops],
                         [("write", "index.html"), ("write", "a/b.css"), ("delete", "old.html")])
        with mock.patch("builtins.print"):
            mi.apply_ops(ops)
        self.assertEqual((self.site / "index.html").read_text(), "<h1>new</h1>")
        self.assertTrue((self.site / "a" / "b.css").is_file())
        self.assertFalse((self.site / "old.html").exists())

    def test_rejects_bad_plans(self):
        big = "x" * (mi.MAX_FILE_BYTES + 1)
        (self.site / "folder.html").mkdir()
        bad = [
            {},
            {"files": [], "delete": []},
            {"files": "index.html"},
            {"files": [{"path": "index.html"}]},
            {"files": [{"path": "index.html", "content": 5}]},
            {"files": ["index.html"]},
            {"files": [{"path": "../x.html", "content": "x"}]},
            {"files": [{"path": "big.html", "content": big}]},
            {"files": [{"path": "app.js", "content": "s.match(/\x08\\d+\x08/g)"}]},  # \b decoded as backspace
            {"files": [{"path": "index.html/x.html", "content": "x"}]},  # index.html is a file
            {"files": [{"path": "a.html", "content": "x"}, {"path": "a.html/b.html", "content": "x"}]},
            {"files": [{"path": "folder.html", "content": "x"}]},  # exists as a folder
            {"files": [{"path": "index.html", "content": "  "}]},
            {"delete": ["index.html"]},
            {"delete": ["site/error.html"]},
            {"files": [{"path": "fine.html", "content": "x"}, {"path": "../x.html", "content": "x"}]},
            {"files": [{"path": f"p{i}.html", "content": "x"} for i in range(mi.MAX_CHANGES + 1)]},
        ]
        for plan in bad:
            with self.subTest(plan=str(plan)[:80]), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)


    def test_accepts_a_run_that_only_consolidates(self):
        # Issue #16: a run whose entire change is a holistic improvement -- here, retiring two
        # pages that overlapped -- is a successful run, with no new file to go with it.
        (self.site / "a.html").write_text("a")
        (self.site / "b.html").write_text("b")
        ops = mi.validate_plan({"summary": "Retired two overlapping pages.", "delete": ["a.html", "b.html"]})
        self.assertEqual([(action, t.name) for action, t, _ in ops],
                         [("delete", "a.html"), ("delete", "b.html")])
        with mock.patch("builtins.print"):
            mi.apply_ops(ops)
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

    def test_files_the_model_was_not_shown_cannot_be_touched(self):
        (self.site / "big.js").write_text("y")
        for plan in [{"files": [{"path": "big.js", "content": "new"}]}, {"delete": ["site/big.js"]}]:
            with self.subTest(plan=plan), self.assertRaisesRegex(mi.RejectedChange, "not shown"):
                mi.validate_plan(plan, unseen=["big.js"])
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "new.js", "content": "x"}]}, unseen=["big.js"])), 1)

    def test_the_prompt_has_room_for_both_fixed_pages_and_any_one_other_file(self):
        self.assertGreaterEqual(mi.PROMPT_BUDGET_CHARS, 3 * mi.MAX_FILE_BYTES)

    def test_a_file_that_exists_may_be_changed_by_edits(self):
        # The passages that change, in order, instead of the whole file: character for character
        # where the model quoted the file faithfully, and line for line with the indentation and
        # the spaces at line ends forgiven where it did not.
        (self.site / "app.js").write_text("var a = 1;\nvar b = 2;\n  var c = 3;  \nvar d = 4;\n")
        ops = mi.validate_plan({"files": [{"path": "app.js", "edits": [
            {"find": "var b = 2;", "replace": "var b = 20;"},
            {"find": "var c = 3;\nvar d = 4;", "replace": "var c = 30;\nvar d = 4;\nvar e = 5;"},
            {"find": "var a = 1;\n", "replace": ""},
        ]}]})
        self.assertEqual(ops, [("write", self.site / "app.js", "var b = 20;\nvar c = 30;\nvar d = 4;\nvar e = 5;\n")])
        with mock.patch("builtins.print"):
            mi.apply_ops(ops)
        self.assertEqual((self.site / "app.js").read_text(), "var b = 20;\nvar c = 30;\nvar d = 4;\nvar e = 5;\n")

    def test_an_edit_that_matches_nowhere_or_twice_refuses_the_whole_answer(self):
        # An edit landed in the wrong place would be a change nobody asked for, so the answer is
        # refused and the refusal names the file and the passage, for the model to try again.
        (self.site / "app.js").write_text("x = 1;\ny = 1;\nx = 1;\n")
        cases = [
            ([{"find": "z = 1;", "replace": "z = 2;"}], "edit 1 of app.js matches nowhere.*'z = 1;'"),
            ([{"find": "x = 1;", "replace": "x = 2;"}], "edit 1 of app.js is ambiguous.*occurs 2 times"),
            # The second edit is applied to the file as the first left it.
            ([{"find": "y = 1;", "replace": "y = 2;"}, {"find": "y = 1;", "replace": "y = 3;"}],
             "edit 2 of app.js matches nowhere"),
        ]
        for edits, why in cases:
            with self.subTest(why=why), self.assertRaisesRegex(mi.RejectedChange, why):
                mi.validate_plan({"files": [{"path": "app.js", "edits": edits}]})
        self.assertEqual((self.site / "app.js").read_text(), "x = 1;\ny = 1;\nx = 1;\n")

    def test_edits_are_held_to_the_same_rules_as_a_rewrite(self):
        (self.site / "app.js").write_text("x = 1;\n")
        (self.site / "unseen.js").write_text("u = 1;\n")
        edit = [{"find": "x = 1;", "replace": "x = 2;"}]
        bad = [
            ({"files": [{"path": "app.js", "edits": edit, "content": "x = 2;\n"}]}, "one or the other"),
            ({"files": [{"path": "new.js", "edits": edit}]}, "no such file"),
            ({"files": [{"path": "app.js", "edits": []}]}, "non-empty list"),
            ({"files": [{"path": "app.js", "edits": "x = 2;"}]}, "non-empty list"),
            ({"files": [{"path": "app.js", "edits": [{"find": "x = 1;"}]}]}, "both strings"),
            ({"files": [{"path": "app.js", "edits": [{"find": "  \n", "replace": "x"}]}]}, "finds nothing"),
            ({"files": [{"path": "app.js", "edits": [{"find": "x = 1;", "replace": "s.match(/\x08\\d+\x08/g)"}]}]},
             "control character"),
            ({"files": [{"path": "app.js", "edits": [{"find": "x = 1;", "replace": "y" * (mi.MAX_FILE_BYTES + 1)}]}]},
             "too large"),
            ({"files": [{"path": "index.html", "edits": [{"find": "<h1>interesting</h1>", "replace": " "}]}]},
             "refusing to empty"),
            ({"files": [{"path": mi.STATE_SCRIPT, "edits": edit}]}, "refusing to rewrite"),
            ({"files": [{"path": "unseen.js", "edits": [{"find": "u = 1;", "replace": "u = 2;"}]}]}, "not shown"),
        ]
        for plan, why in bad:
            with self.subTest(why=why), self.assertRaisesRegex(mi.RejectedChange, why):
                mi.validate_plan(plan, unseen=["unseen.js"])
        self.assertEqual((self.site / "app.js").read_text(), "x = 1;\n")

    def test_edits_reach_a_file_too_big_to_send_whole(self):
        # The shell's own scripts outgrew MAX_FILE_BYTES, so no run could change them at all. By
        # edits a run can, and an edited file may stand past the limit a whole file is held to:
        # the limit is about runaway answers, and an edit's cost is the passage, not the file.
        big = "// header\n" + "x();\n" * (mi.MAX_FILE_BYTES // 5)
        self.assertGreater(len(big), mi.MAX_FILE_BYTES)
        (self.site / "big.js").write_text(big)
        ops = mi.validate_plan({"files": [{"path": "big.js", "edits": [{"find": "// header\n", "replace": "// header\ny();\n"}]}]})
        self.assertEqual(ops[0][2], "// header\ny();\n" + "x();\n" * (mi.MAX_FILE_BYTES // 5))
        with self.assertRaisesRegex(mi.RejectedChange, "too large.*changed by edits"):
            mi.validate_plan({"files": [{"path": "big.js", "content": big + "y();\n"}]})


class CleanSummaryTest(unittest.TestCase):
    def test_keeps_plain_sentences(self):
        text = "Added a clock (it's 100% CSS); try it: fast, fun & free!"
        self.assertEqual(mi.clean_summary(text), text)
        self.assertEqual(mi.clean_summary("Añadió un reloj"), "Añadió un reloj")

    def test_first_line_only_and_bounded(self):
        self.assertEqual(mi.clean_summary("  one   two \n three"), "one two")
        self.assertEqual(len(mi.clean_summary("x" * 500)), 200)

    def test_falls_back_to_the_mission(self):
        for empty in [None, "", "   ", "\n", "###", 0]:
            with self.subTest(empty=empty):
                self.assertEqual(mi.clean_summary(empty), mi.MISSION)

    def test_strips_what_github_would_act_on(self):
        cleaned = mi.clean_summary("Fixes #1, closes org/repo#2 cc @octocat [click](https://evil.example) `x` <b>\x1b[31m")
        for char in "#@[]<>`/\\\x1b":
            self.assertNotIn(char, cleaned)
        self.assertEqual(mi.clean_summary("ok \ud83d"), "ok")  # a lone surrogate cannot be printed
        # "GH-1" is GitHub's other spelling of "#1".
        self.assertEqual(mi.clean_summary("Fixes GH-1, closes gh-22 and Gh-3"), "Fixes GH 1, closes gh 22 and Gh 3")
        self.assertEqual(mi.clean_summary("x_GH-7 and the gh-pages look"), "x_GH 7 and the gh-pages look")


class SetOutputTest(unittest.TestCase):
    def test_value_cannot_terminate_its_own_heredoc(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out"
            with mock.patch.dict(os.environ, {"GITHUB_OUTPUT": str(out)}):
                mi.set_output("summary", "__EOF__")
                mi.set_output("model", "EOF")
            text = out.read_text()
            self.assertEqual(read_outputs(text), {"summary": "__EOF__", "model": "EOF"})
            first, second = [line.split("<<")[1] for line in text.splitlines() if "<<" in line]
            self.assertNotEqual(first, second)

    def test_does_nothing_outside_actions(self):
        with mock.patch.dict(os.environ):
            os.environ.pop("GITHUB_OUTPUT", None)
            mi.set_output("summary", "x")


class BuildPromptTest(SiteDirTestCase):
    def test_prompt_contains_mission_site_files_and_format(self):
        prompt = mi.build_prompt(*mi.split_for_prompt(mi.read_site()))
        self.assertIn(mi.MISSION, prompt)
        self.assertIn("=== index.html ===\n<h1>interesting</h1>", prompt)
        self.assertIn("=== error.html ===", prompt)
        self.assertIn('"files"', prompt)
        self.assertIn("2 files in all", prompt)

    def test_files_over_budget_are_listed_by_name_only(self):
        (self.site / "huge.js").write_text("y" * (mi.PROMPT_BUDGET_CHARS + 1))
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual(omitted, ["huge.js"])
        prompt = mi.build_prompt(shown, omitted)
        self.assertNotIn("yyyy", prompt)
        self.assertIn("not shown to you: huge.js", prompt)
        self.assertIn("may not change or delete them", prompt)
        self.assertIn("3 files in all", prompt)  # the whole site is counted, not only what is shown
        # A file left out still belongs to the piece the run is asked to weigh, and the federation
        # it is part of can be continued by a run that is shown it.
        self.assertIn("weigh the site as a whole", prompt)
        self.assertIn("carried on by a later run", prompt)

    def test_every_file_gets_its_turn_in_the_prompt(self):
        # Three files that each fill most of the budget: only one fits per run. Whichever is left
        # out cannot be changed that run, so the choice must rotate rather than follow the alphabet.
        budget = 30_000
        for name in ["a.js", "b.js", "c.js"]:
            (self.site / name).write_text(name[0] * (budget - 1000))
        seen = set()
        for _ in range(60):
            with mock.patch.object(mi, "PROMPT_BUDGET_CHARS", budget):
                shown, omitted = mi.split_for_prompt(mi.read_site())
            names = [rel for rel, _ in shown]
            self.assertEqual(names[:2], ["index.html", "error.html"])
            self.assertEqual(len(names), 3)
            self.assertEqual(sorted(names + omitted), ["a.js", "b.js", "c.js", "error.html", "index.html"])
            seen.update(names[2:])
        self.assertEqual(seen, {"a.js", "b.js", "c.js"})

    def test_every_file_gets_its_turn_even_when_the_fixed_pages_are_as_big_as_allowed(self):
        # The tightest the budget is ever allowed to be, with the biggest files allowed: the two
        # fixed pages and exactly one other file fit, so that third place has to rotate.
        (self.site / "index.html").write_text("i" * mi.MAX_FILE_BYTES)
        (self.site / "error.html").write_text("e" * mi.MAX_FILE_BYTES)
        for name in ["a.js", "b.js", "c.js"]:
            (self.site / name).write_text(name[0] * mi.MAX_FILE_BYTES)
        seen = set()
        for _ in range(60):
            with mock.patch.object(mi, "PROMPT_BUDGET_CHARS", 3 * mi.MAX_FILE_BYTES):
                shown, omitted = mi.split_for_prompt(mi.read_site())
            names = [rel for rel, _ in shown]
            self.assertEqual(names[:2], ["index.html", "error.html"])
            self.assertEqual(len(names), 3)
            seen.update(names[2:])
        self.assertEqual(seen, {"a.js", "b.js", "c.js"})

    def test_home_page_is_the_last_file_to_be_left_out(self):
        budget = 30_000
        (self.site / "a.js").write_text("a" * (budget - 10))  # sorts first, fits only alone
        (self.site / "b.css").write_text("b" * 200)
        with mock.patch.object(mi, "PROMPT_BUDGET_CHARS", budget):
            shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual([rel for rel, _ in shown][:2], ["index.html", "error.html"])
        self.assertEqual(omitted, ["a.js"])
        self.assertIn("b.css", [rel for rel, _ in shown])

    def test_only_static_non_symlink_files_are_read(self):
        (self.site / "notes.bin").write_bytes(b"\x00\x01")
        (self.site / "link.html").symlink_to(self.site / "index.html")
        self.assertEqual([rel for rel, _ in mi.read_site()], ["error.html", "index.html"])

    def test_the_format_offers_edits_beside_whole_files(self):
        # What keeps an answer inside a model's output limit: a file that exists is changed by
        # quoting the passages that change, and only a new file is sent whole.
        prompt = mi.build_prompt([("index.html", "<h1>x</h1>")])
        for fact in ['"edits"', '"find"', '"replace"', "occur exactly once",
                     "Prefer edits for every file that already exists",
                     "can take a file past that size", "aim for a quarter of it and never pass half",
                     '"content", "find" and "replace" alike']:
            with self.subTest(fact=fact):
                self.assertIn(fact, prompt)
        self.assertNotIn("spend it", prompt)

    def test_feedback_comes_after_the_site_and_before_the_line_read_last(self):
        plain = mi.build_prompt([("index.html", "<h1>x</h1>")])
        self.assertNotIn("YOUR PREVIOUS ANSWER", plain)
        feedback = mi.repair_feedback('{"summary": "s"}', "the tests fail")
        told = mi.build_prompt([("index.html", "<h1>x</h1>")], feedback=feedback)
        self.assertLess(told.index("=== index.html ==="), told.index("YOUR PREVIOUS ANSWER WAS REFUSED"))
        self.assertLess(told.index("YOUR PREVIOUS ANSWER WAS REFUSED"), told.index("This run's mission:"))
        self.assertEqual(told.replace("\n\n" + feedback, ""), plain, "nothing else about the prompt changes")


class RepairFeedbackTest(unittest.TestCase):
    """A refused answer is not the end of the model's turn: it is shown its answer and the refusal
    and asked for the whole plan again (repair_feedback), and the next model, if it comes to that,
    is told in a line what went wrong (lesson_feedback)."""

    def test_a_refused_answer_is_shown_back_with_the_refusal_and_its_details(self):
        text = mi.repair_feedback('{"summary": "s"}', "the tests fail: X", details="FAIL: test_x\nAssertionError: no")
        for part in ["YOUR PREVIOUS ANSWER WAS REFUSED", "the site as committed",
                     "Why it was refused: the tests fail: X.", "The details:\nFAIL: test_x\nAssertionError: no",
                     'Your answer was:\n{"summary": "s"}', "Answer again with the whole plan, revised",
                     "put it back exactly as the site above shows it"]:
            with self.subTest(part=part):
                self.assertIn(part, text)

    def test_a_lost_answer_asks_for_a_smaller_one(self):
        text = mi.repair_feedback(None, "the answer ran past the model's output limit")
        self.assertIn("What went wrong: the answer ran past the model's output limit.", text)
        self.assertIn("Nothing of that answer survived", text)
        self.assertIn("Answer again, much smaller", text)
        self.assertNotIn("Your answer was:", text)

    def test_an_answer_past_the_limit_is_described_rather_than_shown(self):
        with mock.patch.object(mi, "PRIOR_ANSWER_LIMIT", 10):
            text = mi.repair_feedback('{"summary": "a long one"}', "the tests fail",
                                      digest="'a long one', touching a.html")
        self.assertIn("too long to show back to you (25 characters); it said: 'a long one', touching a.html.", text)
        self.assertIn("Answer again, much smaller", text)
        self.assertNotIn("Your answer was:", text)
        self.assertNotIn('{"summary": "a long one"}', text)

    def test_a_plan_is_digested_to_its_summary_and_the_files_it_touches(self):
        plan = {"summary": "Added a clock.", "files": [{"path": "a.html", "content": "x"}, "junk"], "delete": ["b.html"]}
        self.assertEqual(mi.plan_digest(plan), "'Added a clock.', touching a.html, b.html")
        self.assertEqual(mi.plan_digest({"files": "a.html", "delete": None}), "'', touching ")

    def test_the_lesson_for_the_next_model_is_one_line_of_what_went_wrong(self):
        text = mi.lesson_feedback("no answer within 900s")
        self.assertIn("EARLIER THIS RUN. Another model was asked first and its answer was refused: "
                      "no answer within 900s.", text)
        self.assertIn("the site above is the site as committed", text)


class WholeSiteReviewTest(unittest.TestCase):
    """Issue #16: every run begins by weighing the site as a whole, and federating what is already
    there is a successful run in its own right, not a lesser outcome than adding a page. Now that
    a run's mode is drawn from a bag (MarbleBagTest), the federating is the consolidating modes'
    whole work and the adding is the creating mode's; the weighing is every mode's."""

    def prompt(self, omitted=(), mode=mi.DEFAULT_MODE):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")], omitted, mi.Run(mode))

    def test_the_mission_string_itself_carries_the_holistic_aim(self):
        # Issue #16, question 4: the mission string itself should change, not only the surrounding
        # guidance. It still opens with the original phrase so every other use reads naturally.
        self.assertTrue(mi.MISSION.startswith("make the website more interesting"))
        self.assertNotEqual(mi.MISSION, "make the website more interesting")
        self.assertIn("coherent whole", mi.MISSION)

    def test_every_run_is_asked_to_weigh_the_site_as_a_whole_first(self):
        for mode, choice in [("create_item", "ADD one world"), ("enhance_item", "Make it more interesting"),
                             ("consolidate_overall", "RE-FEDERATE")]:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode=mode)
                self.assertIn("Every run begins this way", prompt)
                self.assertIn("look at the site as a whole", prompt)
                self.assertLess(prompt.index("site as a whole"), prompt.index(choice),
                                "the review has to come before the choice of change")

    def test_federation_is_offered_as_concretely_as_adding(self):
        # The creating run is told what to add; the consolidating run is told what to federate, by
        # the source paths a run actually writes and the built path a page links (issue #36).
        self.assertIn("add one world", self.prompt(mode="create_item").lower())
        prompt = self.prompt(mode="consolidate_overall").lower()
        self.assertIn("federate", prompt)
        for move in ["shared files", "css/site.scss", "css/site.css", "js/site.js",
                     "header and navigation", "visual language", "merge pages that overlap",
                     "retire"]:
            with self.subTest(move=move):
                self.assertIn(move, prompt)

    def test_a_run_that_only_federates_is_called_a_success(self):
        # validate_plan() has always accepted a plan that only deletes; the consolidating run's
        # prompt invites one, and both kinds are told that deleting is accepted.
        prompt = self.prompt(mode="consolidate_overall")
        self.assertIn("complete and successful run", prompt)
        self.assertIn("only deleting", prompt)
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode=mode)
                self.assertIn("only deletes is accepted", prompt)
                self.assertIn("do not add for the sake of adding", prompt)

    def test_a_federation_may_not_leave_the_site_half_done(self):
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode=mode)
                self.assertIn("Leave the site working at the end of the run", prompt)
                self.assertIn("update every page that refers to it in the same run", prompt)
                self.assertIn("coherent stages", prompt)  # a federation too big for one answer

    def test_the_silo_rules_survive_the_new_guidance(self):
        prompt = self.prompt(["hidden.html"])
        for rule in ["Only files of these types", "relative to the site root",
                     "index.html, error.html and sitemap.xml must always exist",
                     f"at most {mi.MAX_FILE_BYTES // 1000} KB", "COMPLETE new content",
                     f"At most {mi.MAX_CHANGES} files per run", "may not change or delete them"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, prompt)
        # The allowed types are listed rather than described, so the rule cannot drift from the set.
        for extension in mi.ALLOWED_EXTENSIONS:
            with self.subTest(extension=extension):
                self.assertIn(extension, prompt)

    # A run can only federate what it was shown, so the budget has to carry the whole site with
    # room for it to keep growing. This stand-in is half again as big as the site was when the mood
    # axiom gave every orientation a world of its own (57 files, 357 KB, the largest 38 KB).
    GROWN_SITE = ([("index.html", "i" * 50_000), ("error.html", "e" * 50_000)]
                  + [(f"page-{i:02d}.html", "x" * 11_000) for i in range(40)])

    def test_a_site_half_again_as_big_as_this_one_is_still_shown_whole(self):
        shown, omitted = mi.split_for_prompt(list(self.GROWN_SITE))
        self.assertEqual(omitted, [], "the prompt cannot carry the whole site, so a run cannot federate it")
        self.assertEqual(len(shown), len(self.GROWN_SITE))

    def test_one_run_may_rewrite_a_whole_site_and_add_the_files_it_shares(self):
        # Lifting the repeated parts into "css/site.css" and "js/site.js" and relinking every page
        # of a site that size takes len + 2 changes; the limit must not forbid it.
        self.assertGreaterEqual(mi.MAX_CHANGES, len(self.GROWN_SITE) + 2)


class SingleExperienceTest(SiteDirTestCase):
    """Issue #36: every run is told, every single time, to envision the site as one whole, so what
    is published is one functioning excellent experience and not a pile of pages that happen to
    share a domain.

    Issue #16 made the holistic pass a habit and federation a permitted outcome; issue #36 made
    the pass unconditional, re-federating the default work of a run, and adding the exception that
    still had to arrive federated. A run's mode is now drawn from a bag (MarbleBagTest): the pass
    is still unconditional and the same for every mode, re-federating is the whole of the
    consolidating modes, and what a creating run adds still has to arrive federated."""

    def prompt(self, omitted=(), mode=mi.DEFAULT_MODE):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")], omitted, mi.Run(mode))

    def consolidating(self, omitted=()):
        return self.prompt(omitted, "consolidate_overall")

    def test_the_whole_is_named_as_its_own_standard(self):
        # Spelled out here rather than imported, so rewording WHOLE into something that no longer
        # asks for one single experience fails this test instead of passing quietly. Issue #36,
        # question 2: MISSION carries the word "single" too, since it is the line read at both
        # ends -- and so does the consolidating run's mission, read at the same two ends.
        self.assertEqual(mi.WHOLE, "a single functioning excellent experience")
        self.assertIn("single coherent whole", mi.MISSION)
        self.assertIn("single coherent whole", mi.CONSOLIDATION_MISSION)
        self.assertTrue(mi.MISSION.startswith("make the website more interesting"))

    def test_every_run_envisions_the_whole_before_it_chooses_anything(self):
        for mode, choice in [("create_item", "ADD one world"), ("consolidate_overall", "RE-FEDERATE")]:
            prompt = self.prompt(mode=mode)
            self.assertIn("ENVISION THE WHOLE FIRST", prompt)
            for insistence in ["Every run begins this way", "with no exceptions",
                               "before you choose anything"]:
                with self.subTest(mode=mode, insistence=insistence):
                    self.assertIn(insistence, prompt)
            # The pass comes before the mode's own block and before the Rules block, so a run holds
            # the aim while the choice is still open rather than as a constraint on a settled one.
            for later in [choice, "Rules:"]:
                with self.subTest(mode=mode, later=later):
                    self.assertLess(prompt.index("ENVISION THE WHOLE FIRST"), prompt.index(later))

    def test_the_one_experience_is_spelled_out_rather_than_gestured_at(self):
        for mode in mi.MODES:
            envision = self.prompt(mode=mode)
            envision = envision[envision.index("ENVISION THE WHOLE FIRST"):envision.index("THIS RUN ")]
            for through_line in ["one navigation", "one visual language", "one through-line"]:
                with self.subTest(mode=mode, through_line=through_line):
                    self.assertIn(through_line, envision)
            self.assertIn(mi.WHOLE, envision)

    def test_re_federating_is_the_whole_work_of_a_consolidating_run(self):
        # Issue #36, question 1, as the bag keeps it: not "federating is also welcome" but "this is
        # what the run does" -- and on a consolidating run, all it does.
        prompt = self.consolidating()
        self.assertIn("RE-FEDERATE where the pages repeat what a shared file should do once", prompt)
        for posture in ["It adds nothing",
                        "take on the one that is overdue rather than the one that is merely easy",
                        "a consolidation that changes behaviour by accident is a regression, not a cleanup"]:
            with self.subTest(posture=posture):
                self.assertIn(posture, prompt)
        self.assertNotIn("ADD one world", prompt)

    def test_re_federating_names_every_shared_file_it_reaches(self):
        federate = self.consolidating()
        federate = federate[federate.index("RE-FEDERATE"):federate.index("REFACTOR AND CLEAN UP")]
        for target in [f"{mi.INCLUDES_DIR}/", f"{mi.SASS_DIR}/", "css/site.scss", "css/site.css",
                       "js/site.js"]:
            with self.subTest(target=target):
                self.assertIn(target, federate)
        for move in ["markup, styles and behaviour that the pages or the modules repeat",
                     "the same header and navigation", "one visual language and hold every page to it"]:
            with self.subTest(move=move):
                self.assertIn(move, federate)

    def test_re_federating_reaches_as_far_as_merging_and_retiring_pages(self):
        # Issue #36, question 4: yes -- the pages themselves, not only the markup they share.
        federate = self.consolidating()
        federate = federate[federate.index("RE-FEDERATE"):federate.index("REFACTOR AND CLEAN UP")]
        self.assertIn("merge pages that overlap", federate)
        self.assertIn("retire the ones that no longer earn their place", federate)
        self.assertIn("fewer pages that belong together than as more that do not", federate)

    def test_what_a_creating_run_adds_arrives_already_federated(self):
        add = self.prompt(mode="create_item")
        add = add[add.index("ADD one world"):add.index("LEGIBLE TO A STRANGER")]
        self.assertIn("arrives already federated, in the same run", add)
        self.assertIn("dealt by the feed and played on the stage like every other world", add)
        self.assertIn("nothing it adds may repeat what a shared file already does", add)
        # And what an enhancing run adds builds on what is there, inside the one whole.
        for mode in ["enhance_item", "enhance_nav", "enhance_persona", "enhance_overall"]:
            with self.subTest(mode=mode):
                self.assertIn("Build on what is already there rather than starting over", self.prompt(mode=mode))

    def test_the_aim_is_in_hand_at_both_ends_of_the_run(self):
        # The restatement pattern this repository uses for its standards (see EngagementTimeTest):
        # stated before a run chooses what to do, and again in the line it reads last.
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode=mode)
                self.assertGreaterEqual(prompt.count(mi.WHOLE), 2)
                self.assertLess(prompt.index(mi.WHOLE), prompt.index("Rules:"))
                last = prompt[prompt.index(f"This run's mission: {mi.mission_of(mi.Run(mode))}"):]
                self.assertIn(f"Envision all of the above as {mi.WHOLE}", last)
        last = self.consolidating()
        last = last[last.index("This run's mission:"):]
        self.assertIn("clean up the code and logic of the site-wide experience and the framework and fix its bugs", last)
        self.assertIn("and add nothing", last)
        last = self.prompt(mode="create_item")
        last = last[last.index("This run's mission:"):]
        self.assertIn("add one new world as part of the same whole, already federated, and nothing else", last)
        self.assertIn("leave the consolidating, and every other area, to the runs that draw them", last)

    def test_a_federation_the_run_cannot_finish_is_carried_on_by_the_next(self):
        # Aggressive, not reckless: the answer limit has not moved, so the way to be aggressive
        # about something too big for one answer is to stage it, never to leave it half done.
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode=mode)
                self.assertIn("coherent stages", prompt)
                self.assertIn("Leave the site working at the end of the run", prompt)

    def test_the_files_a_run_cannot_see_still_count_as_part_of_the_whole(self):
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(["hidden.html"], mode)
                self.assertIn("count them as part of the piece when you weigh the site as a whole", prompt)
                self.assertIn("carried on by a later run", prompt)

    def test_the_aim_is_a_stated_standard_and_not_a_coded_axiom(self):
        # Issue #36, question 3: prompt-only. No check could settle whether a site reads as one
        # experience, so this aim is not among the coded axioms -- a page that shares nothing with
        # the rest is accepted, exactly as before, and the prompt is where the aim lives. (The same
        # reasoning INTERESTING is left uncoded for.) The list is asserted whole, so an axiom
        # cannot be added or dropped without saying so here; issue #42 added check_destructive and
        # the completion axiom added check_completion, which is why this no longer counts the
        # axioms in its own name.
        (self.site / "index.html").write_text(home("sitemap.xml", "stranger.html", "error.html"))
        (self.site / "sitemap.xml").write_text(sitemap("index.html", "error.html"))
        stranger = page(title="stranger", css=".stranger { color: #fff; background: #000; }")
        ops = mi.validate_plan({
            "summary": "Added a page that shares nothing with the rest of the site.",
            "files": [{"path": "stranger.html", "content": stranger},
                      {"path": "sitemap.xml",
                       "content": sitemap("index.html", "error.html", "stranger.html")}],
        })
        self.assertEqual(sorted(t.name for _, t, _ in ops), ["sitemap.xml", "stranger.html"])
        self.assertEqual(sorted(name for name in dir(mi) if name.startswith("check_")),
                         CODED_AXIOMS)




class MarbleBagTest(SiteDirTestCase):
    """What a run does is drawn from a bag of marbles: a mode -- a kind of work on one area of the
    site -- with as many marbles in the bag as its weight says, drawn once per run. An item mode
    draws the world it works on the same way. The manual input can name a mode, or a kind of work
    to draw among; the prompt, the console line, the outputs and the commit headline all follow
    the draw, and each mode's block of the prompt names its files and what the deploy's tests
    hold in place there."""

    WORLDS = [{"file": "quiet-room.html", "name": "the quiet room", "orientation": "banked low",
               "mood": "tender", "aspect": "1 / 1", "what": "Set the pace of a breath."},
              {"file": "loam.html", "name": "loam", "orientation": "low and slow", "mood": "rooted",
               "aspect": "4 / 5", "what": "Plant and water."},
              {"file": "word-kiln.html", "name": "the word kiln", "orientation": "verbal",
               "mood": "verbal", "aspect": "5 / 4", "what": "Feed words into the kiln."}]

    def prompt(self, mode, items=(), omitted=()):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")], omitted, mi.Run(mode, items))

    def mode(self, **env):
        with mock.patch.dict(os.environ, {"RUN_MODE": "", **env}):
            with mock.patch("builtins.print") as printed:
                return mi.chosen_mode(), " ".join(str(call.args[0]) for call in printed.call_args_list)

    def test_the_weights_are_the_ones_asked_for(self):
        # Spelled out rather than imported, so a weight cannot drift without a test saying so.
        self.assertEqual(mi.MODE_MARBLES, {
            "create_item": 1, "enhance_item": 14, "enhance_nav": 5, "enhance_persona": 4,
            "enhance_overall": 5, "consolidate_item": 4, "consolidate_nav": 2,
            "consolidate_persona": 3, "consolidate_overall": 4})
        self.assertEqual(mi.MODES, tuple(mi.MODE_MARBLES))
        for mode in mi.MODES:
            work, area = mode.split("_", 1)
            self.assertIn(work, mi.WORKS)
            self.assertIn(area, mi.AREAS)
        self.assertEqual(mi.DEFAULT_MODE, max(mi.MODE_MARBLES, key=mi.MODE_MARBLES.get))

    def test_the_bag_holds_one_marble_per_unit_of_weight(self):
        bag = mi.marble_bag(mi.MODE_MARBLES)
        self.assertEqual(len(bag), 42)
        for mode, weight in mi.MODE_MARBLES.items():
            with self.subTest(mode=mode):
                self.assertEqual(bag.count(mode), weight)
        self.assertEqual(bag[:2], ["create_item", "enhance_item"], "in the order the weights were given")
        self.assertEqual(mi.marble_bag({"a": 0, "b": -1, "c": "2", "d": 2}), ["d", "d"])
        self.assertIsNone(mi.draw_marble({}))

    def test_a_draw_is_one_marble_from_the_whole_bag(self):
        bags = []

        def choice(bag):
            bags.append(list(bag))
            return bag[-1]

        with mock.patch.object(mi.random, "choice", choice):
            self.assertEqual(self.mode(), ("consolidate_overall", ""))
            self.assertEqual(self.mode(RUN_MODE="auto"), ("consolidate_overall", ""))
        self.assertEqual(bags, [mi.marble_bag(mi.MODE_MARBLES)] * 2)

    def test_the_draw_follows_the_weights(self):
        random.seed(20261008)
        drawn = [mi.draw_marble(mi.MODE_MARBLES) for _ in range(4200)]
        for mode, weight in mi.MODE_MARBLES.items():
            with self.subTest(mode=mode):
                self.assertAlmostEqual(drawn.count(mode) / 100, weight, delta=max(1.5, weight / 4))

    def test_a_mode_named_by_hand_wins_over_the_bag(self):
        with mock.patch.object(mi.random, "choice", side_effect=AssertionError("the bag was drawn from")):
            for mode in mi.MODES:
                with self.subTest(mode=mode):
                    self.assertEqual(self.mode(RUN_MODE=mode), (mode, ""))
            self.assertEqual(self.mode(RUN_MODE=" Enhance-Nav "), ("enhance_nav", ""))

    def test_a_kind_of_work_draws_among_its_own_modes(self):
        bags = []

        def choice(bag):
            bags.append(list(bag))
            return bag[0]

        with mock.patch.object(mi.random, "choice", choice):
            self.assertEqual(self.mode(RUN_MODE="consolidate"), ("consolidate_item", ""))
            self.assertEqual(self.mode(RUN_MODE="enhance"), ("enhance_item", ""))
            self.assertEqual(self.mode(RUN_MODE="create"), ("create_item", ""))
            # The old name for the runs that grow the site: everything but consolidating.
            self.assertEqual(self.mode(RUN_MODE="interesting"), ("create_item", ""))
        self.assertEqual(sorted(set(bags[0])), ["consolidate_item", "consolidate_nav",
                                                "consolidate_overall", "consolidate_persona"])
        self.assertEqual(bags[0].count("consolidate_item"), 4)
        self.assertEqual(sorted(set(bags[1])), ["enhance_item", "enhance_nav", "enhance_overall", "enhance_persona"])
        self.assertEqual(bags[2], ["create_item"])
        self.assertEqual(sorted(set(bags[3])), ["create_item", "enhance_item", "enhance_nav",
                                                "enhance_overall", "enhance_persona"])

    def test_an_unknown_mode_is_warned_about_and_the_bag_decides(self):
        mode, log = self.mode(RUN_MODE="tidy")
        self.assertIn(mode, mi.MODES)
        self.assertIn("'tidy' is not one of create_item, enhance_item", log)
        self.assertIn("drawing from the bag instead", log)

    def test_the_worlds_are_read_from_the_data(self):
        files = [("index.html", "x"), (mi.WORLDS_DATA, json.dumps({"worlds": self.WORLDS, "wayIn": []}))]
        self.assertEqual(mi.site_worlds(files), self.WORLDS)
        self.assertEqual(mi.site_worlds([("index.html", "x")]), [])
        self.assertEqual(mi.site_worlds([(mi.WORLDS_DATA, "{not json")]), [])
        self.assertEqual(mi.site_worlds([(mi.WORLDS_DATA, json.dumps(["a list"]))]), [])
        self.assertEqual(mi.site_worlds([(mi.WORLDS_DATA, json.dumps({"worlds": "x"}))]), [])
        odd = {"worlds": [{"file": "a.html"}, {"file": 3}, "junk", {"name": "no file"},
                          {"file": "sub/b.html"}, {"file": "notes.txt"}]}
        self.assertEqual(mi.site_worlds([(mi.WORLDS_DATA, json.dumps(odd))]), [{"file": "a.html"}])

    def test_an_item_mode_draws_its_worlds_at_random(self):
        self.assertEqual(mi.draw_items([]), [])
        self.assertEqual(mi.ITEM_COUNT_MARBLES, {1: 4, 2: 2, 3: 1})
        with mock.patch.object(mi.random, "choice", lambda bag: 2):
            drawn = mi.draw_items(self.WORLDS)
            self.assertEqual(len(drawn), 2)
            self.assertTrue(all(world in self.WORLDS for world in drawn))
            self.assertEqual(len(mi.draw_items(self.WORLDS[:1])), 1, "never more than there are")
        random.seed(7)
        counts = {len(mi.draw_items(self.WORLDS)) for _ in range(200)}
        self.assertEqual(counts, {1, 2, 3})

    def test_the_bag_deals_the_run_and_its_worlds(self):
        files = [("index.html", "x"), (mi.WORLDS_DATA, json.dumps({"worlds": self.WORLDS}))]
        with mock.patch.object(mi, "chosen_mode", return_value="enhance_item"):
            run = mi.deal_run(files)
        self.assertEqual(run.mode, "enhance_item")
        self.assertTrue(1 <= len(run.items) <= 3)
        self.assertTrue(all(world in self.WORLDS for world in run.items))
        for mode in ["create_item", "enhance_nav", "consolidate_overall"]:
            with mock.patch.object(mi, "chosen_mode", return_value=mode):
                with self.subTest(mode=mode):
                    self.assertEqual(mi.deal_run(files), mi.Run(mode))
        with mock.patch.object(mi, "chosen_mode", return_value="consolidate_item"):
            self.assertEqual(mi.deal_run([("index.html", "x")]).items, [], "no list, no draw")

    def test_a_run_knows_its_work_its_area_and_its_worlds(self):
        run = mi.Run("consolidate_item", self.WORLDS[:2])
        self.assertEqual((run.work, run.area, run.items), ("consolidate", "item", self.WORLDS[:2]))
        self.assertEqual(mi.Run("create_item", self.WORLDS).items, [], "a creating run makes its own world")
        self.assertEqual(mi.Run("enhance_nav", self.WORLDS).items, [])
        self.assertEqual(mi.Run("enhance_item", ["junk", self.WORLDS[0]]).items, self.WORLDS[:1])
        with self.assertRaises(ValueError):
            mi.Run("tidy")
        self.assertEqual(mi.Run("enhance_nav"), mi.Run("enhance_nav"))
        self.assertNotEqual(mi.Run("enhance_nav"), mi.Run("consolidate_nav"))

    def test_the_drawn_worlds_are_named_as_prose_names_them(self):
        self.assertEqual(mi.name_items([]), "")
        self.assertEqual(mi.name_items(self.WORLDS[:1]), "the quiet room")
        self.assertEqual(mi.name_items(self.WORLDS[:2]), "the quiet room and loam")
        self.assertEqual(mi.name_items(self.WORLDS), "the quiet room, loam and the word kiln")
        # A name is the model's own data, so it is cleaned as a summary is before it reaches a
        # commit message, and a world without one goes by its page.
        self.assertEqual(mi.world_name({"file": "x.html", "name": "fixes #1 @you <b>now</b>"}), "fixes 1 you bnowb")
        self.assertEqual(mi.world_name({"file": "quiet-room.html"}), "quiet-room")
        self.assertEqual(mi.world_name({"file": "quiet-room.html", "name": 7}), "quiet-room")
        self.assertEqual(mi.world_name({}), "a world")
        self.assertEqual(len(mi.world_name({"file": "x.html", "name": "n" * 300})), 60)

    def test_the_mission_and_the_headline_follow_the_mode(self):
        quiet = self.WORLDS[:1]
        expected = {
            "create_item": ("Create a world", "creating one new world, federated into the whole"),
            "enhance_item": ("Enhance the quiet room", "enhancing the quiet room"),
            "enhance_nav": ("Enhance the navigation", "enhancing the navigation"),
            "enhance_persona": ("Enhance the persona", "enhancing the persona"),
            "enhance_overall": ("Enhance the site", "enhancing the site-wide experience and the framework"),
            "consolidate_item": ("Consolidate the quiet room", "cleaning up the code and logic of the quiet room and fixing its bugs"),
            "consolidate_nav": ("Consolidate the navigation", "cleaning up the code and logic of the navigation"),
            "consolidate_persona": ("Consolidate the persona", "cleaning up the code and logic of the persona"),
            "consolidate_overall": ("Consolidate the site", "cleaning up the code and logic of the site-wide experience"),
        }
        for mode, (headline, aim) in expected.items():
            with self.subTest(mode=mode):
                run = mi.Run(mode, quiet)
                self.assertEqual(mi.headline_of(run), headline)
                mission = mi.mission_of(run)
                base = mi.CONSOLIDATION_MISSION if run.work == "consolidate" else mi.MISSION
                self.assertTrue(mission.startswith(base + ", by "), mission)
                self.assertIn(aim, mission)
        self.assertEqual(mi.headline_of(mi.Run("enhance_item")), "Enhance a world")
        self.assertEqual(mi.headline_of(mi.Run("enhance_item", self.WORLDS[:2])), "Enhance the quiet room and loam")
        self.assertIn("by enhancing one world", mi.mission_of(mi.Run("enhance_item")))
        self.assertEqual(mi.clean_summary("", mi.CONSOLIDATION_MISSION), mi.CONSOLIDATION_MISSION)
        self.assertEqual(mi.clean_summary(None), mi.MISSION)

    def test_the_modes_differ_in_one_block_of_the_prompt(self):
        typical = self.prompt(mi.DEFAULT_MODE)
        holds = "LEGIBLE TO A STRANGER. Everything above"  # the heading, not the block's mention of it
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode, self.WORLDS[:1])
                # Everything from the look at the whole up to the mode's own block is the same...
                self.assertEqual(prompt[prompt.index("ENVISION"):prompt.index("THIS RUN ")],
                                 typical[typical.index("ENVISION"):typical.index("THIS RUN ")])
                # ...and so is everything from the legibility holds to the line read last: the
                # holds, the build, the nine axioms and the format are not the mode's to vary.
                self.assertEqual(prompt[prompt.index(holds):prompt.index("This run's mission")],
                                 typical[typical.index(holds):typical.index("This run's mission")])
                self.assertEqual(prompt.count("AXIOM, every run"), len(CODED_AXIOMS))
                self.assertLess(prompt.index("THIS RUN "), prompt.index(holds))

    def test_every_mode_says_how_it_was_drawn_and_what_a_whole_run_is(self):
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode)
                block = prompt[prompt.index("THIS RUN "):prompt.index("LEGIBLE TO A STRANGER. Everything")]
                for part in ["THE BAG OF MARBLES", f"this run drew {mode}", "enhance_item 14", "of 42",
                             "leave the rest to the runs that draw them",
                             "WHAT THE DEPLOY'S TESTS HOLD IN PLACE", "harnesses a run cannot change",
                             "complete and successful run", "do not add for the sake of adding",
                             "SIZE. The answer is small by design", "One coherent stage"]:
                    self.assertIn(part, block, part)

    def test_each_mode_names_its_work_and_its_files(self):
        quiet = self.WORLDS[:1]
        said = {
            "create_item": ["THIS RUN CREATES ONE NEW WORLD", "ADD one world and nothing else",
                            '"js/modules/thing.js"', "arrives already federated, in the same run",
                            "does not change for a new world", "Tidy nothing"],
            "enhance_item": ["THIS RUN ENHANCES THE QUIET ROOM", 'the quiet room ("quiet-room.html", module "js/modules/quiet-room.js"): Set the pace of a breath.',
                             "Make it more interesting", "Work inside its own files",
                             "it is not this run's to change", "Add no world and no page, and tidy nothing"],
            "enhance_nav": ["THIS RUN ENHANCES THE NAVIGATION", "What the navigation is",
                            "Make getting around more interesting", "Nothing that adds a second navigation"],
            "enhance_persona": ["THIS RUN ENHANCES THE PERSONA", "What the persona is",
                                "Make configuring a persona more interesting", "never in a world's module"],
            "enhance_overall": ["THIS RUN ENHANCES THE WHOLE SITE", "The framework is the layout",
                                "Not a new world (that is create_item's run)", "only what is shared"],
            "consolidate_item": ["THIS RUN CONSOLIDATES THE QUIET ROOM: cleans up its code and logic, and fixes its bugs",
                                 "It adds nothing", "Fix what is broken first", "leave the shell alone"],
            "consolidate_nav": ["THIS RUN CONSOLIDATES THE NAVIGATION", "It adds nothing",
                                "a star that lands on another", "regression, not a cleanup"],
            "consolidate_persona": ["THIS RUN CONSOLIDATES THE PERSONA", "It adds nothing",
                                    "a star that cannot be placed", "never in a world's module"],
            "consolidate_overall": ["THIS RUN CONSOLIDATES THE WHOLE SITE", "It adds nothing",
                                    "RE-FEDERATE", "REFACTOR AND CLEAN UP",
                                    "overdue rather than the one that is merely easy"],
        }
        for mode, parts in said.items():
            prompt = self.prompt(mode, quiet)
            for part in parts:
                with self.subTest(mode=mode, part=part):
                    self.assertIn(part, prompt)
        # Two worlds, and a mode with no list to draw from.
        prompt = self.prompt("enhance_item", self.WORLDS[:2])
        self.assertIn("THIS RUN ENHANCES THE QUIET ROOM AND LOAM", prompt)
        self.assertIn("The worlds it works on were drawn for it as well", prompt)
        self.assertIn("Make them more interesting", prompt)
        self.assertIn("Work inside their own files", prompt)
        prompt = self.prompt("enhance_item")
        self.assertIn("THIS RUN ENHANCES ONE WORLD", prompt)
        self.assertIn("choose one world yourself", prompt)
        self.assertIn("THIS RUN CONSOLIDATES ONE WORLD", self.prompt("consolidate_item"))

    def test_each_area_is_told_what_the_tests_hold_in_place_there(self):
        # The names the tests and the harnesses pin, by area: the ids, the lines, the section
        # comments, the stub browsers' limits. Refusals were mostly for moving one of these.
        pinned = {
            "item": ["For a world", "env.card", "ctx.satisfy only for a tap or a wait knob",
                     "Math.random", "piece_harness.mjs", "card_variant_harness.mjs"],
            "nav": ["For the navigation", "sparknav-state-label", "// ---- the state interface",
                    '"lightbox: lightbox,"', '"One lightbox, shared"', "state · N kept",
                    "never, not even in a comment", "Exactly eight rules", "nav_harness.mjs",
                    "no clearTimeout, getComputedStyle, matchMedia, CustomEvent, console"],
            "persona": ["For the persona", "persona-sheet-probe", "seed a fresh sky", "Kept as it was",
                        "::backdrop exactly once", "persona.js must not touch window.interestingSite before",
                        "lightbox_harness.mjs", '"lightbox: lightbox,"'],
            "overall": ["For the framework", "function finish(say) {", "stage_harness.mjs",
                        "@use 'lightbox'", "finePrint exactly privacy.html then terms.html",
                        f"at least {mi.MIN_MOOD_PROBES} probe: declarations", '"lightbox: lightbox,"',
                        "forget my reading"],
        }
        for mode in mi.MODES:
            area = mode.split("_", 1)[1]
            held = mi.held_in_place(mi.Run(mode))
            for part in pinned[area]:
                with self.subTest(mode=mode, part=part):
                    self.assertIn(part, held)
            self.assertIn(held, self.prompt(mode))
        self.assertIn("never rewrite one of them whole, merge two of them, or retire a page they read",
                      mi.held_in_place(mi.Run("enhance_nav")))

    def test_consolidating_modes_add_nothing_and_the_others_tidy_nothing(self):
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = self.prompt(mode, self.WORLDS[:1])
                last = prompt[prompt.index("This run's mission:"):]
                if mode.startswith("consolidate_"):
                    self.assertIn("It adds nothing", prompt)
                    self.assertIn("and add nothing", last)
                    self.assertIn("by edits that leave what the deploy's tests hold in place where it is", last)
                    self.assertNotIn("ADD one world", prompt)
                else:
                    self.assertIn("leave the consolidating, and every other area, to the runs that draw them", last)
                    self.assertNotIn("It adds nothing", prompt)
        last = self.prompt("create_item")
        self.assertIn("add one new world as part of the same whole, already federated", last[last.index("This run's mission:"):])
        last = self.prompt("enhance_item", self.WORLDS[:2])
        self.assertIn("inside the quiet room and loam and their own files", last[last.index("This run's mission:"):])
        last = self.prompt("consolidate_item", self.WORLDS[:1])
        self.assertIn("clean up the code and logic of the quiet room and fix its bugs", last[last.index("This run's mission:"):])

    def test_the_files_a_mode_works_in_are_shown_first_and_never_left_out(self):
        files = [("index.html", "i"), ("error.html", "e"), ("a.js", "a" * 12_000), ("b.js", "b" * 12_000),
                 ("c.js", "c" * 12_000), ("js/site.js", "s" * 100), ("js/modules/c.js", "m" * 12_000)]
        seen = set()
        for _ in range(40):
            with mock.patch.object(mi, "PROMPT_BUDGET_CHARS", 30_000):
                shown, omitted = mi.split_for_prompt(files, focus=["c.js", "js/site.js", "missing.js", "c.js"])
            names = [rel for rel, _ in shown]
            # The protected pages, then the focus in its order, then whatever else fits.
            self.assertEqual(names[:4], ["index.html", "error.html", "c.js", "js/site.js"], names)
            self.assertNotIn("c.js", omitted)
            self.assertEqual(len(names), 5)
            seen.update(names[4:])
        self.assertEqual(seen, {"a.js", "b.js", "js/modules/c.js"}, "the rest still rotate")
        # Without a focus, nothing about the split changes.
        shown, omitted = mi.split_for_prompt(files)
        self.assertEqual(len(shown), 7)
        self.assertEqual(omitted, [])

    def test_the_framework_is_what_is_shared_and_not_a_world(self):
        for rel in ["_includes/layout.njk", "_sass/_nav.scss", "_data/worlds.json", "css/site.scss",
                    "js/site.js", "js/stage.js"]:
            with self.subTest(rel=rel):
                self.assertTrue(mi.is_framework(rel))
        for rel in ["js/modules/loam.js", "loam.html", "index.html", "sitemap.xml", "favicon.svg", "a.js"]:
            with self.subTest(rel=rel):
                self.assertFalse(mi.is_framework(rel))

    def test_each_mode_focuses_on_its_own_files_and_then_the_framework(self):
        files = [(rel, "x") for rel in ["index.html", "loam.html", "quiet-room.html", "js/modules/loam.js",
                                        "js/modules/quiet-room.js", "js/site.js", "js/persona.js",
                                        "js/stage.js", "js/state.js", "_includes/layout.njk",
                                        "_sass/_nav.scss", "_sass/_persona.scss", "_sass/_mood.scss",
                                        "_data/worlds.json", "css/site.scss", "favicon.svg"]]
        framework = ["_data/worlds.json", "_includes/layout.njk", "_sass/_mood.scss", "_sass/_nav.scss",
                     "_sass/_persona.scss", "css/site.scss", "js/persona.js", "js/site.js", "js/stage.js"]
        item = mi.focus_files(mi.Run("enhance_item", self.WORLDS[1:2]), files)
        self.assertEqual(item[:4], ["loam.html", "js/modules/loam.js", "_data/worlds.json", "_sass/_mood.scss"])
        self.assertEqual(sorted(item), sorted(set(framework + ["loam.html", "js/modules/loam.js"])))
        self.assertNotIn("js/state.js", item, "the fixed files are never shown")
        self.assertNotIn("js/modules/quiet-room.js", item, "another world is not this run's")
        nav = mi.focus_files(mi.Run("consolidate_nav"), files)
        self.assertEqual(nav[:4], ["_includes/layout.njk", "js/site.js", "_sass/_nav.scss", "_data/worlds.json"])
        self.assertEqual(sorted(nav), framework)
        persona = mi.focus_files(mi.Run("enhance_persona"), files)
        self.assertEqual(persona[:3], ["js/persona.js", "_includes/layout.njk", "_sass/_persona.scss"])
        self.assertEqual(mi.focus_files(mi.Run("enhance_overall"), files), framework)
        # A creating run has no world yet; the data and the palette its lines go in come first.
        created = mi.focus_files(mi.Run("create_item"), files)
        self.assertEqual(created[:2], ["_data/worlds.json", "_sass/_mood.scss"])
        self.assertEqual(sorted(created), framework)
        self.assertEqual(mi.focus_files(mi.Run("enhance_item", self.WORLDS[1:2])), [], "nothing to show from nothing")

    def test_what_an_answer_changed_outside_its_mode_is_named(self):
        existing = {"index.html", "loam.html", "quiet-room.html", "js/modules/loam.js", "js/site.js",
                    "_includes/layout.njk", "_sass/_nav.scss", "_data/worlds.json", "js/threshold.js",
                    "sitemap.xml", "js/persona.js", "_sass/_mood.scss"}
        plan = {"files": [{"path": "loam.html"}, {"path": "js/modules/loam.js"}, {"path": "js/site.js"},
                          {"path": "new.html"}, {"path": "_data/worlds.json"}, "junk", {"path": 3}],
                "delete": ["quiet-room.html", "js/site.js", 4]}
        item = mi.Run("enhance_item", self.WORLDS[1:2])
        self.assertEqual(mi.strays(item, plan, existing), ["js/site.js", "quiet-room.html"])
        self.assertEqual(mi.strays(mi.Run("enhance_nav"), plan, existing),
                         ["loam.html", "js/modules/loam.js", "quiet-room.html"])
        self.assertEqual(mi.strays(mi.Run("enhance_persona"), {"files": [{"path": "index.html"}, {"path": "js/threshold.js"}, {"path": "_sass/_nav.scss"}]}, existing),
                         ["_sass/_nav.scss"])
        self.assertEqual(mi.strays(mi.Run("consolidate_overall"), plan, existing), [])
        self.assertEqual(mi.strays(item, {"files": "x", "delete": None}, existing), [])

    def test_the_workflow_offers_every_mode_and_reads_the_draw_back(self):
        workflow = (mi.REPO_ROOT / ".github" / "workflows" / "make-interesting.yml").read_text()
        self.assertIn("RUN_MODE: ${{ inputs.mode }}", workflow)
        for option in ["auto", "create", "enhance", "consolidate", *mi.MODES]:
            with self.subTest(option=option):
                self.assertIn(f"\n          - {option}\n", workflow)
        self.assertIn("MODE: ${{ steps.ai.outputs.mode }}", workflow)
        self.assertIn("ITEMS: ${{ steps.ai.outputs.items }}", workflow)
        self.assertIn("HEADLINE: ${{ steps.ai.outputs.headline }}", workflow)
        self.assertIn('git commit -m "${HEADLINE', workflow)
        for gone in ["RUN_KIND", "inputs.kind", "RUN_NUMBER", "steps.ai.outputs.kind"]:
            with self.subTest(gone=gone):
                self.assertNotIn(gone, workflow)
        # The workflow's name is what deploy.yml listens for, and the mode does not change it.
        self.assertIn("name: Make the website more interesting\n", workflow)


class ReasoningEffortTest(unittest.TestCase):
    """Take big gulps: every call goes to one of the heaviest models at near-maximum reasoning
    effort, and a model that has no dial for it is still asked, once more without the flag."""

    def effort(self, value=""):
        with mock.patch.dict(os.environ, {"REASONING_EFFORT": value}), mock.patch("builtins.print") as printed:
            return mi.reasoning_effort(), " ".join(str(call.args[0]) for call in printed.call_args_list)

    def test_the_default_is_one_step_below_max(self):
        self.assertEqual(mi.DEFAULT_REASONING_EFFORT, "xhigh")
        self.assertEqual(mi.REASONING_EFFORT_LEVELS[-1], "max")
        self.assertEqual(mi.REASONING_EFFORT_LEVELS.index("xhigh"), len(mi.REASONING_EFFORT_LEVELS) - 2)
        self.assertEqual(self.effort(), ("xhigh", ""))
        self.assertEqual(self.effort("  "), ("xhigh", ""))

    def test_the_variable_overrides_it(self):
        self.assertEqual(self.effort("max"), ("max", ""))
        self.assertEqual(self.effort(" High "), ("high", ""))
        self.assertEqual(self.effort("none"), ("", ""))
        self.assertEqual(mi.effort_flags(""), [])
        self.assertEqual(mi.effort_flags("max"), ["--reasoning-effort", "max"])

    def test_an_unknown_level_falls_back_with_a_warning(self):
        effort, log = self.effort("enormous")
        self.assertEqual(effort, "xhigh")
        self.assertIn("'enormous' is not one of none, minimal, low, medium, high, xhigh, max; using xhigh", log)

    def test_the_flag_reaches_the_cli_ahead_of_the_lockdown_flags(self):
        fake = FakeCopilot(self, "say('hello')")
        with mock.patch.dict(os.environ, {"REASONING_EFFORT": ""}):
            self.assertEqual(mi.call_model("model-a", "p"), "hello")
        self.assertEqual(mi.call_model("model-a", "p", effort="max"), "hello")
        self.assertEqual(mi.call_model("model-a", "p", effort=""), "hello")
        by_default, by_hand, none = [call["args"] for call in fake.calls()]
        self.assertEqual(by_default, ["--model", "model-a", "--reasoning-effort", "xhigh", *mi.COPILOT_FLAGS])
        self.assertEqual(by_hand, ["--model", "model-a", "--reasoning-effort", "max", *mi.COPILOT_FLAGS])
        self.assertEqual(none, ["--model", "model-a", *mi.COPILOT_FLAGS])

    REFUSAL = "Error: reasoning effort xhigh is not available for this model"

    def test_a_model_without_a_dial_is_asked_again_without_the_flag(self):
        fake = FakeCopilot(self, f"""
            if '--reasoning-effort' in ARGS:
                sys.stderr.write({self.REFUSAL!r}); sys.exit(1)
            say('hello without the dial')""")
        with mock.patch("builtins.print") as printed:
            self.assertEqual(mi.call_model("model-a", "p", effort="xhigh"), "hello without the dial")
        first, second = [call["args"] for call in fake.calls()]
        self.assertIn("--reasoning-effort", first)
        self.assertNotIn("--reasoning-effort", second)
        self.assertIn("model-a did not take reasoning effort xhigh", printed.call_args.args[0])

    def test_a_second_refusal_is_the_models_failure_like_any_other(self):
        fake = FakeCopilot(self, f"sys.stderr.write({self.REFUSAL!r}); sys.exit(1)")
        with mock.patch("builtins.print"), self.assertRaisesRegex(mi.ModelError, "reasoning effort"):
            mi.call_model("model-a", "p", effort="xhigh")
        self.assertEqual(len(fake.calls()), 2, "one retry without the flag, and no more")

    def test_no_retry_when_no_effort_was_asked_for(self):
        fake = FakeCopilot(self, f"sys.stderr.write({self.REFUSAL!r}); sys.exit(1)")
        with self.assertRaises(mi.ModelError):
            mi.call_model("model-a", "p", effort="")
        self.assertEqual(len(fake.calls()), 1)

    def test_a_lost_answer_steps_the_effort_down_one_notch_and_never_below_medium(self):
        # The one dial the script has on how long an answer takes: after an answer runs past the
        # output limit or the clock, the rest of the run thinks a step less hard (see main).
        self.assertEqual(mi.LOWEST_FALLBACK_EFFORT, "medium")
        self.assertEqual(mi.lower_effort("max"), "xhigh")
        self.assertEqual(mi.lower_effort("xhigh"), "high")
        self.assertEqual(mi.lower_effort("high"), "medium")
        self.assertEqual(mi.lower_effort("medium"), "medium")
        self.assertEqual(mi.lower_effort("low"), "low")
        self.assertEqual(mi.lower_effort("minimal"), "minimal")
        self.assertEqual(mi.lower_effort(""), "")

    def test_an_unavailable_model_is_still_unavailable(self):
        # The retry is for the flag, not the model: a model the account cannot use is skipped at
        # once, as before, and costs no second call.
        fake = FakeCopilot(self, "sys.stderr.write('Error: model-a is not available'); sys.exit(1)")
        with self.assertRaises(mi.ModelUnavailable):
            mi.call_model("model-a", "p", effort="xhigh")
        self.assertEqual(len(fake.calls()), 1)


class MaxOutputTokensTest(unittest.TestCase):
    """Take big gulps: every call also asks for as much room to write as the CLI can be told to
    allow, and says how much that is in the prompt, so an answer is sized to fit in one turn
    instead of being cut off mid-run (issue #77)."""

    def budget(self, value=""):
        with mock.patch.dict(os.environ, {"MAX_OUTPUT_TOKENS": value}), mock.patch("builtins.print") as printed:
            return mi.max_output_tokens(), " ".join(str(call.args[0]) for call in printed.call_args_list)

    def test_the_default_is_a_whole_turn_of_the_heaviest_models(self):
        # 64k output tokens: what the flagships in the pool grant, and far more than the answer
        # that was lost needed. Comfortably more than one file's worth, so the budget is about how
        # many files a run rewrites rather than about whether any one of them fits.
        self.assertEqual(mi.DEFAULT_MAX_OUTPUT_TOKENS, 64_000)
        self.assertGreater(mi.DEFAULT_MAX_OUTPUT_TOKENS * mi.BYTES_PER_TOKEN, 4 * mi.MAX_FILE_BYTES)
        self.assertEqual(self.budget(), (64_000, ""))
        self.assertEqual(self.budget("  "), (64_000, ""))

    def test_the_variable_overrides_it(self):
        self.assertEqual(self.budget("200000"), (200_000, ""))
        self.assertEqual(self.budget(" 96000 "), (96_000, ""))
        self.assertEqual(self.budget("none"), (0, ""))
        self.assertEqual(self.budget("0"), (0, ""))

    def test_a_value_that_is_not_a_number_falls_back_with_a_warning(self):
        for value in ["as much as possible", "64k", "-1", "64_000", "1.5e5"]:
            with self.subTest(value=value):
                budget, log = self.budget(value)
                self.assertEqual(budget, 64_000)
                self.assertIn("is not a whole number of tokens or \"none\"; using 64000", log)

    def test_the_budget_reaches_the_cli_through_the_variable_it_reads(self):
        # Copilot CLI 1.0.91 has no flag for a maximum output, so the budget travels in the one
        # environment variable it does read for one, and never as an invented flag: a flag the CLI
        # does not know would fail every call outright.
        fake = FakeCopilot(self, "say('hello')")
        with mock.patch.dict(os.environ, {"MAX_OUTPUT_TOKENS": ""}):
            os.environ.pop("COPILOT_PROVIDER_MAX_OUTPUT_TOKENS", None)  # nothing is inherited
            self.assertEqual(mi.call_model("model-a", "p"), "hello")
            self.assertEqual(mi.call_model("model-a", "p", budget=123_000), "hello")
            self.assertEqual(mi.call_model("model-a", "p", budget=0), "hello")
        by_default, by_hand, none = fake.calls()
        self.assertEqual(by_default["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"], "64000")
        self.assertEqual(by_hand["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"], "123000")
        self.assertIsNone(none["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"])
        for call in fake.calls():
            self.assertFalse([arg for arg in call["args"] if "token" in arg],
                             "no output-budget flag is passed to the pinned CLI, which has none")

    def test_the_retry_without_the_effort_flag_asks_for_the_same_room(self):
        refusal = "Error: reasoning effort xhigh is not available for this model"
        fake = FakeCopilot(self, f"""
            if '--reasoning-effort' in ARGS:
                sys.stderr.write({refusal!r}); sys.exit(1)
            say('hello')""")
        with mock.patch("builtins.print"):
            self.assertEqual(mi.call_model("model-a", "p", effort="xhigh", budget=99_000), "hello")
        first, second = fake.calls()
        self.assertEqual(first["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"], "99000")
        self.assertEqual(second["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"], "99000")

    def test_the_prompt_names_the_budget_so_the_model_can_size_the_answer(self):
        prompt = mi.build_prompt([("index.html", "<h1>x</h1>")], budget=64_000)
        self.assertIn("keep the whole answer well inside your output limit, for which this run asks "
                      "up to 64,000 tokens -- about 256 KB of JSON, all of your files together, or "
                      "your own limit if that is lower: aim for a quarter of it and never pass half",
                      prompt)
        bigger = mi.build_prompt([("index.html", "<h1>x</h1>")], budget=200_000)
        self.assertIn("up to 200,000 tokens -- about 800 KB of JSON", bigger)
        # Asked for nothing, the prompt claims nothing: it still says to stay inside the limit.
        unnamed = mi.build_prompt([("index.html", "<h1>x</h1>")], budget=0)
        self.assertIn("keep the whole answer well inside your output limit: aim for a quarter of it", unnamed)
        self.assertNotIn("asks up to", unnamed)

    def test_the_workflow_exposes_the_override(self):
        workflow = (mi.REPO_ROOT / ".github" / "workflows" / "make-interesting.yml").read_text()
        self.assertIn("MAX_OUTPUT_TOKENS: ${{ vars.MAX_OUTPUT_TOKENS }}", workflow)
        self.assertIn("REASONING_EFFORT: ${{ vars.REASONING_EFFORT }}", workflow)


class HeaviestModelsTest(unittest.TestCase):
    """Take big gulps: only the heaviest models -- the top of each provider's current line as
    Copilot offers it -- and nothing older or lighter, however much of a flagship it once was."""

    HEAVIEST = ["claude-fable-5.1", "claude-fable-5", "claude-opus-5.5",
                "gpt-6.1-sol", "gpt-6-sol", "gpt-6-astra", "kimi-k3"]
    OUT_OF_THE_POOL = ["claude-opus-5", "claude-opus-4.8", "gpt-5.6-sol", "gpt-5.5", "gpt-5.3-codex"]

    def test_the_pool_is_exactly_the_heaviest(self):
        # Spelled out rather than derived, so adding a lighter model back fails here rather than
        # passing quietly through the name rule, which cannot tell an older flagship from the
        # current one.
        self.assertEqual(mi.MODELS, self.HEAVIEST)

    def test_older_and_lighter_flagships_are_out_by_omission_not_by_name(self):
        for model in self.OUT_OF_THE_POOL:
            with self.subTest(model=model):
                self.assertNotIn(model, mi.MODELS)
                self.assertFalse(mi.is_small_model(model), "a flagship of an earlier generation is not small")

    def test_a_heavy_answer_is_given_the_time_it_takes(self):
        self.assertEqual(mi.MODEL_TIMEOUT_SECONDS, 900)
        # The run's own deadline has room for every attempt to take that long...
        self.assertGreaterEqual(mi.RUN_BUDGET_SECONDS, mi.MAX_ATTEMPTS * mi.MODEL_TIMEOUT_SECONDS)
        # ...and stays inside the hour, because a run that outlasts it costs the next run.
        self.assertLessEqual(mi.RUN_BUDGET_SECONDS, 60 * 60)
        self.assertGreater(mi.MIN_CALL_SECONDS, 0)
        self.assertLess(mi.MIN_CALL_SECONDS, mi.MODEL_TIMEOUT_SECONDS)
        workflow = (mi.REPO_ROOT / ".github" / "workflows" / "make-interesting.yml").read_text()
        minutes = int(re.search(r"timeout-minutes: (\d+)\n    permissions:\n      contents: write", workflow).group(1))
        # The job fits the deadline and everything the last answer is held to after it: two builds
        # and both harnesses (validate_plan), then the whole suite (require_passing_tests).
        self.assertGreaterEqual(minutes * 60, mi.RUN_BUDGET_SECONDS + 2 * mi.BUILD_TIMEOUT_SECONDS
                                + mi.PIECE_TIMEOUT_SECONDS + mi.STAGE_TIMEOUT_SECONDS + mi.TESTS_TIMEOUT_SECONDS)


class BuildPipelinePromptTest(unittest.TestCase):
    """Issue #25: /site is source now, and the prompt says so. A run that does not know the pipeline
    cannot write for it, and the answers to the issue gave it the whole thing to write."""

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_prompt_explains_both_halves_of_the_build(self):
        prompt = self.prompt()
        self.assertIn("What you write is source", prompt)
        for fact in ["front matter", "layout: layout.njk", f"{mi.INCLUDES_DIR}/", f"{mi.SASS_DIR}/",
                     "compiles to .css at the same path", "{% raw %}", "does not build is refused"]:
            with self.subTest(fact=fact):
                self.assertIn(fact, prompt)

    def test_the_pipeline_comes_before_the_rules_that_lean_on_it(self):
        prompt = self.prompt()
        self.assertLess(prompt.index("How the site is built"), prompt.index("Rules:"))

    def test_the_axiom_says_which_site_it_is_checked_on(self):
        prompt = self.prompt()
        self.assertIn("checked on the built site", prompt[prompt.index("AXIOM"):])

    def test_federating_may_now_reach_the_layout_and_the_shared_sass(self):
        # "Full creative opportunity within its silo": the shared files are part of what a run may
        # federate, not a fixed frame around what it may.
        federate = mi.build_prompt([("index.html", "<h1>hi</h1>")], (), mi.Run("consolidate_overall"))
        federate = federate[federate.index("RE-FEDERATE"):federate.index("How the site is built")]
        self.assertIn(mi.INCLUDES_DIR, federate)
        self.assertIn(mi.SASS_DIR, federate)


class ReachabilityAxiomTest(SiteDirTestCase):
    """Issue #21: all of the content stays reachable from the root, through the navigation and
    through the sitemap. The axiom is a standing rule of every prompt, and validate_plan holds the
    line, so a page a run adds is wired into both by that same run."""

    PAGES = ["index.html", "error.html", "toy.html"]

    def wired_site(self):
        """A site that satisfies the axiom: the home page links every page, the sitemap lists them."""
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        (self.site / "toy.html").write_text("<p>toy</p>")
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        # Not one optional flavour of a federation run: a rule stated in the Rules block, which
        # every run has to satisfy whichever kind of change it chooses.
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        rules = prompt[prompt.index("Rules:"):]
        for rule in ["all of the content stays reachable from the root",
                     "index.html must lead to every page",
                     "sitemap.xml must list every page",
                     "Wire a page you add into both in the same run",
                     "take a page you delete out of both",
                     "sitemaps.org urlset"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_a_page_a_run_adds_must_be_linked_and_listed_by_the_same_run(self):
        self.wired_site()
        orphan = {"files": [{"path": "new.html", "content": NEW_PAGE}]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not reachable.*not listed"):
            mi.validate_plan(orphan)
        linked_only = {"files": [{"path": "new.html", "content": NEW_PAGE},
                                 {"path": "index.html", "content": home("toy.html", "error.html", "new.html")}]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not listed in sitemap\.xml"):
            mi.validate_plan(linked_only)
        listed_only = {"files": [{"path": "new.html", "content": NEW_PAGE},
                                 {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")}]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not reachable from index\.html"):
            mi.validate_plan(listed_only)
        wired = {"files": linked_only["files"] + listed_only["files"][1:]}
        self.assertEqual(len(mi.validate_plan(wired)), 3)

    def test_reachability_may_pass_through_a_site_map_page(self):
        # Open question 4 of the issue: a page does not have to hang off index.html itself. A
        # shared nav or a site map page the home page links to is navigation just the same.
        (self.site / "index.html").write_text(home("sitemap.html"))
        (self.site / "sitemap.html").write_text(home("toy.html", "error.html"))
        (self.site / "toy.html").write_text("<p>toy</p>")
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES, "sitemap.html"))
        self.assertEqual(mi.unreachable_pages(dict(mi.read_site())), {})

    def test_a_navigation_built_by_a_shared_script_counts(self):
        # The prompt invites lifting the shared header into "js/site.js". A page whose nav arrives
        # from there is reachable, and a run that federates that way must not be refused for it.
        (self.site / "index.html").write_text("<h1>hi</h1><script src='js/site.js'></script>")
        (self.site / "js").mkdir()
        (self.site / "js" / "site.js").write_text("var NAV = ['toy.html', 'error.html'];")
        (self.site / "toy.html").write_text("<p>toy</p>")
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))
        self.assertEqual(mi.unreachable_pages(dict(mi.read_site())), {})

    def test_unlinking_or_unlisting_a_page_that_was_reachable_is_refused(self):
        self.wired_site()
        for plan, broke in [
            ({"files": [{"path": "index.html", "content": home("error.html")}]}, "not reachable"),
            ({"files": [{"path": "sitemap.xml", "content": sitemap("index.html", "error.html")}]}, "not listed"),
        ]:
            with self.subTest(broke=broke), self.assertRaisesRegex(mi.RejectedChange, f"toy.html is {broke}"):
                mi.validate_plan(plan)

    def test_retiring_a_page_and_its_links_together_is_fine(self):
        # A run that only deletes stays a successful run (issue #16), as long as it tidies up.
        self.wired_site()
        ops = mi.validate_plan({
            "delete": ["toy.html"],
            "files": [{"path": "index.html", "content": home("error.html")},
                      {"path": "sitemap.xml", "content": sitemap("index.html", "error.html")}],
        })
        self.assertEqual(len(ops), 3)

    def test_an_orphan_that_was_already_there_blocks_nothing(self):
        # Only what the run itself breaks is refused. If a plan had to repair every pre-existing
        # orphan before it could do anything, no plan could ever be applied -- including the one
        # that repairs them. The fixture site has no sitemap and links nothing.
        ops = mi.validate_plan({"files": [{"path": "index.html", "content": "<h1>still nothing linked</h1>"}]})
        self.assertEqual(len(ops), 1)
        self.assertIn("error.html", mi.unreachable_pages(dict(mi.read_site())))

    def test_only_links_that_stay_in_the_site_are_navigation(self):
        site = {"index.html": (
            "<a href='https://example.com/toy.html'>off site</a>"
            "<a href='//example.com/toy.html'>off site</a>"
            "<a href='mailto:someone@example.com'>mail</a>"
            "<a href='../toy.html'>above the root</a>"
            "<a href='#toy.html'>a fragment</a>"
            "<a href=''>nowhere</a>"
        ), "toy.html": "<p>toy</p>"}
        self.assertEqual(mi.reachable_pages(site), {"index.html"})
        # ".", "./", "?query" and a folder link all do name a page of the site.
        site["index.html"] = "<a href='./toy.html?x=1#here'>toy</a><a href='sub/'>sub</a><a href='.'>home</a>"
        site["sub/index.html"] = "<p>sub</p>"
        self.assertEqual(mi.reachable_pages(site), {"index.html", "toy.html", "sub/index.html"})

    def test_a_sitemap_loc_may_be_a_relative_path_or_a_full_url(self):
        # /site writes relative locs, having no fixed domain, but a run that writes absolute URLs
        # has still listed the page.
        pages = {"index.html": "", "toy.html": "", "sub/deep.html": ""}
        for loc in ["toy.html", "./toy.html", "https://example.com/interesting/toy.html",
                    "https://example.com/toy.html?v=2"]:
            with self.subTest(loc=loc):
                self.assertEqual(mi.listed_pages(dict(pages, **{"sitemap.xml": sitemap(loc)})), {"toy.html"})
        self.assertEqual(mi.listed_pages(dict(pages, **{"sitemap.xml": sitemap("https://example.com/")})),
                         {"index.html"})
        self.assertEqual(mi.listed_pages(dict(pages, **{"sitemap.xml": sitemap("deep.html")})), set(),
                         "a loc has to name the page's whole path, not just its file name")
        self.assertEqual(mi.listed_pages(dict(pages, **{"sitemap.xml": sitemap("sub/deep.html")})),
                         {"sub/deep.html"})

    def test_the_sitemap_is_protected_like_the_home_page(self):
        # It can be rewritten -- every run that adds a page has to -- but never deleted or emptied,
        # and it is shown to the model before any ordinary file so it can always be rewritten.
        self.assertIn("sitemap.xml", mi.PROTECTED_FILES)
        self.wired_site()
        for plan in [{"delete": ["sitemap.xml"]}, {"files": [{"path": "sitemap.xml", "content": " "}]}]:
            with self.subTest(plan=plan), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)

    def test_the_sitemap_is_shown_to_the_model_before_any_ordinary_file(self):
        self.wired_site()
        (self.site / "zz-big.js").write_text("y" * mi.PROMPT_BUDGET_CHARS)  # fits only on its own
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual([rel for rel, _ in shown][:3], ["index.html", "error.html", "sitemap.xml"])
        self.assertEqual(omitted, ["zz-big.js"])


class AnalyticsAxiomTest(SiteDirTestCase):
    """Issue #24: every page carries the site's analytics tag and its cookie consent banner, both of
    which arrive with one line. The axiom is a standing rule of every prompt, validate_plan holds
    the line, and the files behind that line are kept out of every run's reach."""

    PAGES = ["index.html", "error.html", "toy.html"]

    def setUp(self):
        super().setUp()
        (self.site / "js").mkdir()
        (self.site / mi.ANALYTICS_SCRIPT).write_text("/* the shared tag and banner */")
        (self.site / "index.html").write_text(tagged(home("toy.html", "error.html")))
        (self.site / "error.html").write_text(tagged("<p>404</p>"))
        (self.site / "toy.html").write_text(tagged("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.prompt()
        rules = rules[rules.index("Rules:"):]
        for rule in ["every page carries the site's analytics and cookie consent banner",
                     mi.ANALYTICS_TAG,
                     "Keep that line on every page you rewrite",
                     "put it on every page you add",
                     f"../{mi.ANALYTICS_SCRIPT}",  # a page in a sub-folder
                     "only once a visitor accepts",
                     "are fixed: they are not shown to you",
                     "without that line is refused"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)
        for fixed in mi.FIXED_FILES:
            with self.subTest(fixed=fixed):
                self.assertIn(fixed, rules)

    def test_the_prompt_no_longer_forbids_the_sites_own_analytics(self):
        # The rule used to end "nothing harmful, deceptive or tracking", which this axiom
        # contradicts as written. A run still may not add measurement of its own.
        prompt = self.prompt()
        self.assertNotIn("nothing harmful, deceptive or tracking", prompt)
        self.assertIn("nothing harmful or deceptive", prompt)
        self.assertIn("add no tracking, telemetry, beacon or third-party script of your own", prompt)

    def test_a_page_a_run_adds_must_carry_the_tag(self):
        # A whole page but for the one line, so the analytics axiom is the only thing left to refuse
        # it for: a page a run adds is held to every axiom at once, and this test is about this one.
        plan = {"files": [
            {"path": "new.html", "content": page(title="new", analytics="")},
            {"path": "index.html", "content": tagged(home("toy.html", "error.html", "new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html has no <script"):
            mi.validate_plan(plan)
        plan["files"][0]["content"] = page(title="new")
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_dropping_the_tag_from_a_page_a_run_rewrites_is_refused(self):
        for content in ["<p>no tag at all</p>", "<head><script>var ANALYTICS = 'js/analytics.js';</script></head>"]:
            with self.subTest(content=content[:40]), self.assertRaisesRegex(mi.RejectedChange, r"toy\.html has no <script"):
                mi.validate_plan({"files": [{"path": "toy.html", "content": content}]})
        # It is the src that counts, not the exact spelling of the tag around it.
        loaded = '<head><script defer src="js/analytics.js"></script></head>'
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": loaded}]})), 1)

    def test_a_page_in_a_sub_folder_loads_it_by_a_relative_src(self):
        plan = {"files": [
            {"path": "deep/new.html",
             "content": page(title="new", analytics=f"../{mi.ANALYTICS_SCRIPT}")},
            {"path": "index.html", "content": tagged(home("toy.html", "error.html", "deep/new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "deep/new.html")},
        ]}
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_a_page_that_was_already_missing_the_tag_blocks_nothing(self):
        # Only what the run itself breaks is refused, as with the reachability axiom: a plan that
        # had to repair every page first could never be applied, including the one that repairs them.
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": tagged("<p>still tagged</p>")}]})
        self.assertEqual(len(ops), 1)
        self.assertEqual(mi.pages_missing_analytics(dict(mi.read_site())), {"index.html"})

    def test_a_site_without_the_shared_script_is_not_held_to_the_axiom(self):
        (self.site / mi.ANALYTICS_SCRIPT).unlink()
        self.assertEqual(mi.pages_missing_analytics(dict(mi.read_site())), set())
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": "<p>bare</p>"}]})), 1)

    def test_the_files_behind_the_tag_can_neither_be_rewritten_nor_deleted(self):
        for rel in sorted(mi.FIXED_FILES):
            for plan in [{"files": [{"path": rel, "content": "rewritten from memory"}]},
                         {"delete": [rel]}, {"delete": [f"site/{rel}"]}]:
                with self.subTest(plan=str(plan)[:80]), self.assertRaises(mi.RejectedChange):
                    mi.validate_plan(plan)

    def test_the_files_behind_the_tag_are_never_shown_and_cost_the_prompt_nothing(self):
        # 55 KB of vendored consent library must not push a page of the site out of the prompt, and
        # a file the model cannot see is a file it cannot break.
        for rel in sorted(mi.FIXED_FILES):
            path = self.site / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("z" * mi.PROMPT_BUDGET_CHARS)
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual(sorted(rel for rel, _ in shown),
                         ["error.html", "index.html", "sitemap.xml", "toy.html"])
        self.assertEqual(sorted(set(omitted) & mi.FIXED_FILES), sorted(mi.FIXED_FILES))
        prompt = mi.build_prompt(shown, omitted)
        self.assertNotIn("zzzz", prompt)
        self.assertIn("you may not change or delete them", prompt)


class ResponsiveAccessibleAxiomTest(SiteDirTestCase):
    """Issue #26: every page is responsive and accessible, on every run, the way every page stays
    reachable from the root. Stated as a rule of every prompt and held to by validate_plan, so it
    does not depend on which model happens to be drawn in a given hour."""

    def violations(self, content, **assets):
        return mi.page_violations("p.html", dict({"p.html": content}, **assets))

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        # In the Rules block beside reachability, not one optional flavour of a run: whichever kind
        # of change a run chooses, the pages it writes have to satisfy this.
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        rules = prompt[prompt.index("Rules:"):]
        for rule in ["AXIOM, every run: every page is responsive and accessible",
                     "WCAG 2.2 level AA",
                     "width=device-width", "does not forbid zooming",
                     "lang on <html>", "<title>", "exactly one <main> landmark",
                     "start at <h1> and skip no level", "alt on every <img>",
                     "accessible name on every link, button and form control",
                     "<label for>", "aria-label", ":focus-visible",
                     "no positive tabindex", "prefers-reduced-motion",
                     "refused, exactly as one that orphans a page is"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)
        # One AXIOM in the prompt per coded axiom, so neither list can grow without the other.
        self.assertEqual(rules.count("AXIOM, every run:"), len(CODED_AXIOMS),
                         "every axiom stands over every run")

    def test_the_prompt_also_asks_for_what_no_validator_can_judge(self):
        # Open question 1 of the issue: both, and the prompt is the wider of the two. Contrast needs
        # the rendered colours of a gradient, and tap targets and sideways overflow need a layout, so
        # the prompt has to ask for what check_accessibility cannot see.
        rules = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        for asked in ["fluid units", "overflows sideways at 320px wide", "tap targets around 44px",
                      "contrast at 4.5:1", "the mechanical half"]:
            with self.subTest(asked=asked):
                self.assertIn(asked, rules)

    def test_a_page_that_satisfies_the_axiom_has_no_violations(self):
        self.assertEqual(self.violations(page()), [])
        self.assertEqual(self.violations(page(body="<h2>a section</h2><p>text</p>")), [])

    # Open question 2 of the issue: these are the signals, each one something a page either plainly
    # has or plainly lacks, so the check never comes down to taste.
    def test_every_signal_the_axiom_rests_on_is_checked(self):
        img, button = "<img src='a.png' alt='a'>", "<button aria-label='Play'></button>"
        cases = [
            ("no viewport tag", page(viewport=""),
             ["has no viewport meta tag with width=device-width"]),
            ("zoom forbidden outright", page(viewport="width=device-width, user-scalable=no"),
             ["forbids zooming in its viewport meta tag"]),
            ("zoom capped below 200%", page(viewport="width=device-width, maximum-scale=1.5"),
             ["forbids zooming in its viewport meta tag"]),
            ("no lang", page(lang=""), ["has no lang attribute on <html>"]),
            ("empty title", page(title=""), ["has no page title"]),
            ("no main landmark", page().replace("main", "div"), ["has no <main> landmark"]),
            ("two main landmarks", page().replace("</main>", "</main><main>more</main>"),
             ["has more than one <main> landmark"]),
            ("headings start below h1", page().replace("h1", "h2"),
             ["has no <h1>", "skips a heading level"]),
            ("a heading level skipped", page(body="<h3>a section</h3>"), ["skips a heading level"]),
            ("an image with no alt", page(body="<img src='a.png'>"),
             ["has an <img> with no alt attribute"]),
            ("the focus ring taken away", page(focus=False),
             ["takes the focus outline away without a :focus style of its own"]),
            ("a positive tabindex", page(body=f"<p tabindex='1'>{img}</p>"),
             ["uses a positive tabindex"]),
            ("motion with no escape from it", page(calm=False),
             ["animates without honouring prefers-reduced-motion"]),
            ("a nameless button", page(body="<button></button>"),
             ["has a <button> with no accessible name"]),
            ("a nameless link", page(body="<a href='toy.html'></a>"),
             ["has an <a> with no accessible name"]),
            ("an unlabelled field", page(body=f"<input id='q' type='search'>{button}"),
             ["has an <input> with no accessible name"]),
        ]
        for name, content, expected in cases:
            with self.subTest(case=name):
                self.assertEqual(sorted(self.violations(content)), sorted(expected))

    def test_zoom_may_be_capped_at_200_percent_but_no_lower(self):
        # WCAG 1.4.4 asks for text that can be enlarged to 200%, so maximum-scale=2 is as low as a
        # page may go and a page that says nothing about scale is fine.
        for allowed in ["width=device-width, initial-scale=1", "width=device-width, maximum-scale=2",
                        "width=device-width, maximum-scale=5.0"]:
            with self.subTest(viewport=allowed):
                self.assertEqual(self.violations(page(viewport=allowed)), [])

    def test_a_decorative_image_is_marked_decorative_rather_than_left_unmarked(self):
        # alt="" is how a page says "this one carries no meaning", so an empty alt passes and a
        # missing one does not. WCAG 1.1.1 Non-text Content.
        self.assertEqual(self.violations(page(body="<img src='a.png' alt=''>")), [])
        self.assertEqual(self.violations(page(body="<img src='a.png' aria-hidden='true'>")),
                         ["has an <img> with no alt attribute"])

    def test_a_control_may_take_its_name_from_its_text_a_label_or_an_attribute(self):
        named = [
            "<button>play</button>",
            "<button aria-label='Play the sky'></button>",
            "<button aria-labelledby='heading'></button>",
            "<button title='Play'></button>",
            "<button><img src='play.svg' alt='Play'></button>",  # an image inside names the button
            "<button><span><em>play</em></span></button>",  # however deeply the text is nested
            "<button><svg role='img'><title>Play</title></svg></button>",  # and an svg's own title
            "<label for='q'>search</label><input id='q'>",  # a label before the field it names
            "<input id='q'><label for='q'>search</label>",  # and a label after it
            "<select id='s' aria-label='Palette'><option>one</option></select>",
            "<textarea aria-label='Your wish'></textarea>",
            "<input type='hidden' name='token' value='x'>",  # not a control at all
            "<input type='submit' value='Send'>",  # carries its own text
            "<a>a target, not a link</a>",  # no href, so nothing to operate
            "<details><summary>more</summary><p>text</p></details>",
        ]
        for markup in named:
            with self.subTest(markup=markup):
                self.assertEqual(self.violations(page(body=markup)), [])

    def test_markup_written_inside_a_script_is_not_markup_of_the_page(self):
        # Every page of this site draws part of itself from JavaScript, so a check that read the
        # file as text would refuse them all over strings like these.
        drawn = ("<script>\n"
                 "  var row = \"<img src=x>\" + \"<button></button>\" + \"<input>\";\n"
                 "  el.innerHTML = \"<a href='toy.html'></a>\" + row;\n"
                 "</script>")
        self.assertEqual(self.violations(page(body=drawn)), [])

    def test_a_shared_stylesheet_or_script_is_read_along_with_the_page(self):
        # The prompt invites lifting shared styles and behaviour into "css/site.css" and
        # "js/site.js". A page's focus ring and its motion are then as likely to live there as in
        # the page, so the check has to follow them or a federated site would pass vacuously.
        bare = ("<!DOCTYPE html>\n<html lang='en'>\n<head>\n<meta name='viewport' "
                "content='width=device-width, initial-scale=1'>\n<title>t</title>\n"
                "<link rel='stylesheet' href='css/site.css'>\n</head>\n<body>\n<main><h1>t</h1>"
                "</main>\n<script src='js/site.js'></script>\n</body>\n</html>")
        shared = {"css/site.css": "button { outline: none; }",
                  "js/site.js": "requestAnimationFrame(frame);"}
        self.assertEqual(sorted(self.violations(bare, **shared)),
                         ["animates without honouring prefers-reduced-motion",
                          "takes the focus outline away without a :focus style of its own"])
        shared["css/site.css"] += " button:focus-visible { outline: 2px solid; }"
        shared["js/site.js"] = ("if (!matchMedia('(prefers-reduced-motion: reduce)').matches) "
                                "requestAnimationFrame(frame);")
        self.assertEqual(self.violations(bare, **shared), [])

    def test_motion_only_has_to_be_answered_for_where_there_is_motion(self):
        # A still page owes nobody a prefers-reduced-motion rule; a page that moves owes one however
        # it moves, in CSS or from script.
        still = page(calm=False).replace("transition: color 0.2s ease;", "color: #8db8ff;")
        self.assertEqual(self.violations(still), [])
        for motion in ["@keyframes drift { to { transform: translateY(1rem); } }",
                       "div { animation: drift 4s infinite; }"]:
            with self.subTest(motion=motion):
                self.assertEqual(self.violations(still.replace("</style>", motion + "</style>")),
                                 ["animates without honouring prefers-reduced-motion"])
        for motion in ["<script>requestAnimationFrame(frame);</script>",
                       "<script>el.animate(frames, 900);</script>"]:
            with self.subTest(motion=motion):
                self.assertEqual(self.violations(still.replace("</main>", motion + "</main>")),
                                 ["animates without honouring prefers-reduced-motion"])
        # Honouring it from script counts as much as a media query does.
        answered = still.replace("</main>", "<script>if (!matchMedia('(prefers-reduced-motion: "
                                 "reduce)').matches) requestAnimationFrame(frame);</script></main>")
        self.assertEqual(self.violations(answered), [])

    def wired_site(self):
        """A /site that satisfies every axiom, so a test can break one thing about it at a time."""
        (self.site / "js").mkdir(exist_ok=True)
        (self.site / mi.ANALYTICS_SCRIPT).write_text("/* the shared tag and banner */")
        links = "<nav><a href='toy.html'>toy</a> <a href='error.html'>error</a></nav>"
        (self.site / "index.html").write_text(page(title="home", body=links))
        (self.site / "error.html").write_text(page(title="not found"))
        (self.site / "toy.html").write_text(page(title="toy"))
        (self.site / "sitemap.xml").write_text(sitemap("index.html", "error.html", "toy.html"))
        self.assertEqual(mi.inaccessible_pages(dict(mi.read_site())), {})

    def wiring_in(self, content):
        """A plan that adds "new.html" with `content`, wired into the navigation and the sitemap."""
        links = ("<nav><a href='toy.html'>toy</a> <a href='error.html'>error</a> "
                 "<a href='new.html'>new</a></nav>")
        return {"files": [{"path": "new.html", "content": content},
                          {"path": "index.html", "content": page(title="home", body=links)},
                          {"path": "sitemap.xml",
                           "content": sitemap("index.html", "error.html", "toy.html", "new.html")}]}

    def test_a_page_a_run_adds_is_born_responsive_and_accessible(self):
        # The page is wired in properly, so reachability is satisfied and this is the only thing
        # left to refuse it for. A run that adds a page has no excuse: it is writing it from scratch.
        self.wired_site()
        with self.assertRaisesRegex(mi.RejectedChange,
                                   r"responsive and accessible: new\.html has no viewport meta tag"):
            mi.validate_plan(self.wiring_in(tagged("<h1>new</h1><p>a bare fragment</p>")))
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html has an <img> with no alt"):
            mi.validate_plan(self.wiring_in(page(title="new", body="<img src='a.png'>")))
        self.assertEqual(len(mi.validate_plan(self.wiring_in(page(title="new")))), 3)

    def test_making_a_page_that_was_fine_worse_is_refused(self):
        self.wired_site()
        for broken, reason in [
            (page(title="toy", viewport=""), "has no viewport meta tag with width=device-width"),
            (page(title="toy", lang=""), "has no lang attribute on <html>"),
            (page(title="toy", calm=False), "animates without honouring prefers-reduced-motion"),
            (page(title="toy", focus=False), "takes the focus outline away"),
            (page(title="toy", body="<button></button>"), "has a <button> with no accessible name"),
        ]:
            with self.subTest(reason=reason):
                with self.assertRaisesRegex(mi.RejectedChange, f"toy.html {re.escape(reason)}"):
                    mi.validate_plan({"files": [{"path": "toy.html", "content": broken}]})

    def test_a_page_that_already_fell_short_blocks_nothing(self):
        # The same bargain check_reachability makes, for the same reason: if a plan had to repair
        # every page that already falls short before it could do anything, no plan could ever be
        # applied -- including the one that repairs them. The throwaway /site here is two bare
        # fragments, so both of its pages fail the axiom from the start.
        self.assertEqual(sorted(mi.inaccessible_pages(dict(mi.read_site()))),
                         ["error.html", "index.html"])
        ops = mi.validate_plan({"files": [{"path": "index.html", "content": home("error.html")}]})
        self.assertEqual(len(ops), 1)
        self.assertIn("index.html", mi.inaccessible_pages(dict(mi.read_site())))

    def test_repairing_part_of_a_page_is_never_mistaken_for_breaking_it(self):
        # Every reason is a fixed string, so a repair can only take reasons away. Were they to carry
        # counts or lists, mending one of two nameless buttons would read as a brand-new reason and
        # the repair would be refused -- which would make the axiom unrepairable in practice.
        half_mended = page(title="home", body="<button></button><img src='a.png'>")
        (self.site / "index.html").write_text(
            page(title="home", body="<button></button><button></button><img src='a.png'>"))
        self.assertEqual(sorted(mi.inaccessible_pages(dict(mi.read_site()))["index.html"]),
                         ["has a <button> with no accessible name",
                          "has an <img> with no alt attribute"])
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "index.html",
                                                          "content": half_mended}]})), 1)
        mended = page(title="home", body="<button>go</button><img src='a.png' alt='a'>")
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "index.html",
                                                          "content": mended}]})), 1)

    def test_retiring_a_page_that_fell_short_is_fine(self):
        # A run that only deletes stays a successful run (issue #16), and deleting a page can only
        # take violations away.
        self.wired_site()
        (self.site / "old.html").write_text("<h1>old</h1>")
        ops = mi.validate_plan({"delete": ["old.html"]})
        self.assertEqual(len(ops), 1)

    def test_an_unparseable_page_is_its_own_kind_of_broken(self):
        with mock.patch.object(mi, "PageFacts", side_effect=ValueError("not HTML")):
            self.assertEqual(self.violations(page()), ["cannot be parsed as HTML"])


class LocalStateAxiomTest(SiteDirTestCase):
    """Issue #31: everything the site keeps in a visitor's browser lives in one JSON document, every
    page reads and writes it through one shared accessor, and a very small meta menu in the corner
    of every page exports, imports and clears it. All of it arrives with one line, and that line and
    the file behind it are held in place by exactly the machinery the analytics tag uses."""

    PAGES = ["index.html", "error.html", "toy.html"]

    def setUp(self):
        super().setUp()
        (self.site / "js").mkdir()
        (self.site / mi.STATE_SCRIPT).write_text("/* the shared store and its meta menu */")
        (self.site / "index.html").write_text(stored(home("toy.html", "error.html")))
        (self.site / "error.html").write_text(stored("<p>404</p>"))
        (self.site / "toy.html").write_text(stored("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.prompt()
        rules = rules[rules.index("Rules:"):]
        for rule in ["every page carries the site's local-state store and its meta menu",
                     mi.STATE_TAG,
                     "Keep that line on every page you rewrite",
                     "put it on every page you add",
                     f"../{mi.STATE_SCRIPT}",  # a page in a sub-folder
                     "It is not deferred on purpose",
                     "lives in one JSON document",
                     "no page may touch localStorage or sessionStorage itself",
                     "a shared file counts as the pages that load it",
                     "window.interestingState",
                     "state.read('constellation', [])",
                     "state.set('omens', omens)",
                     "is not shown to you, you may not write or delete it",
                     "is not yours to change or to restyle"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_the_prompt_names_the_statuses_and_the_keys_the_site_keeps(self):
        # A page has to be able to tell "you have not saved anything" from "what you saved is lost",
        # and has to reach the sky the other pages are reinterpreting under the name they use.
        rules = self.prompt()
        for named in ["'ok'", "'missing'", "'unreadable'", "'unavailable'",
                      '"constellation"', '"capsules"', '"omens"', '"threshold"']:
            with self.subTest(named=named):
                self.assertIn(named, rules)

    def test_a_page_a_run_adds_must_carry_the_line(self):
        # A whole page but for the one line, so this axiom is the only thing left to refuse it for.
        plan = {"files": [
            {"path": "new.html", "content": page(title="new", state="")},
            {"path": "index.html", "content": stored(home("toy.html", "error.html", "new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html has no <script"):
            mi.validate_plan(plan)
        plan["files"][0]["content"] = page(title="new")
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_dropping_the_line_from_a_page_a_run_rewrites_is_refused(self):
        for content in ["<p>no line at all</p>",
                        "<head><script>var STORE = 'js/state.js';</script></head>"]:
            with self.subTest(content=content[:40]), \
                    self.assertRaisesRegex(mi.RejectedChange, r"toy\.html has no <script"):
                mi.validate_plan({"files": [{"path": "toy.html", "content": content}]})
        # It is the src that counts, not the exact spelling of the tag around it.
        loaded = '<head><script src="js/state.js"></script></head>'
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": loaded}]})), 1)

    def test_a_page_in_a_sub_folder_loads_it_by_a_relative_src(self):
        plan = {"files": [
            {"path": "deep/new.html", "content": page(title="new", state=f"../{mi.STATE_SCRIPT}")},
            {"path": "index.html", "content": stored(home("toy.html", "error.html", "deep/new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "deep/new.html")},
        ]}
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_a_page_that_was_already_missing_the_line_blocks_nothing(self):
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": stored("<p>still has it</p>")}]})
        self.assertEqual(len(ops), 1)
        self.assertEqual(mi.pages_missing_state(dict(mi.read_site())), {"index.html"})

    def test_a_site_without_the_store_is_not_held_to_the_axiom(self):
        (self.site / mi.STATE_SCRIPT).unlink()
        self.assertEqual(mi.pages_missing_state(dict(mi.read_site())), set())
        self.assertEqual(mi.pages_touching_storage(dict(mi.read_site())), {})
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": "<p>bare</p>"}]})), 1)

    def test_the_store_can_neither_be_rewritten_nor_deleted(self):
        self.assertIn(mi.STATE_SCRIPT, mi.FIXED_FILES)
        for plan in [{"files": [{"path": mi.STATE_SCRIPT, "content": "rewritten from memory"}]},
                     {"delete": [mi.STATE_SCRIPT]}, {"delete": [f"site/{mi.STATE_SCRIPT}"]}]:
            with self.subTest(plan=str(plan)[:80]), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)

    def test_the_store_is_never_shown_to_a_model(self):
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertNotIn(mi.STATE_SCRIPT, [rel for rel, _ in shown])
        self.assertIn(mi.STATE_SCRIPT, omitted)
        self.assertNotIn("the shared store and its meta menu", mi.build_prompt(shown, omitted))

    def test_a_page_that_reaches_for_the_browsers_storage_is_refused(self):
        for code in ["localStorage.getItem('mine')", "window.sessionStorage.setItem('a', '1')"]:
            with self.subTest(code=code), \
                    self.assertRaisesRegex(mi.RejectedChange, r"no page may use the browser's storage"):
                mi.validate_plan({"files": [
                    {"path": "toy.html", "content": stored(f"<script>{code}</script>")}]})
        # The same page, going through the store instead, is fine.
        through = stored("<script>window.interestingState.get('constellation', []);</script>")
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": through}]})), 1)

    def test_a_shared_script_is_read_along_with_the_pages_that_load_it(self):
        # A federated site keeps its behaviour in shared files, so state kept behind the store's
        # back is as likely to be in "js/site.js" as in a page.
        plan = {"files": [
            {"path": "js/site.js", "content": "var saved = localStorage.getItem('mine');"},
            {"path": "toy.html", "content": stored("<script src='js/site.js'></script>")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r"toy\.html"):
            mi.validate_plan(plan)

    def test_the_fixed_files_may_use_the_browsers_storage(self):
        # They are the ones it belongs to: state.js is the store, and the consent banner keeps the
        # visitor's answer to it, which is deliberately not in the document.
        (self.site / mi.STATE_SCRIPT).write_text("localStorage.setItem('interesting_state_v1', '{}');")
        (self.site / "toy.html").write_text(stored("<script src='js/state.js'></script>"))
        self.assertEqual(mi.pages_touching_storage(dict(mi.read_site())), {})

    def test_a_page_that_already_went_round_the_store_blocks_nothing(self):
        # Only what the run itself breaks is refused, as with every other axiom.
        (self.site / "index.html").write_text(
            stored(home("toy.html", "error.html") + "<script>localStorage.clear();</script>"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": stored("<p>toy</p>")}]})
        self.assertEqual(len(ops), 1)
        self.assertEqual(sorted(mi.pages_touching_storage(dict(mi.read_site()))), ["index.html"])


def eval_ratio(aspect):
    """"4 / 5" as 0.8: the same reading of an aspect ratio that site/js/variant.js does."""
    parts = str(aspect).split("/")
    return float(parts[0]) / (float(parts[1]) if len(parts) > 1 else 1.0)


def needs_node(test):
    """Skip a test that runs Node when Node is not installed; in CI that is a failure instead."""
    if shutil.which(mi.NODE_BIN) is None:
        if os.environ.get("CI"):
            test.fail(f"Node is missing in CI ({mi.NODE_BIN!r})")
        test.skipTest(f"Node is not installed ({mi.NODE_BIN!r})")


class LocalStateStoreTest(unittest.TestCase):
    """What site/js/state.js actually does, run against a stub browser.

    The store and its meta menu are the one piece of behaviour every page of the site leans on and
    no run may rewrite, so unlike a page they are worth testing rather than only holding in place.
    state_store_harness.mjs loads the real file, drives it through a scenario each, and reports what
    it saw; the assertions are here.
    """

    SKY = [{"x": 10, "y": 20, "text": "a wish"}]
    CONSENT = "cc_cookie"  # the consent banner's own key, which is none of the store's business

    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        cls.harness = Path(mi.__file__).resolve().parent / "state_store_harness.mjs"
        cls.store = cls.repo / "site" / mi.STATE_SCRIPT
        cls.observed = None

    def setUp(self):
        if not self.store.is_file():
            self.skipTest(f"no local-state store at {self.store}")
        needs_node(self)
        if LocalStateStoreTest.observed is None:
            run = subprocess.run([mi.NODE_BIN, str(self.harness), str(self.store)],
                                 capture_output=True, text=True, timeout=60)
            self.assertEqual(run.returncode, 0, f"the harness failed: {run.stderr[-2000:]}")
            LocalStateStoreTest.observed = json.loads(run.stdout)
        self.seen = LocalStateStoreTest.observed

    def test_an_empty_browser_starts_from_one_empty_document(self):
        fresh = self.seen["fresh"]
        self.assertEqual(fresh["keys"], [])
        self.assertTrue(fresh["persistent"])
        self.assertEqual(fresh["document"], {"format": "interesting", "version": 1,
                                             "saved": None, "values": {}})
        self.assertTrue(fresh["indented"], "an exported document is for a person to read and paste")
        self.assertEqual(fresh["shelf"], {}, "nothing is written until something is kept")
        self.assertEqual(fresh["missing"], {"status": "missing", "value": []})
        self.assertEqual(fresh["inherited"], {"status": "missing", "value": []},
                         "a name is one the site kept, not one Object.prototype happens to have")

    def test_everything_is_kept_in_one_json_document_under_one_key(self):
        trip = self.seen["roundTrip"]
        self.assertTrue(trip["wrote"])
        self.assertEqual(list(trip["shelf"]), ["interesting_state_v1"])
        self.assertEqual(self.seen["fresh"]["storageKey"], "interesting_state_v1")
        self.assertEqual(trip["shelf"]["interesting_state_v1"]["values"], {"constellation": self.SKY})
        self.assertEqual(trip["keys"], ["constellation"])
        self.assertEqual(trip["read"], {"status": "ok", "value": self.SKY})
        self.assertEqual(trip["get"], self.SKY)
        self.assertEqual(trip["saved"], "string", "a document says when it was saved")

    def test_a_write_in_one_tab_keeps_what_another_tab_saved(self):
        # One document for the whole site is one document for every tab of it, which a key per page
        # was not: a page that wrote its own copy of the document back whole would throw away
        # whatever the other tab had saved while it sat open.
        tabs = self.seen["twoTabs"]
        self.assertEqual(tabs["shelf"]["interesting_state_v1"]["values"],
                         {"omens": [{"text": "an omen", "time": 1}], "constellation": self.SKY})
        self.assertEqual(tabs["reloaded"], ["constellation", "omens"])
        self.assertEqual(sorted(tabs["exported"]), ["constellation", "omens"],
                         "and an export is the whole state, not one tab's view of it")
        self.assertEqual(tabs["homeStillReads"], {"status": "ok", "value": self.SKY})

    def test_a_browser_that_stores_nothing_falls_back_to_memory(self):
        # The first of the two fallbacks the issue asks for.
        without = self.seen["withoutStorage"]
        self.assertFalse(without["persistent"])
        self.assertEqual(without["missing"], {"status": "unavailable", "value": []})
        self.assertFalse(without["wrote"], "a page is told it could only keep this in memory")
        self.assertEqual(without["afterWriting"], {"status": "ok", "value": self.SKY},
                         "the page still works, for as long as it is open")
        self.assertEqual(without["shelf"], {})
        self.assertEqual(without["reloaded"], {"status": "unavailable", "value": []})

    def test_a_browser_that_runs_out_of_room_keeps_what_the_page_was_told_it_kept(self):
        # The same fallback, reached the other way: storage was offered and then refused a write.
        # `set` saying false has to mean "kept in memory", so a later read -- or the meta menu
        # asking for the whole document -- must not roll the page back to what the browser saved.
        filled = self.seen["storageFillsUp"]
        self.assertFalse(filled["wrote"], "a page is told the write did not reach the browser")
        self.assertEqual(filled["afterWriting"], {"status": "ok", "value": self.SKY})
        self.assertEqual(filled["exported"]["constellation"], self.SKY,
                         "an export is the state the page has, not the part that got saved")
        self.assertEqual(filled["afterExporting"], {"status": "ok", "value": self.SKY},
                         "and asking for the document does not throw the rest of it away")
        self.assertEqual(filled["omens"], [{"text": "saved in time", "time": 1}])
        self.assertEqual(list(filled["shelf"]["interesting_state_v1"]["values"]), ["omens"],
                         "the browser still holds only what it accepted")
        self.assertTrue(filled["roomAgain"]["wrote"], "and a write gets through once there is room")
        self.assertEqual(sorted(filled["roomAgain"]["shelf"]["interesting_state_v1"]["values"]),
                         ["capsules", "constellation", "omens"],
                         "carrying what had only been in memory with it")

    def test_a_missing_or_malformed_value_falls_back_to_the_callers_default(self):
        # The second fallback, and the reason `status` exists: "you have not saved anything" and
        # "what you saved is lost" are different things for a page to say.
        bad = self.seen["malformed"]
        for name in ["truncated", "notAnObject", "emptyEnvelope"]:
            with self.subTest(name=name):
                self.assertEqual(bad[name]["read"], {"status": "unreadable", "value": []})
                self.assertEqual(bad[name]["keys"], [])
        self.assertEqual(bad["bareValues"]["read"]["status"], "ok",
                         "a document trimmed down to its values by hand still reads")

    def test_the_keys_the_site_used_to_keep_are_carried_into_the_document(self):
        carried = self.seen["carriesEarlierKeysOver"]
        self.assertEqual(carried["keys"], ["capsules", "constellation", "omens"])
        self.assertEqual(carried["values"]["constellation"], self.SKY)
        self.assertEqual(sorted(carried["shelf"]), [self.CONSENT, "interesting_state_v1"],
                         "the old per-page keys are taken away, and nothing else is touched")
        self.assertEqual(carried["again"], ["capsules", "constellation", "omens"],
                         "a second visit finds the document, not the keys")
        kept = self.seen["earlierKeyDoesNotOverwrite"]
        self.assertEqual(kept["value"], [{"x": 1, "y": 1, "text": "newer"}])
        self.assertEqual(list(kept["shelf"]), ["interesting_state_v1"])

    def test_a_whole_state_travels_as_one_piece_of_text(self):
        # The point of the thing: someone can collect their skies, and hand one to someone else.
        swap = self.seen["exportThenImport"]
        self.assertEqual(json.loads(swap["text"])["values"], {"constellation": self.SKY})
        self.assertTrue(swap["outcome"]["ok"], swap["outcome"]["note"])
        self.assertEqual(swap["constellation"], self.SKY)
        # Replace, not merge, for reproducibility: the sky they open is the sky it came from.
        self.assertEqual(swap["keys"], ["constellation"])
        self.assertEqual(swap["omens"], {"status": "missing", "value": []})

    def test_import_refuses_what_is_not_a_state_document_and_changes_nothing(self):
        edges = self.seen["importEdges"]
        for name in ["blank", "notJson", "anArray", "brokenEnvelope", "tooBig"]:
            with self.subTest(name=name):
                self.assertFalse(edges[name]["outcome"]["ok"])
                self.assertTrue(edges[name]["outcome"]["note"])
                self.assertEqual(edges[name]["keys"], ["constellation"], "nothing was changed")
        for name in ["envelope", "bareValues"]:
            with self.subTest(name=name):
                self.assertTrue(edges[name]["outcome"]["ok"])
                self.assertEqual(edges[name]["keys"], ["omens"])

    def test_clearing_takes_the_sites_own_state_and_nothing_else(self):
        cleared = self.seen["clearing"]
        self.assertTrue(cleared["outcome"]["ok"], cleared["outcome"]["note"])
        self.assertEqual(cleared["keys"], [])
        self.assertEqual(list(cleared["shelf"]), [self.CONSENT],
                         "the consent answer is the banner's, not the store's (open question 7)")
        self.assertEqual(cleared["reloaded"], [])
        self.assertTrue(cleared["removed"])

    def test_the_meta_menu_is_one_small_named_affordance_that_starts_closed(self):
        menu = self.seen["menu"]
        self.assertEqual(menu["affordances"], 1, "one corner affordance, like the cookies button")
        self.assertEqual(menu["rootClass"], "site-meta")
        self.assertEqual(menu["shut"]["openTag"], "button")
        self.assertEqual(menu["shut"]["openType"], "button")
        self.assertEqual(menu["shut"]["openText"], "state")
        self.assertTrue(menu["shut"]["openLabel"], "WCAG 4.1.2: it has an accessible name")
        self.assertTrue(menu["shut"]["panelHidden"], "it pops up when clicked, and not before")
        self.assertEqual(menu["shut"]["openExpanded"], "false")
        self.assertEqual(menu["shut"]["openControls"], menu["shut"]["panelId"])
        self.assertEqual(menu["shut"]["panelRole"], "dialog")
        self.assertTrue(menu["shut"]["panelLabel"])
        self.assertEqual(menu["shut"]["labelFor"], menu["shut"]["fieldId"],
                         "WCAG 3.3.2: the textarea is labelled")
        self.assertEqual(menu["shut"]["buttons"], ["copy", "replace mine", "clear", "close"],
                         "export, import, clear -- and a way out")
        self.assertEqual(menu["shut"]["noteLive"], "polite", "what it did is announced")

    def test_opening_the_menu_shows_the_whole_document_ready_to_copy(self):
        menu = self.seen["menu"]
        self.assertFalse(menu["opened"]["panelHidden"])
        self.assertEqual(menu["opened"]["openExpanded"], "true")
        self.assertEqual(menu["filledParses"], self.SKY, "export is the text in the box")

    def test_the_menu_is_operable_and_escapable_by_keyboard(self):
        menu = self.seen["menu"]
        self.assertEqual(sorted(menu["documentListeners"]), ["keydown", "pointerdown"])
        self.assertTrue(menu["escaped"]["panelHidden"], "Escape closes it")
        self.assertEqual(menu["escaped"]["openExpanded"], "false")
        self.assertTrue(menu["closed"]["openFocused"], "and the focus comes back to the button")

    def test_the_menu_carries_its_own_focus_ring_and_tap_targets(self):
        # The pages are free to take the browser's outline off their own controls, and several do,
        # so the menu brings its own styles with it rather than trusting a stylesheet it cannot own.
        styles = self.seen["menu"]["styles"]
        self.assertIn(":focus-visible", styles)
        self.assertIn("outline: 2px solid", styles)
        self.assertIn("min-height: 44px", styles)
        self.assertIn("calc(100vw", styles, "it has to fit a 320px screen")
        self.assertNotIn("outline: none", styles)

    def test_the_three_operations_work_from_the_menus_own_buttons(self):
        acted = self.seen["menuActions"]
        self.assertTrue(acted["copied"]["selected"],
                        "with no clipboard to write to, the text is at least selected")
        self.assertTrue(acted["copied"]["note"])
        self.assertEqual(acted["imported"]["keys"], ["omens"])
        self.assertEqual(acted["imported"]["reloads"], 1,
                         "every page reads the new state the way it reads any other: from the start")
        self.assertEqual(acted["refused"]["keys"], ["omens"], "a bad paste changes nothing")
        self.assertEqual(acted["refused"]["reloads"], 1, "and reloads nothing")
        self.assertEqual(acted["refused"]["asked"], acted["imported"]["asked"],
                         "a paste that could not land asks nothing: there is nothing to be sure of")
        self.assertEqual(acted["cleared"]["keys"], [])
        self.assertEqual(acted["cleared"]["shelf"], {})
        self.assertEqual(acted["cleared"]["confirmed"], 0,
                         "the shared modal is the question; the browser's own is never reached")

    def test_the_menus_clear_is_the_shared_destructive_control(self):
        # Issue #42: the meta menu adopts the one shared component every other destructive control
        # on the site uses, even though this file is fixed, is never shown to a model and carries
        # its own styles. Both halves of the law hold here: the warning treatment on the button,
        # and the one modal naming the specific thing about to go.
        guarded = self.seen["clearingIsGuarded"]
        self.assertIn(mi.WARNING_CLASS, guarded["warning"].split())
        self.assertEqual(guarded["plain"], ["", "", ""],
                         "the warning treatment means one thing, so only clear wears it")
        self.assertEqual(len(guarded["asked"]), 1, "one press, one question")
        asked = guarded["asked"][0]
        self.assertEqual(asked["what"], "clear everything this site has kept in your browser",
                         "the blank in \"are you sure you want to ______?\" names what goes")
        self.assertIn("nothing would take their place", asked["detail"])
        self.assertTrue(asked["confirm"], "the modal's own button says what it will do")
        self.assertEqual(guarded["note"], "Nothing was cleared.")
        self.assertEqual(guarded["keys"], ["constellation"], "saying no keeps everything")
        self.assertEqual(guarded["confirmed"], 0, "window.confirm is not what asks any more")

    def test_clearing_an_empty_document_has_nothing_to_ask_about(self):
        # The question is about what is lost, so a press that loses nothing goes straight through.
        # The warning stays on the button either way: a control that changes its clothes is a
        # control nobody learns.
        empty = self.seen["clearingAnEmptyDocument"]
        self.assertEqual(empty["asked"], [])
        self.assertEqual(empty["confirmed"], 0)
        self.assertIn(mi.WARNING_CLASS, empty["warning"].split())
        self.assertTrue(empty["note"])

    def test_importing_someone_elses_document_is_asked_about_too(self):
        # "replace mine" sits at the threshold rather than above it -- the whole document goes, but
        # the one in the box takes its place -- so it asks the same question through the same modal
        # and wears no warning.
        imported = self.seen["importIsAskedAboutAndRefusable"]
        self.assertEqual(len(imported["asked"]), 1)
        self.assertIn("replace everything this site has kept in your browser",
                      imported["asked"][0]["what"])
        self.assertEqual(imported["asked"][0]["opener"], "replace mine",
                         "the focus goes back to the control that opened it")
        self.assertEqual(imported["refused"]["keys"], ["constellation"], "saying no keeps your own")
        self.assertEqual(imported["refused"]["note"], "Nothing was replaced.")
        self.assertEqual(imported["ontoNothing"]["asked"], 0,
                         "an empty document has nothing to lose, so there is nothing to ask")
        self.assertEqual(imported["ontoNothing"]["keys"], ["omens"])

    def test_the_menu_still_asks_if_the_shared_component_has_gone(self):
        # js/site.js is ordinary site source that an hourly run may break; this file never changes,
        # and the menu is the one thing on the site a visitor can rely on being where they left it.
        # So each call falls back to the browser's own question: less good, and it still asks.
        alone = self.seen["withoutTheSharedComponent"]
        self.assertIn(mi.WARNING_CLASS, alone["warning"].split(),
                      "the button still wears the class the shared styling paints")
        self.assertEqual(alone["refused"]["confirmed"], 1)
        self.assertEqual(alone["refused"]["keys"], ["constellation"], "saying no keeps everything")
        self.assertEqual(alone["refused"]["note"], "Nothing was cleared.")
        self.assertEqual(alone["cleared"]["confirmed"], 1)
        self.assertEqual(alone["cleared"]["keys"], [], "and saying yes clears it")

    def test_the_menu_lends_its_panel_to_a_shell_that_has_a_better_place_for_it(self):
        # Issue #66: the state interface belongs in a modal in the middle of the screen, and the
        # shell has the lightbox to put it in. So this file offers the panel rather than the shell
        # reproducing it -- one state menu on the site, wherever it is being held -- and offers it
        # as a request it can refuse, because this is the fixed file and js/site.js is not.
        seen = self.seen["presentedInAHost"]
        offered, presented = seen["offered"], seen["presented"]
        self.assertTrue(offered["menu"], "the menu is reachable from the one global")
        self.assertTrue(offered["samePanel"], "and it is the panel this file built")
        self.assertEqual(offered["present"], "function")
        self.assertIsNone(offered["withoutAHost"], "nowhere to put it is not somewhere")
        self.assertEqual(presented["release"], "function", "and a way to give it back")
        self.assertTrue(presented["inHost"], "the panel is moved into the host")
        self.assertFalse(presented["leftTheCorner"], "and is no longer in the corner")
        self.assertFalse(presented["panelHidden"], "it is opened, not merely moved")
        self.assertEqual(presented["dressed"], "",
                         "and dressed as a modal, by this file's own styles")
        self.assertEqual(presented["ariaModal"], "true", "WCAG 4.1.2: it says it is one")
        self.assertEqual(presented["openExpanded"], "true")
        self.assertEqual(presented["filled"], self.SKY, "with the whole document ready to copy")
        self.assertTrue(presented["focusedField"], "and the text box has the focus")
        self.assertEqual(presented["buttons"], ["copy", "replace mine", "clear", "close"],
                         "the same contents and the same words: only the framing changed")
        # The ways out are the ways out wherever it is being held -- and a press inside the panel
        # is not one of them, which it would have been while "outside" meant "outside the corner".
        self.assertFalse(seen["afterPressingInside"], "a press in the panel closed it")
        self.assertTrue(seen["afterPressingOutside"])
        self.assertTrue(seen["afterEscape"])
        # Handed back: closed, undressed, and exactly where it was built.
        given = seen["given"]
        self.assertTrue(given["panelHidden"])
        self.assertTrue(given["home"], "back in the corner it came from")
        self.assertFalse(given["inHost"])
        self.assertIsNone(given["dressed"])
        self.assertIsNone(given["ariaModal"])
        self.assertEqual(given["openExpanded"], "false")
        self.assertEqual(seen["stillHome"], 1, "and there once, however often it is handed back")
        # And the corner menu is still the corner menu, which is the whole point of the panel
        # being lent rather than taken: a shell that never asks leaves a visitor a way to their
        # own state, and no run can write that away.
        self.assertFalse(seen["cornerStillOpensIt"]["panelHidden"])
        self.assertTrue(seen["cornerStillOpensIt"]["home"])

    def test_a_browser_that_stores_nothing_says_so_when_the_menu_opens(self):
        self.assertIn("stores nothing", self.seen["menuWithoutStorage"]["note"])

    def test_importing_without_storage_holds_the_sky_and_does_not_reload_it_away(self):
        # A reload re-reads from the store, which a browser that stores nothing leaves empty, so
        # reloading an import it could only hold in memory would discard the very sky just pasted in.
        imported = self.seen["importWithoutStorage"]
        self.assertEqual(imported["imported"], [{"text": "theirs", "time": 3}],
                         "the imported sky is live for this page")
        self.assertEqual(imported["reloads"], 0, "but the menu must not reload it away")
        self.assertIn("this page only", imported["note"])


class CardVariantTest(unittest.TestCase):
    """What site/js/variant.js actually does: the randomized configuration a repeated feed card
    wears (issue #53).

    The feed deals endlessly, so every world comes round again and again, and a repeat used to
    differ only in whatever its module happened to do with a fresh seed -- same palette, same frame,
    nothing else moving at all. A variant is what else there is now, and two things about it are
    worth testing rather than only reading: it is arithmetic over a seed with no browser in it,
    which is the whole reason it is its own file; and what it is for is that a card looks
    different, which is measurable. card_variant_harness.mjs rolls it, re-derives all fifteen mood
    palettes through it and paints every world's module under it against a recording stand-in for a
    canvas; the assertions are here.
    """

    # The two text colours a configuration may never move, and the ratio the accessibility axiom
    # asks of them. They are spelled out here rather than read from the Sass so that moving them
    # fails this test rather than passing quietly with a new pair.
    FG = "#e6eaf5"
    MUTED = "#b7c0da"
    MIN_CONTRAST = 4.5
    # How _sass/_tokens.scss derives the two surface tiers a card's text actually sits on, as
    # (accent, white) fractions: surface-container, which a card's body is, and
    # surface-container-highest, the brightest thing derived from a card's ground. Mixed here in
    # sRGB where the sheet mixes in oklab, which is close enough for a guard and never flattering:
    # the check is a floor on the contrast, not a reproduction of the browser's arithmetic.
    TIERS = ((0.09, 0.055), (0.13, 0.12))

    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        cls.harness = Path(mi.__file__).resolve().parent / "card_variant_harness.mjs"
        cls.variant = cls.repo / "site" / "js" / "variant.js"
        cls.modules = cls.repo / "site" / "js" / "modules"
        cls.observed = None

    def setUp(self):
        if not self.variant.is_file():
            self.skipTest(f"no card configuration at {self.variant}")
        needs_node(self)
        if CardVariantTest.observed is None:
            run = subprocess.run([mi.NODE_BIN, str(self.harness), str(self.variant),
                                  str(self.modules), json.dumps(self.palettes())],
                                 capture_output=True, text=True, timeout=180)
            self.assertEqual(run.returncode, 0, f"the harness failed: {run.stderr[-2000:]}")
            CardVariantTest.observed = json.loads(run.stdout)
        self.seen = CardVariantTest.observed

    def palettes(self):
        """The fifteen palettes, read out of _sass/_mood.scss: the colours a configuration starts
        from, taken from the one place they are written rather than from a copy kept here."""
        sass = (self.repo / "site" / "_sass" / "_mood.scss").read_text()
        found = {mood: seeds.split(", ") for mood, seeds
                 in re.findall(r"^  ([a-z]+): \((#[0-9a-f]+(?:, #[0-9a-f]+)*)\),?$", sass, re.M)}
        self.assertGreaterEqual(len(found), 10, "the mood palettes have moved out of _mood.scss")
        for mood, seeds in found.items():
            self.assertEqual(len(seeds), 4, f"{mood} is not four seeds")
        return found

    # ---- small colour arithmetic, so the assertions can be about what a visitor sees ----

    @staticmethod
    def rgb(value):
        text = value.strip()
        if text.startswith("#"):
            hexed = text[1:]
            if len(hexed) == 3:
                hexed = "".join(c * 2 for c in hexed)
            return tuple(int(hexed[i:i + 2], 16) for i in (0, 2, 4))
        return tuple(float(n) for n in re.findall(r"[\d.]+", text)[:3])

    @classmethod
    def luminance(cls, value):
        def channel(byte):
            x = byte / 255.0
            return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
        r, g, b = (channel(byte) for byte in cls.rgb(value))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    @classmethod
    def contrast(cls, a, b):
        la, lb = cls.luminance(a), cls.luminance(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

    @classmethod
    def mix(cls, a, b, t):
        A, B = cls.rgb(a), cls.rgb(b)
        return "rgb(%d,%d,%d)" % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))

    @classmethod
    def tiers(cls, seeds):
        """The surface tones a card's text sits on, derived from its four configured seeds the way
        _sass/_tokens.scss derives them."""
        return [cls.mix(cls.mix(seeds["bg"], seeds["accent"], accent), "#fff", white)
                for accent, white in cls.TIERS]

    # ---- the configuration itself ----

    def test_the_first_card_of_a_world_is_configured_to_change_nothing(self):
        # Open question 3 of the issue, answered: the card the template wrote keeps its world's
        # palette and its world's frame, so the feed still leads with the fifteen moods, and the
        # repeats are what vary. Every dial of the plain variant is its no-op value.
        plain = self.seen["plain"]
        self.assertTrue(plain["plain"])
        self.assertEqual({name: plain[name] for name in ("trade", "lift", "wash", "turn")},
                         {"trade": 0, "lift": 0, "wash": 0, "turn": 0})
        self.assertEqual({name: plain[name] for name in ("density", "scale", "stretch")},
                         {"density": 1, "scale": 1, "stretch": 1})
        for frame in self.seen["frames"]:
            self.assertEqual(frame["plain"], frame["ratio"], "a plain card keeps its world's frame")
        self.assertEqual(self.seen["plainLight"], "30% 20%",
                         "and the light where _sass/_feed.scss puts it on its own")

    def test_a_card_paints_the_same_picture_every_time_and_a_different_one_from_its_neighbour(self):
        # The bargain the whole feed rests on: seeded, so a card repainted at a new column width is
        # the same card, and no two cards are configured alike.
        self.assertTrue(self.seen["repeatable"], "the same seed has to give the same configuration")
        self.assertGreaterEqual(self.seen["distinct"], len(self.seen["rolls"]) - 1,
                                "two seeds in six hundred rolled the same configuration")

    def test_every_dial_covers_its_range(self):
        # A dial that never leaves the middle is a dial that varies nothing. Each has to be found
        # inside its declared range and spread across it.
        rolls = self.seen["rolls"]
        self.assertGreaterEqual(len(rolls), 100)
        for name in self.seen["dials"]:
            low, high = self.seen["ranges"][name]
            values = sorted(roll[name] for roll in rolls)
            with self.subTest(dial=name):
                self.assertGreaterEqual(values[0], low)
                self.assertLessEqual(values[-1], high)
                span = values[-1] - values[0]
                self.assertGreater(span, (high - low) * 0.8, "this dial hardly moves")

    def test_a_cards_accents_either_keep_their_moods_order_or_turn_it_over(self):
        # Half way through `trade` a palette's two accents meet in the middle, and a card with one
        # accent instead of two has lost the contrast its palette is built on. So the middle is
        # never visited, and both ends are.
        trades = [roll["trade"] for roll in self.seen["rolls"]]
        kept = [t for t in trades if t <= 0.3]
        turned = [t for t in trades if t >= 0.7]
        self.assertEqual(len(kept) + len(turned), len(trades), "a card landed on one accent")
        self.assertGreater(min(len(kept), len(turned)), len(trades) * 0.3,
                           "the accents go one way far more often than the other")

    # ---- what it does to colour ----

    def test_a_configured_card_is_a_different_colour_from_the_first_card_of_its_world(self):
        # The second half of the issue: colour follows the configuration. Every mood has to come out
        # of it as many palettes rather than one, and a rolled palette has to differ from the plain
        # one in more than a rounding.
        for mood, info in sorted(self.seen["colors"].items()):
            rolled = info["rolled"]
            with self.subTest(mood=mood):
                palettes = {tuple(sorted(seeds.items())) for seeds in rolled}
                self.assertGreater(len(palettes), len(rolled) * 0.9,
                                   "this mood gives nearly every card the same palette")
                moved = [seeds for seeds in rolled
                         if self.rgb(seeds["bg2"]) != self.rgb(info["plain"]["bg2"])
                         or self.rgb(seeds["bg"]) != self.rgb(info["plain"]["bg"])]
                self.assertGreater(len(moved), len(rolled) * 0.9,
                                   "a configured card is the colour of a plain one")

    def test_a_configured_card_is_still_its_own_worlds_colour(self):
        # Open question 5 of the issue, answered: yes, a card is still its world's. The
        # configuration never fetches a colour from outside the palette the card's own mood gives
        # it -- it only blends the four it has, and black, which is where a lifted ground is pulled
        # back to. So every channel of every configured seed lands inside the range those five
        # already span, which is what "re-tints itself from its own world's seeds" means.
        for mood, info in sorted(self.seen["colors"].items()):
            base = info["base"]
            corners = [self.rgb(base[name]) for name in ("bg", "bg2", "accent", "accent2")] + [(0, 0, 0)]
            low = [min(corner[i] for corner in corners) for i in range(3)]
            high = [max(corner[i] for corner in corners) for i in range(3)]
            with self.subTest(mood=mood):
                for seeds in info["rolled"]:
                    for name in ("bg", "bg2", "accent", "accent2"):
                        for i, byte in enumerate(self.rgb(seeds[name])):
                            self.assertGreaterEqual(byte, low[i] - 1, f"--{name} left the palette")
                            self.assertLessEqual(byte, high[i] + 1, f"--{name} left the palette")

    def test_a_configured_cards_accents_are_its_own_moods_two_accents(self):
        # The most recognisable part of a palette is its accent, and the configuration only ever
        # trades a mood's two for each other: whichever way round they land, a card is wearing the
        # pair its world answers to.
        for mood, info in sorted(self.seen["colors"].items()):
            pair = (self.rgb(info["base"]["accent"]), self.rgb(info["base"]["accent2"]))
            with self.subTest(mood=mood):
                for seeds in info["rolled"]:
                    for accent in (self.rgb(seeds["accent"]), self.rgb(seeds["accent2"])):
                        between = all(min(pair[0][i], pair[1][i]) - 1 <= accent[i] <= max(pair[0][i], pair[1][i]) + 1
                                      for i in range(3))
                        self.assertTrue(between, f"{accent} is neither of this mood's accents")

    def test_no_configuration_takes_a_cards_text_below_the_contrast_the_axiom_asks(self):
        # The accessibility axiom, over the whole space the configuration can reach: --fg and
        # --muted are never configured, and the surface tones the text sits on are derived from a
        # ground the configuration does move, so this is the check that the ground's ceiling is in
        # the right place. Every mood, every roll, both tiers, both text colours.
        worst = (99.0, None)
        for mood, info in sorted(self.seen["colors"].items()):
            for seeds in [info["plain"]] + info["rolled"]:
                for tier in self.tiers(seeds):
                    for text in (self.FG, self.MUTED):
                        worst = min(worst, (self.contrast(text, tier), (mood, text, tier)))
        self.assertGreaterEqual(worst[0], self.MIN_CONTRAST,
                                f"a configured card drops text to {worst[0]:.2f}:1 ({worst[1]})")

    def test_a_cards_accents_stay_legible_as_the_primary_and_tertiary_roles(self):
        # The overline on every card is --md-sys-color-primary, which is --accent, over the card's
        # own container tone. Trading the accents must not leave that text unreadable either.
        for mood, info in sorted(self.seen["colors"].items()):
            container = None
            with self.subTest(mood=mood):
                for seeds in [info["plain"]] + info["rolled"]:
                    container = self.tiers(seeds)[0]
                    for accent in (seeds["accent"], seeds["accent2"]):
                        self.assertGreaterEqual(self.contrast(accent, container), self.MIN_CONTRAST)

    def test_the_ground_a_configuration_lifts_stays_dark(self):
        # The one thing the ceiling is for: however far `lift` carries a card's ground toward its lit
        # corner, the result is still a night sky rather than a lit room, which is also what keeps
        # the tiers above in range.
        for mood, info in sorted(self.seen["colors"].items()):
            with self.subTest(mood=mood):
                for seeds in info["rolled"]:
                    self.assertLessEqual(self.luminance(seeds["bg"]), 0.0105,
                                         "this card's ground is brighter than the dark scheme allows")

    # ---- what it does to a world's picture ----

    def test_a_repeat_of_a_world_draws_a_different_picture_from_the_first_card_of_it(self):
        # The first half of the issue, measured: paint one world from one seed, in one palette,
        # under three configurations, and the drawing calls have to differ. Same seed and same
        # colours throughout, so the only thing moving is the configuration.
        self.assertGreaterEqual(len(self.seen["modules"]), 10, "where are the world modules")
        for name, mod in sorted(self.seen["modules"].items()):
            with self.subTest(module=name):
                drawings = mod["drawings"]
                self.assertIn("plain", drawings, "this world drew nothing at all")
                self.assertNotEqual(drawings["plain"], drawings["low"])
                self.assertNotEqual(drawings["plain"], drawings["high"])
                self.assertNotEqual(drawings["low"], drawings["high"])

    def test_sixty_configurations_of_a_world_are_sixty_cards(self):
        # And not three. A world whose module leans on one dial would pass the test above and still
        # deal the same few pictures over and over; this is the one that says a repeat keeps on
        # being a new card as a visitor scrolls. Several of these worlds drew from the persona's
        # stars alone and so had exactly one picture before the configuration existed.
        for name, mod in sorted(self.seen["modules"].items()):
            with self.subTest(module=name):
                self.assertGreaterEqual(mod["variety"], 40,
                                        f"sixty configurations gave {mod['variety']} pictures")

    def test_no_configuration_breaks_a_world(self):
        # The modules' paint/animate/spark contract still holds everywhere in the ranges: the dials
        # arrive as numbers a module multiplies by, and nothing in the space they cover may throw.
        for name, mod in sorted(self.seen["modules"].items()):
            with self.subTest(module=name):
                self.assertEqual(mod["threw"], [])
                self.assertGreater(mod["calls"]["plain"], 3, "this world barely draws anything")

    # ---- what a card in motion does ----

    # The loosest the frame-to-frame guard below can be and still be worth having. A frame of the
    # feed's loop is a step in a picture, not a new picture: over the configurations and seeds the
    # harness follows, the most any world moves in one frame is about 0.27 of its drawing, and a
    # world left re-dealing its puzzle per frame moves 0.40 or more. The number sits between the
    # two, with the headroom on the side of the worlds that behave. What it is here to catch is a
    # world that is a perfectly steady function of t and still races -- `t` multiplied hard enough
    # that a card flickers. Re-dealing is caught earlier and more plainly, by the sealed stream.
    MOST_A_FRAME_MAY_MOVE = 0.35

    def motions(self, mod):
        """Every card of one world the harness followed in motion: the three opposite
        configurations and sixty rolled seeds, as one flat list."""
        motion = mod.get("motion")
        self.assertIsNotNone(motion, "this world exports animate but was never followed in motion")
        return [card for name, card in motion.items() if name != "rolled"] + motion["rolled"]

    def animated(self):
        """The worlds whose cards move at all, as (name, module). A world with no `animate` is not
        held to any of this: its card is a still picture and that is a whole answer."""
        found = [(name, mod) for name, mod in sorted(self.seen["modules"].items()) if mod.get("motion")]
        self.assertGreaterEqual(len(found), 5, "no world's card moves any more")
        return found

    def test_a_card_in_motion_never_deals_itself_another_puzzle(self):
        # The whole of issue #92. js/feed.js paints a card once and then hands the module's
        # `animate` the very same env about thirty times a second -- and that env carries the card's
        # seeded stream, which paint has already spent. A module that deals its plan inside
        # `animate` therefore deals a different puzzle every frame: not an ambient picture but a card
        # re-rolling itself thirty times a second, which is what "animation run completely amok" was.
        # The harness seals the spent stream off after paint, so a module that reaches for it throws
        # here instead of flickering in front of a visitor.
        for name, mod in self.animated():
            with self.subTest(module=name):
                for card in self.motions(mod):
                    self.assertIsNone(card.get("threw"), f"{name}: {card.get('threw')}")

    def test_the_same_card_at_the_same_moment_is_the_same_drawing(self):
        # Said directly, and without relying on the seal above to catch it: `animate` is a function
        # of (w, h, env, t). Called twice over with everything the same, it has to draw the same
        # thing, because the loop's own clock is the only thing that moves between two frames.
        for name, mod in self.animated():
            with self.subTest(module=name):
                for card in self.motions(mod):
                    if card.get("still"):
                        continue
                    self.assertTrue(card["steady"], "this card draws something else at the same t")

    def test_motion_begins_at_the_picture_the_still_card_left(self):
        # The contract js/feed.js settles on: `t` is seconds since this card was painted, so the
        # first frame is t = 0, and t = 0 is the picture already on the canvas. Before this, the loop
        # passed seconds since the page opened, so a card painted after a long scroll cut straight
        # into an arbitrary phase of its own motion -- a visible jolt the moment it started moving,
        # on top of the re-dealing above.
        for name, mod in self.animated():
            with self.subTest(module=name):
                for card in self.motions(mod):
                    if card.get("still"):
                        continue
                    self.assertTrue(card["seam"],
                                    "this card jumps between its still picture and its first frame")

    def test_a_card_that_says_nothing_moves_draws_nothing(self):
        # The other half of that contract: a module may answer false to mean that this card is a
        # printed thing with no motion in it -- the cipher cabinet's grille, the weaver's moire
        # screens -- and the loop lets it go rather than asking thirty times a second for a picture
        # that never changes. Saying so and then drawing anyway would leave the card's last frame
        # on the canvas instead of the still picture paint made.
        said = 0
        for name, mod in self.animated():
            with self.subTest(module=name):
                for card in self.motions(mod):
                    if not card.get("still"):
                        continue
                    said += 1
                    self.assertEqual(card["drew"], 0, "this card says nothing moves and then draws")
        # And some card somewhere does answer false, so the branch above is exercised rather than
        # being a path nothing in the site takes.
        self.assertGreater(said, 0, "nothing ever answers false, so that half of the contract is untested")

    def test_one_frame_is_a_step_in_a_picture_and_not_a_new_picture(self):
        # The symptom a visitor reported, measured rather than read: a card whose canvas "churns,
        # flickers or races". However a world chooses to move, a thirtieth of a second may only move
        # a little of its drawing, and two and a half seconds has to move something -- a card that
        # never changes at all should have said so by answering false instead.
        for name, mod in self.animated():
            with self.subTest(module=name):
                for card in self.motions(mod):
                    if card.get("still"):
                        continue
                    self.assertLessEqual(card["frame"], self.MOST_A_FRAME_MAY_MOVE,
                                         "this card redraws itself from frame to frame")
                    self.assertGreater(card["moved"], 0,
                                       "this card moves not at all, and never said so")
                    self.assertGreaterEqual(card["moved"], card["frame"] * 0.5,
                                            "a frame of this card changes more than twice what two "
                                            "and a half seconds of it does")

    # ---- the configuration a piece opens with ----

    def test_the_configuration_a_card_hands_over_arrives_as_it_left(self):
        # The alignment axiom (issue #80): a card and the feature it opens as are one content piece,
        # procedurally configured once, so the configuration a card was wearing has to survive the
        # hand-over to the stage exactly. A round trip through what js/feed.js passes and
        # js/stage.js revives is the same seven dials, and the plain configuration stays plain --
        # the card the template wrote opens as plainly as it was dealt.
        plain = self.seen["revived"]["plain"]
        self.assertTrue(plain["plain"])
        self.assertEqual(plain, self.seen["plain"])
        for case in self.seen["revived"]["cases"]:
            with self.subTest(seed=case["seed"]):
                self.assertEqual(case["roundTrip"], case["rolled"],
                                 "a configuration handed to the stage is not the one the card wore")

    def test_a_piece_nobody_pressed_wears_what_a_card_of_its_seed_would(self):
        # Open question 3 of the issue, answered: a piece with no card behind it -- a direct visit to
        # world.html#<seed>, or a world picked at random when the feed's stack has run dry -- is
        # configured from its seed, which is where a card's configuration comes from too. So the
        # address carries the configuration, and nothing has to guess at one. Anything unreadable is
        # rolled from the seed the same way rather than half-believed.
        for case in self.seen["revived"]["cases"]:
            with self.subTest(seed=case["seed"]):
                self.assertEqual(case["fromNothing"], case["rolled"])
                self.assertEqual(case["fromJunk"], case["rolled"])

    def test_no_dial_arrives_outside_its_own_range(self):
        # The ranges every other part of the site assumes -- the contrast guards above, the frame
        # limits below -- hold for a configuration that came over the boundary as well as for one
        # rolled here, because a caller of window.interestingStage.open can pass anything.
        for case in self.seen["revived"]["cases"]:
            clamped = case["clamped"]
            with self.subTest(seed=case["seed"]):
                self.assertFalse(clamped["plain"])
                for name in self.seen["dials"]:
                    low, high = self.seen["ranges"][name]
                    self.assertGreaterEqual(clamped[name], low, f"--{name} arrived under its range")
                    self.assertLessEqual(clamped[name], high, f"--{name} arrived over its range")

    def test_every_world_reads_the_configuration(self):
        # A module that ignored it would still be configured -- its colours and its frame are the
        # feed's to set -- but it would draw the same picture twice at the same size, which is the
        # thing the issue is about. Read off the source as well as measured above, so a module added
        # later is held to it too.
        for module in sorted(self.modules.glob("*.js")):
            with self.subTest(module=module.name):
                self.assertIn("env.variant", module.read_text(),
                              "this world's card does not vary with its configuration")

    # ---- the frame ----

    def test_a_repeat_of_a_world_is_a_different_shape_from_the_first_card_of_it(self):
        # Colour and picture are not the whole of looking different: a repeat is framed differently
        # too, stretched from its world's own aspect ratio and clamped so no card in the masonry
        # becomes a letterbox or a column.
        low, high = self.seen["aspectLimits"]
        for frame in self.seen["frames"]:
            with self.subTest(ratio=frame["ratio"]):
                rolled = frame["rolled"]
                plain = min(max(float(eval_ratio(frame["ratio"])), low), high)
                self.assertGreater(len(set(rolled)), len(rolled) * 0.6, "every repeat is one shape")
                self.assertGreater(max(rolled) - min(rolled), plain * 0.25,
                                   "the frames are all but the same shape")
                for ratio in rolled:
                    self.assertGreaterEqual(ratio, low)
                    self.assertLessEqual(ratio, high)

    def test_an_unreadable_aspect_ratio_is_left_alone_rather_than_guessed_at(self):
        self.assertEqual(self.seen["unreadableFrame"], "not a ratio")

    def test_the_light_on_a_card_moves_with_the_configuration(self):
        # The one part of the configuration _sass/_feed.scss reads directly: where the gradient
        # behind a card's picture opens from.
        lights = self.seen["lights"]
        self.assertGreater(len(set(lights)), len(lights) * 0.6)
        for light in lights:
            self.assertRegex(light, r"^\d{1,3}% \d{1,3}%$")


class EngagementTimeTest(unittest.TestCase):
    """Issue #32: "interesting" is not left to a model's taste. It means user engagement time, and
    the prompt says so, because a run cannot aim at a standard it has not been told."""

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_definition_is_the_mission_statement(self):
        # Spelled out here rather than imported, so rewording INTERESTING into something that no
        # longer names engagement time fails this test instead of passing quietly.
        self.assertIn("how long a person stays engaged", mi.INTERESTING)
        self.assertIn("want to keep going", mi.INTERESTING)
        for word in ["intrigued", "astonished", "entertained"]:
            with self.subTest(word=word):
                self.assertIn(word, mi.INTERESTING)

    def test_the_prompt_says_what_interesting_means_before_asking_for_it(self):
        prompt = self.prompt()
        self.assertIn(mi.INTERESTING, prompt)
        self.assertIn("User engagement time is the measure", prompt)
        # Before the first "Rules:", so a run reads the standard while it is still deciding what to
        # do rather than as a constraint on a change it has already chosen.
        self.assertLess(prompt.index(mi.INTERESTING), prompt.index("Rules:"))

    def test_the_definition_is_repeated_where_the_run_is_asked_to_choose(self):
        # The mission is stated twice -- once up front, once at the end of the site dump, which is
        # the last thing the model reads before answering. Both carry the measure now.
        prompt = self.prompt()
        self.assertIn(f"This run's mission: {mi.mission_of(mi.Run(mi.DEFAULT_MODE))}, measured in {mi.INTERESTING}", prompt)

    def test_the_prompt_prefers_engagement_to_tidiness(self):
        # The point of naming the measure: a run that only makes the site look neat has not earned
        # its hour, and coherence is worth doing because it keeps a visitor exploring.
        prompt = self.prompt()
        for asked in ["gives a visitor a reason to stay and keep going",
                      "not by whether it looks tidy or busy",
                      "a site that holds together is one a visitor keeps exploring"]:
            with self.subTest(asked=asked):
                self.assertIn(asked, prompt)


class LegibilityStandardTest(unittest.TestCase):
    """Issue #46 and the usability work of 2026-10-05: the site is legible to a stranger, and a
    blocked component presents its own unlock. Both are standards stated to the model, like WHOLE
    and INTERESTING, because no check could judge whether a page reads clearly or whether a dead
    end is a deliberate one -- so the tests hold the prompt, not the site."""

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_standard_names_the_stranger_and_the_four_questions(self):
        # Spelled out here rather than imported, so rewording LEGIBLE into something that no longer
        # puts a first-time visitor's questions first fails this test instead of passing quietly.
        self.assertIn("first-time visitor on a phone", mi.LEGIBLE)
        for question in ["what the site is", "what any page is for", "what to do on it",
                         "where to go next"]:
            with self.subTest(question=question):
                self.assertIn(question, mi.LEGIBLE)

    def test_the_standard_is_stated_before_the_rules_and_after_the_choice(self):
        prompt = self.prompt()
        self.assertIn("LEGIBLE TO A STRANGER", prompt)
        self.assertIn(mi.LEGIBLE, prompt)
        self.assertLess(prompt.index("THIS RUN "), prompt.index("LEGIBLE TO A STRANGER"))
        self.assertLess(prompt.index("LEGIBLE TO A STRANGER"), prompt.index("Rules:"))

    def test_the_six_holds_are_each_named(self):
        prompt = self.prompt()
        for hold in ["One name per page", "One sentence of plain purpose", "One way to do each thing",
                     "Content first, chrome small", "never about the machinery", "Never a dead end"]:
            with self.subTest(hold=hold):
                self.assertIn(hold, prompt)
        # The shell is named as the thing a page may not add to, and the one list of pages is named.
        self.assertIn("the header, the persona card and the index of every world", prompt)
        self.assertIn("_data/worlds.json", prompt)

    def test_a_blocked_component_presents_its_own_unlock(self):
        # Issue #46: the component powers itself up in place, never sends the visitor elsewhere,
        # and the prompt names the shared helper a run uses for it.
        prompt = self.prompt()
        self.assertIn("POWERED DOWN, NEVER BROKEN", prompt)
        self.assertIn("window.interestingSite.unlock(host, { onReady })", prompt)
        self.assertIn('Never "make one on the wish constellation page first"', prompt)
        self.assertIn('never "refresh after creating"', prompt)
        self.assertIn("writing to the shared state exactly as the visitor's own action would", prompt)
        self.assertIn("a browser that stores nothing still gets the button", prompt)

    def test_the_standard_is_in_hand_at_the_end_of_the_run_too(self):
        prompt = self.prompt()
        last = prompt[prompt.index(f"This run's mission: {mi.mission_of(mi.Run(mi.DEFAULT_MODE))}"):]
        self.assertIn(f"Keep it {mi.LEGIBLE}", last)
        self.assertIn("never a dead end", last)

    def test_the_standard_is_stated_and_not_a_check(self):
        # The same reasoning WHOLE and INTERESTING are left uncoded for: legibility is not among
        # the coded axioms (issue #46, question 1). Issue #42's destructive caution is, which is
        # what distinguishes a standard no check could judge from a law that can be held.
        self.assertEqual(sorted(name for name in dir(mi) if name.startswith("check_")),
                         CODED_AXIOMS)
        self.assertNotIn("check_legible", CODED_AXIOMS)


class CadenceAxiomTest(SiteDirTestCase):
    """Issue #32: no page ties the site to an update frequency. The site iterates continuously, so
    the fourth axiom stands beside the other three -- stated in the prompt, held to by
    validate_plan -- and copy that defers a visitor to another day is refused with it, because
    engagement time is the measure."""

    PAGES = ["index.html", "error.html", "toy.html"]

    def wired_site(self):
        """A site that satisfies reachability, so only the cadence check can refuse a plan here."""
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        (self.site / "toy.html").write_text("<p>toy</p>")
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def phrases(self, content, **assets):
        return mi.cadence_phrases("p.html", dict({"p.html": content}, **assets))

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        rules = prompt[prompt.index("Rules:"):]
        for rule in ["AXIOM, every run: nothing on the site is tied to an update frequency",
                     "iterates continuously",
                     "Tonight's experiment",
                     "rewritten every hour",
                     "Never defer a visitor to another day",
                     "engagement time is the measure",
                     "tonight, tomorrow, yesterday, hourly, nightly, daily",
                     "today's, this hour's, this week's and this month's",
                     "Night-sky atmosphere is untouched and welcome",
                     "adds one of the refused phrasings to a page is refused"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_the_prompt_names_every_phrasing_the_code_refuses(self):
        # A rule a run can follow rather than a trap it springs: anything check_cadence would refuse
        # is spelled out in the prompt first, so the list and the regex cannot drift apart.
        rules = mi.build_prompt([("index.html", "<h1>hi</h1>")]).lower()
        for refused in ["tonight", "tomorrow", "yesterday", "hourly", "nightly", "daily", "weekly",
                        "today's", "this hour's", "this week's", "this month's",
                        "every hour", "each day", "once a week"]:
            with self.subTest(refused=refused):
                self.assertIn(refused, rules)

    def test_copy_that_dates_the_site_is_found(self):
        for content, phrase in [
            ("<p class='story'>Tonight's experiment: a wish constellation.</p>", "tonight"),
            ("<p>This site is rewritten every hour by a model.</p>", "every hour"),
            ("<p>Read today's sky.</p>", "today's"),
            ("<p>A new toy each night.</p>", "each night"),
            ("<p>The nightly experiment.</p>", "nightly"),
            ("<p>Rebuilt once a day.</p>", "once a day"),
            ("<p>This week's theme is copper.</p>", "this week's"),
        ]:
            with self.subTest(phrase=phrase):
                self.assertEqual(self.phrases(content), [phrase])

    def test_a_possessive_counts_however_its_apostrophe_is_written(self):
        # "today&rsquo;s sky" promises a schedule as plainly as "today's sky" does, and the bare
        # words would not catch either, so every apostrophe a page might be written with counts.
        for mark in ["'", "’", "&rsquo;", "&apos;", "&#39;", "&#8217;"]:
            with self.subTest(mark=mark):
                self.assertEqual(self.phrases(f"<p>Read today{mark}s sky.</p>"), [f"today{mark}s"])
        self.assertEqual(self.phrases("<p>Read the sky today.</p>"), [])

    def test_copy_that_defers_the_visitor_is_found(self):
        # The second half of the axiom, and the reason it is one: sending someone away until
        # tomorrow spends the engagement time the whole mission is measured in.
        self.assertEqual(self.phrases("<p>Move one star tomorrow and ask again.</p>"), ["tomorrow"])
        self.assertEqual(self.phrases("<p>Move one star and ask again.</p>"), [])

    def test_night_sky_atmosphere_is_left_alone(self):
        # Open question 2 of the issue: only copy that puts the site on a schedule counts. The whole
        # site is night-sky themed, and a check that read "midnight" as a cadence would make the
        # theme unwritable -- these are the phrasings /site actually uses.
        for kept in ["<p>toggle midnight rain</p>",
                     "<p>Returning to midnight tones.</p>",
                     "<p>midnight horticulture note:</p>",
                     "<p>night acoustics memo:</p>",
                     "<p>Kindle one idea before midnight.</p>",
                     "<p>The hour dial reads 23.</p>",
                     "<p>Dusk, dawn and starlight.</p>",
                     "<script>var tonightly = 1; var hour = 3;</script>"]:
            with self.subTest(kept=kept):
                self.assertEqual(self.phrases(kept), [])

    def test_copy_inside_a_script_counts(self):
        # Most of this site's prose lives in the JavaScript that draws the page -- the oracle
        # readings, the storage-failure notes -- so a check that only read markup would have missed
        # every instance issue #32 names but one.
        self.assertEqual(
            self.phrases("<script>setNote('Constellation data was unreadable, so tonight starts "
                         "fresh.');</script>"),
            ["tonight"])

    def test_copy_federated_into_a_shared_script_or_stylesheet_counts(self):
        # A run is invited to lift shared copy into js/site.js, so the check follows a page into its
        # assets exactly as the accessibility check does. Otherwise federating the phrase out of the
        # page would be a way of keeping it.
        page_html = "<head><link rel='stylesheet' href='css/site.css'>" \
                    "<script src='js/site.js'></script></head><body><p>a sky</p></body>"
        self.assertEqual(
            self.phrases(page_html, **{"js/site.js": "var reading = 'Tonight favors action.';",
                                       "css/site.css": "/* a stylesheet */"}),
            ["tonight"])
        self.assertEqual(
            self.phrases(page_html, **{"js/site.js": "var reading = 'This sky favors action.';",
                                       "css/site.css": "/* rebuilt hourly */"}),
            ["hourly"])

    def test_the_files_behind_the_analytics_tag_are_not_policed(self):
        # They are never a model's to write, so a phrase in one could not be a run's fault, and 55
        # KB of vendored consent library is not this repository's prose to police: a future version
        # of it saying "daily" in a comment must not fail every page of the site at once.
        page_html = f"<head><script src='{mi.ANALYTICS_SCRIPT}'></script></head><body><p>a</p></body>"
        self.assertEqual(self.phrases(page_html, **{mi.ANALYTICS_SCRIPT: "/* rebuilt hourly */"}), [])

    def test_a_page_a_run_adds_may_not_date_the_site(self):
        self.wired_site()
        dated = page(title="new", body="<p>Tonight's experiment: a new toy.</p>")
        plan = {"files": [
            {"path": "new.html", "content": dated},
            {"path": "index.html", "content": home("toy.html", "error.html", "new.html")},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r'new\.html says "tonight"'):
            mi.validate_plan(plan)
        plan["files"][0]["content"] = page(title="new", body="<p>A new toy.</p>")
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_putting_cadence_copy_back_into_a_page_a_run_rewrites_is_refused(self):
        self.wired_site()
        with self.assertRaisesRegex(mi.RejectedChange, r'toy\.html says "every hour"'):
            mi.validate_plan({"files": [{"path": "toy.html",
                                         "content": "<p>Rewritten every hour.</p>"}]})

    def test_a_phrase_a_page_already_carried_blocks_nothing(self):
        # The same bargain the three other axioms make: a page that already dates itself stays the
        # site's own to clear away, because refusing every plan over it would leave no plan able to.
        self.wired_site()
        (self.site / "toy.html").write_text("<p>Tonight's experiment, with a typo.</p>")
        self.assertEqual(mi.pages_dating_the_site(dict(mi.read_site())), {"toy.html": ["tonight"]})
        ops = mi.validate_plan({"files": [{"path": "toy.html",
                                           "content": "<p>Tonight's experiment, no typo.</p>"}]})
        self.assertEqual(len(ops), 1)

    def test_clearing_one_phrase_is_never_mistaken_for_adding_another(self):
        # Each reason is one phrase, so a partial clean-up can only take reasons away -- the same
        # property that makes the accessibility reasons repairable.
        self.wired_site()
        (self.site / "toy.html").write_text("<p>Tonight, or tomorrow, a daily toy.</p>")
        self.assertEqual(mi.pages_dating_the_site(dict(mi.read_site())),
                         {"toy.html": ["daily", "tomorrow", "tonight"]})
        half = {"files": [{"path": "toy.html", "content": "<p>Tonight, a toy.</p>"}]}
        self.assertEqual(len(mi.validate_plan(half)), 1)

    def test_retiring_a_dated_page_is_fine(self):
        self.wired_site()
        (self.site / "old.html").write_text("<p>Tonight's experiment.</p>")
        self.assertEqual(len(mi.validate_plan({"delete": ["old.html"]})), 1)


class MoodAxiomTest(SiteDirTestCase):
    """Issue #30: the site asks before it offers.

    Not everyone likes stars, and the target of interest is the whole population, so no page may
    put particular content in front of a visitor on the assumption that they want it. The fifth
    axiom stands beside the other four -- stated in the prompt, held to by validate_plan -- and
    what code can settle about it is three things: that every page carries the flow, that the
    library of ways to ask does not collapse, and that no page ever asks a visitor to report their
    own mood.
    """

    PAGES = ["index.html", "error.html", "toy.html"]
    MECHANISMS = ["doorway", "pocket", "window", "stone", "misfit", "stair", "tempo", "hold",
                  "placement", "dial"]

    def setUp(self):
        super().setUp()
        (self.site / "js").mkdir()
        (self.site / mi.MOOD_SCRIPT).write_text(mood_script(*self.MECHANISMS))
        (self.site / "index.html").write_text(queried(home("toy.html", "error.html")))
        (self.site / "error.html").write_text(queried("<p>404</p>"))
        (self.site / "toy.html").write_text(queried("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def rules(self):
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        return prompt[prompt.index("Rules:"):]

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.rules()
        for rule in ["AXIOM, every run: the site asks before it offers",
                     "The whole population is the target of interest",
                     "ascertain their mood or mental orientation",
                     mi.MOOD_TAG,
                     "Keep that line on every page you rewrite",
                     "Query, never self-report",
                     "Never the same way twice",
                     "Never a gate",
                     "do not hide a world behind an answer"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_the_prompt_names_every_phrasing_the_code_refuses(self):
        # The same bargain the cadence axiom makes: a rule a run can follow rather than a trap it
        # springs, so anything check_mood would refuse is spelled out in the prompt first.
        rules = self.rules().lower()
        for refused in ["how are you feeling", "how do you feel", "how are you doing",
                        "what's your mood", "pick your mood", "rate your energy",
                        "describe your feelings"]:
            with self.subTest(refused=refused):
                self.assertIn(refused, rules)
                self.assertRegex(refused, mi.SELF_REPORT_COPY,
                                 "the prompt names a phrasing the code does not actually refuse")

    def test_the_prompt_asks_for_more_mechanisms_and_more_worlds(self):
        # Open question 1 and 3 of the issue: inventing new ways of asking is meant to be part of
        # the site's ongoing interesting-ness, so the prompt has to invite it where a run chooses
        # what to do, not only forbid the collapse of what is there.
        # Each invitation lives in the mode whose run it is (MarbleBagTest): a new mechanism is a
        # change to the framework, and a new world is the creating run's.
        self.assertIn("a new way of querying a visitor's orientation",
                      mi.build_prompt([("index.html", "<h1>hi</h1>")], (), mi.Run("enhance_overall")))
        self.assertIn("a world for an orientation that has none",
                      mi.build_prompt([("index.html", "<h1>hi</h1>")], (), mi.Run("create_item")))
        for mode in mi.MODES:
            with self.subTest(mode=mode):
                prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")], (), mi.Run(mode))
                self.assertIn(f"at least {mi.MIN_MOOD_PROBES} distinct query mechanisms", prompt)
                self.assertIn("probe: 'some-id'", prompt)

    def test_a_page_a_run_adds_must_carry_the_flow(self):
        # A whole page but for the one line, so the mood axiom is the only thing left to refuse it.
        plan = {"files": [
            {"path": "new.html", "content": page(title="new", mood="")},
            {"path": "index.html", "content": queried(home("toy.html", "error.html", "new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html has no <script"):
            mi.validate_plan(plan)
        plan["files"][0]["content"] = page(title="new")
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_dropping_the_flow_from_a_page_a_run_rewrites_is_refused(self):
        with self.assertRaisesRegex(mi.RejectedChange, r"toy\.html has no <script"):
            mi.validate_plan({"files": [{"path": "toy.html", "content": "<p>no query at all</p>"}]})
        # It is the src that counts, not the exact spelling of the tag around it.
        loaded = '<head><script defer src="js/threshold.js"></script></head>'
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": loaded}]})), 1)

    def test_a_page_that_was_already_without_it_blocks_nothing(self):
        # Only what the run itself breaks is refused, as with the five axioms above.
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": queried("<p>still asked</p>")}]})
        self.assertEqual(len(ops), 1)
        self.assertEqual(mi.pages_missing_mood(dict(mi.read_site())), {"index.html"})

    def test_the_shared_script_may_be_rewritten_but_never_deleted(self):
        # The opposite arrangement to the analytics files: this one is the model's to extend, which
        # is where new mechanisms come from, but every page leans on it, so it cannot be removed.
        self.assertIn(mi.MOOD_SCRIPT, mi.PROTECTED_FILES)
        self.assertNotIn(mi.MOOD_SCRIPT, mi.FIXED_FILES)
        for plan in [{"delete": [mi.MOOD_SCRIPT]}, {"delete": [f"site/{mi.MOOD_SCRIPT}"]},
                     {"files": [{"path": mi.MOOD_SCRIPT, "content": "   "}]}]:
            with self.subTest(plan=str(plan)[:70]), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)
        grown = mood_script(*self.MECHANISMS, "volley", "stroke")
        self.assertEqual(len(mi.validate_plan({"files": [{"path": mi.MOOD_SCRIPT, "content": grown}]})), 1)

    def test_the_shared_script_is_shown_to_the_model_before_any_ordinary_file(self):
        (self.site / "zz-big.js").write_text("y" * mi.PROMPT_BUDGET_CHARS)  # fits only on its own
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual([rel for rel, _ in shown][:4],
                         ["index.html", "error.html", mi.MOOD_SCRIPT, "sitemap.xml"])
        self.assertEqual(omitted, ["zz-big.js"])

    def test_mechanisms_are_counted_from_the_sites_own_source(self):
        site = dict(mi.read_site())
        self.assertEqual(mi.probe_mechanisms(site), set(self.MECHANISMS))
        # Wherever a run chooses to keep them: a page's own script counts as readily as the shared
        # one, and a declaration without quotes around the id is a reference, not a declaration.
        site["toy.html"] = queried("<script>var one = { probe: 'kettle' }; var two = probe;</script>")
        self.assertEqual(mi.probe_mechanisms(site), set(self.MECHANISMS) | {"kettle"})

    def test_letting_the_library_collapse_is_refused(self):
        thin = mood_script("doorway", "pocket")
        with self.assertRaisesRegex(mi.RejectedChange, "at least 8 ways of querying"):
            mi.validate_plan({"files": [{"path": mi.MOOD_SCRIPT, "content": thin}]})

    def test_swapping_one_mechanism_for_another_is_fine(self):
        # Retiring a question that is not working is allowed; emptying the drawer is not.
        swapped = mood_script(*self.MECHANISMS[:-1], "volley")
        ops = mi.validate_plan({"files": [{"path": mi.MOOD_SCRIPT, "content": swapped}]})
        self.assertEqual(len(ops), 1)

    def test_a_site_that_never_had_a_library_blocks_nothing(self):
        # The floor is a floor, not a ratchet: a site below it already stays the site's own to
        # repair, exactly as a page that already falls short of the other axioms does.
        (self.site / mi.MOOD_SCRIPT).write_text(mood_script("doorway"))
        ops = mi.validate_plan({"files": [{"path": mi.MOOD_SCRIPT, "content": mood_script("pocket")}]})
        self.assertEqual(len(ops), 1)

    def test_asking_a_visitor_to_report_their_own_mood_is_refused(self):
        for asked in ["<p>How are you feeling today?</p>",
                      "<p>What's your mood?</p>",
                      "<p>What&rsquo;s your vibe?</p>",
                      "<p>Pick your mood from the list.</p>",
                      "<p>Rate your energy, 1 to 5.</p>",
                      "<script>var ask = 'Describe your feelings';</script>"]:
            with self.subTest(asked=asked[:40]), self.assertRaisesRegex(mi.RejectedChange,
                                                                       "report their own mood"):
                mi.validate_plan({"files": [{"path": "toy.html", "content": queried(asked)}]})

    def test_asking_sideways_is_exactly_what_the_axiom_wants(self):
        sideways = ("<p>Four doors, all unlocked. Pick the one with a draught under it.</p>"
                    "<p>Tap this five times, at whatever rate feels like the rate.</p>")
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": queried(sideways)}]})), 1)

    def test_prose_about_the_method_is_not_a_question(self):
        # The page may say what it does not do. The check is narrow enough to let it.
        about = "<p>This site never asks you how you feel. It asks about a stone instead.</p>"
        self.assertEqual(mi.pages_asking_to_self_report({"p.html": about}), {})

    def test_a_question_federated_into_a_shared_script_counts(self):
        # The same reasoning as cadence_phrases: most of this site's questions live in the script
        # that draws the page, so copy that moved there must not slip the check.
        site = {"p.html": "<head><script src='js/ask.js'></script></head>",
                "js/ask.js": "var q = 'How do you feel?';"}
        self.assertEqual(mi.pages_asking_to_self_report(site), {"p.html": ["how do you feel"]})

    def test_a_question_a_page_already_carried_blocks_nothing(self):
        (self.site / "toy.html").write_text(queried("<p>How do you feel?</p>"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": queried("<p>How do you feel? Still.</p>")}]})
        self.assertEqual(len(ops), 1)

    def test_retiring_a_page_that_asked_outright_is_fine(self):
        (self.site / "old.html").write_text(queried("<p>What is your mood?</p>"))
        self.assertEqual(len(mi.validate_plan({"delete": ["old.html"]})), 1)


class ParticipationAxiomTest(SiteDirTestCase):
    """Issue #43: every page carries a visitor's way of steering the site -- one link to a
    pre-shaped new issue on this repository, which the shared shell offers in the constellation the
    sparkles logo opens (issue #64).

    The seventh axiom, and the one that is about the person reading the site rather than about the
    site: a site rewritten continuously by a model is steered by whoever can reach the model, so
    the standing channel back from a visitor is held in place by exactly the machinery the
    analytics tag and the local-state store use -- the line is required on every page, and the file
    behind it is fixed."""

    PAGES = ["index.html", "error.html", "toy.html"]

    def setUp(self):
        super().setUp()
        (self.site / "js").mkdir()
        (self.site / mi.PARTICIPATE_SCRIPT).write_text("/* the button that opens a new issue */")
        (self.site / "index.html").write_text(steered(home("toy.html", "error.html")))
        (self.site / "error.html").write_text(steered("<p>404</p>"))
        (self.site / "toy.html").write_text(steered("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def prompt(self):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")])

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.prompt()
        rules = rules[rules.index("Rules:"):]
        for rule in ["every page carries a visitor's way of steering this site",
                     mi.PARTICIPATE_TAG,
                     "Keep that line on every page you rewrite",
                     "put it on every page you add",
                     f"../{mi.PARTICIPATE_SCRIPT}",  # a page in a sub-folder
                     "a new issue on this repository",
                     "is not shown to you, you may not write or delete it",
                     "answers to the person reading it rather than to you",
                     "A plan that leaves a page of the site without the line is refused"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_the_prompt_leaves_the_cadre_and_every_edge_of_the_viewport_alone(self):
        # The three are a cadre of their own -- each injects its own styles, none is a page's to
        # restyle -- so a run has to be told what they are as well as that they exist. The header's
        # pulse once arrived as <p class='site-meta'> and was torn out of the header by the state
        # menu's own `position: fixed`; this is the half of that lesson the prompt can carry.
        rules = self.prompt()
        for where in ["this \"steer the site\" link, the consent banner's \"cookies\" button "
                      "and the local-state \"state\" menu",
                      "pin nothing of yours to an edge of the viewport",
                      "Nothing of yours restyles them, reproduces them or "
                      "rewords them",
                      "The words on those three options are the shell's own and are already "
                      "written"]:
            with self.subTest(where=where):
                self.assertIn(where, rules)

    def test_the_prompt_says_how_all_three_of_them_reach_the_main_nav(self):
        # Issue #54 pulled "cookies" and "state" into the logo's constellation and issue #64 the
        # invitation with them, which a run has to know two things about: the shell adopts what
        # those fixed files drew rather than copying it, and so a second control of any of the
        # three is never the thing to add. The two-item rule is stated here as well, because this
        # is the axiom whose own affordance used to be the exception to it.
        rules = self.prompt()
        for rule in ["adopts all three into the main nav rather than copying",
                     "hides the control that js/participate.js, js/analytics.js and js/state.js "
                     "each pinned over the page",
                     "never draw a second new-issue, cookies or state control of your own",
                     "the only things floating over a page are the sparkles logo in the top left "
                     "and the persona in the top right",
                     "nothing floats at the bottom edge"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_a_page_a_run_adds_must_carry_the_line(self):
        # A whole page but for the one line, so this axiom is the only thing left to refuse it for.
        plan = {"files": [
            {"path": "new.html", "content": page(title="new", participate="")},
            {"path": "index.html", "content": steered(home("toy.html", "error.html", "new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html has no <script"):
            mi.validate_plan(plan)
        plan["files"][0]["content"] = page(title="new")
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_dropping_the_line_from_a_page_a_run_rewrites_is_refused(self):
        for content in ["<p>no line at all</p>",
                        "<head><script>var WAY_IN = 'js/participate.js';</script></head>"]:
            with self.subTest(content=content[:40]), \
                    self.assertRaisesRegex(mi.RejectedChange, r"toy\.html has no <script"):
                mi.validate_plan({"files": [{"path": "toy.html", "content": content}]})
        # It is the src that counts, not the exact spelling of the tag around it.
        loaded = '<head><script src="js/participate.js" defer></script></head>'
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": loaded}]})), 1)

    def test_a_page_in_a_sub_folder_loads_it_by_a_relative_src(self):
        plan = {"files": [
            {"path": "deep/new.html", "content": page(title="new", participate=f"../{mi.PARTICIPATE_SCRIPT}")},
            {"path": "index.html", "content": steered(home("toy.html", "error.html", "deep/new.html"))},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "deep/new.html")},
        ]}
        self.assertEqual(len(mi.validate_plan(plan)), 3)

    def test_a_page_that_was_already_missing_the_line_blocks_nothing(self):
        # Only what the run itself breaks is refused, as with the six axioms before it.
        (self.site / "index.html").write_text(home("toy.html", "error.html"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": steered("<p>still has it</p>")}]})
        self.assertEqual(len(ops), 1)
        self.assertEqual(mi.pages_missing_participate(dict(mi.read_site())), {"index.html"})

    def test_a_site_without_the_way_in_is_not_held_to_the_axiom(self):
        # Refusing every plan until someone put the file back would leave no plan able to.
        (self.site / mi.PARTICIPATE_SCRIPT).unlink()
        self.assertEqual(mi.pages_missing_participate(dict(mi.read_site())), set())
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "toy.html", "content": "<p>bare</p>"}]})), 1)

    def test_the_way_in_can_neither_be_rewritten_nor_deleted(self):
        # The whole point of the issue: an hourly rewrite cannot quietly reword, move or remove a
        # visitor's way of saying what this site should become.
        self.assertIn(mi.PARTICIPATE_SCRIPT, mi.FIXED_FILES)
        for plan in [{"files": [{"path": mi.PARTICIPATE_SCRIPT, "content": "a quieter invitation"}]},
                     {"delete": [mi.PARTICIPATE_SCRIPT]},
                     {"delete": [f"site/{mi.PARTICIPATE_SCRIPT}"]}]:
            with self.subTest(plan=str(plan)[:80]), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)

    def test_the_way_in_is_never_shown_to_a_model(self):
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertNotIn(mi.PARTICIPATE_SCRIPT, [rel for rel, _ in shown])
        self.assertIn(mi.PARTICIPATE_SCRIPT, omitted)
        self.assertNotIn("the button that opens a new issue", mi.build_prompt(shown, omitted))


class ParticipateButtonTest(unittest.TestCase):
    """What site/js/participate.js actually draws, run against a stub browser.

    The one affordance on this site that answers to the person reading it rather than to the model
    writing it, and the one no run may rewrite, so -- like the local-state store beside it -- it is
    worth testing rather than only holding in place. participate_harness.mjs loads the real file,
    drives it through a scenario each, and reports what it saw; the assertions are here.
    """

    NEW_ISSUE = "https://github.com/outrightmental/interesting/issues/new"
    FORM = "steer-the-site.yml"
    LABEL = "steer the site"

    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        cls.harness = Path(mi.__file__).resolve().parent / "participate_harness.mjs"
        cls.script = cls.repo / "site" / mi.PARTICIPATE_SCRIPT
        cls.observed = None

    def setUp(self):
        if not self.script.is_file():
            self.skipTest(f"no participation script at {self.script}")
        needs_node(self)
        if ParticipateButtonTest.observed is None:
            run = subprocess.run([mi.NODE_BIN, str(self.harness), str(self.script)],
                                 capture_output=True, text=True, timeout=60)
            self.assertEqual(run.returncode, 0, f"the harness failed: {run.stderr[-2000:]}")
            ParticipateButtonTest.observed = json.loads(run.stdout)
        self.seen = ParticipateButtonTest.observed

    def test_one_named_link_per_page_and_nothing_else(self):
        drawn = self.seen["onAPage"]
        self.assertEqual(drawn["affordances"], 1, "one button, and nothing else added to the page")
        self.assertEqual(drawn["tag"], "a", "a link to a page, not a button that does something")
        self.assertEqual(drawn["className"], "site-steer")
        self.assertEqual(drawn["text"], self.LABEL)
        # WCAG 4.1.2 and 2.4.4: it says where it goes. WCAG 2.5.3 Label in Name: the words a
        # visitor sees are inside the name a screen reader says, so "steer the site" reaches both.
        self.assertIn(self.LABEL, drawn["label"].lower())
        self.assertIn("GitHub", drawn["label"])
        self.assertIn("new tab", drawn["label"])

    def test_the_link_opens_the_repositorys_own_issue_form(self):
        # "The most excellent possible templating from there": the destination arrives already
        # shaped, so a visitor has as little as possible to invent.
        href = self.seen["onAPage"]["href"]
        self.assertTrue(href.startswith(self.NEW_ISSUE + "?"), href)
        self.assertIn(f"template={self.FORM}", href)
        # A new tab, because engagement time is the measure: filing an issue does not end the visit.
        self.assertEqual(self.seen["onAPage"]["target"], "_blank")
        self.assertEqual(self.seen["onAPage"]["rel"], "noopener noreferrer")

    def test_the_page_the_visitor_was_on_travels_and_nothing_else_does(self):
        # The site's bargain is that what it keeps stays in the visitor's own browser and is sent
        # nowhere, and a new-issue URL is a public page: the page name is about the site rather than
        # about the person, and it is the whole of what goes.
        href = self.seen["onAPage"]["href"]
        query = sorted(part.split("=", 1)[0] for part in href.split("?", 1)[1].split("&"))
        self.assertEqual(query, ["template", "where"])
        self.assertIn("where=quiet-room.html", href)

    def test_the_shell_is_not_the_only_way_it_knows_which_page_it_is_on(self):
        # The shared shell writes data-page onto <html>, and the shell is a file a run may rewrite,
        # so the browser's own path is read when that attribute has gone. A copy of the site served
        # under a sub-path still names the page rather than the path.
        told = self.seen["withoutTheShellsHint"]
        self.assertIn("where=sky-archive.html", told["plain"])
        self.assertIn("where=loam.html", told["underASubPath"])
        self.assertIn("where=word-kiln.html", told["trailingName"])

    def test_a_page_name_that_is_not_one_is_left_out_rather_than_guessed(self):
        # Whatever a path turns out to hold cannot be carried into an issue: the link still works,
        # it just says nothing about where the visitor was.
        for name, href in sorted(self.seen["whenThePageCannotBeTold"].items()):
            with self.subTest(name=name):
                self.assertEqual(href, f"{self.NEW_ISSUE}?template={self.FORM}")

    def test_it_waits_for_the_body_rather_than_dropping_the_affordance(self):
        # Deferred scripts run after the body is parsed, but the axiom is about every page however
        # it is loaded, so a page that has no body yet gets the button when it has one.
        early, then = self.seen["beforeTheBody"]["early"], self.seen["beforeTheBody"]["then"]
        self.assertEqual(early["listeners"], ["DOMContentLoaded"])
        self.assertEqual(early["styles"], 0, "nothing is injected until there is a page to put it on")
        self.assertEqual(then["affordances"], 1)
        self.assertIn("where=index.html", then["href"])

    def test_it_carries_its_own_focus_ring_and_tap_target(self):
        # The same reasoning the state menu's styles are its own for: several pages of this site
        # take the browser's focus ring off their controls, and this must stay usable by keyboard
        # whatever a page has done to its own.
        styles = self.seen["onAPage"]["styles"]
        self.assertIn(".site-steer:focus-visible", styles)
        self.assertIn("outline: 2px solid", styles)
        self.assertNotIn("outline: none", styles)
        self.assertIn("min-height: 44px", styles)  # WCAG 2.5.8 Target Size
        self.assertNotRegex(styles, r"(?<![\w-])(?:animation|transition)(?:-[a-z]+)?\s*:",
                            "nothing here moves, so there is nothing to answer for")

    def test_it_leaves_the_two_corners_to_their_own_affordances(self):
        # Three affordances are pinned to the bottom edge of every page: "cookies" bottom-left,
        # this one in the middle, "state" bottom-right. The middle one reserves the corners rather
        # than trusting a wide screen, so the three never meet on a 320px phone.
        styles = self.seen["onAPage"]["styles"]
        self.assertIn("position: fixed", styles)
        self.assertIn("left: 50%", styles)
        self.assertIn("max-width: calc(100vw - 9.5rem)", styles)

    def test_the_icon_says_the_verb_and_is_not_read_out_twice(self):
        # "A prominent INPUT-verb-indicating icon": a speech balloon with a plus in it, drawn beside
        # the words rather than instead of them, and hidden from the name the link already has.
        drawn = self.seen["onAPage"]
        self.assertEqual(drawn["iconHidden"], "true")
        self.assertIn("<svg", drawn["iconMarkup"])
        self.assertIn('aria-hidden="true"', drawn["iconMarkup"])
        self.assertIn('focusable="false"', drawn["iconMarkup"])
        self.assertIn("currentColor", drawn["iconMarkup"], "the icon takes the label's colour")

    def test_nothing_of_the_visitors_own_can_travel(self):
        # Read of the file itself, because the strongest statement here is about what is absent: it
        # reaches for no stored value, so there is nothing of a visitor's for it to put in a URL.
        source = self.script.read_text()
        for reach in ["interestingState", "localStorage", "sessionStorage", "document.cookie",
                      "fetch(", "XMLHttpRequest"]:
            with self.subTest(reach=reach):
                self.assertNotIn(reach, source)


class IssueFormTest(unittest.TestCase):
    """The GitHub side of issue #43: what a visitor lands on once they press the button.

    The site's button names one form by file name, so these hold the two halves of that together --
    the form is there, and every field the link fills is a field of it.
    """

    FORMS = ".github/ISSUE_TEMPLATE"

    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        cls.dir = cls.repo / ".github" / "ISSUE_TEMPLATE"
        cls.script = (cls.repo / "site" / mi.PARTICIPATE_SCRIPT).read_text()

    def setUp(self):
        if not self.dir.is_dir():
            self.fail(f"no issue templates at {self.dir}: the button has nowhere excellent to land")

    def form(self, name):
        path = self.dir / name
        self.assertTrue(path.is_file(), f"{name} is missing, and the site's button names it")
        return path.read_text()

    def test_the_form_the_site_links_to_exists(self):
        # The one coupling between the two halves: site/js/participate.js names the file, and the
        # file is fixed, so a rename has to be made in both places by hand.
        named = re.search(r"TEMPLATE\s*=\s*'([^']+)'", self.script)
        self.assertIsNotNone(named, "the script no longer names an issue form")
        self.assertTrue((self.dir / named[1]).is_file(),
                        f"the button opens {named[1]}, which is not in {self.FORMS}")

    def test_every_field_the_link_fills_is_a_field_of_that_form(self):
        # A new-issue link fills a form's fields by id, and a name that is not a field of the form
        # is simply dropped -- so the context a visitor is spared typing would vanish silently.
        form = self.form("steer-the-site.yml")
        field = re.search(r"WHERE_FIELD\s*=\s*'([^']+)'", self.script)
        self.assertIsNotNone(field, "the script no longer names the field it fills")
        self.assertRegex(form, rf"(?m)^\s+id:[ \t]*{re.escape(field[1])}[ \t]*$",
                         f"the form has no \"{field[1]}\" field for the link to fill")

    def test_the_form_asks_one_thing_and_shapes_the_rest(self):
        # "Make it EASY to participate": one required box, and everything else there to save the
        # visitor from inventing a shape.
        form = self.form("steer-the-site.yml")
        self.assertRegex(form, r"(?m)^name:[ \t]*Steer the site[ \t]*$")
        self.assertRegex(form, r"(?m)^description:[ \t]*\S")
        self.assertRegex(form, r"(?m)^title:[ \t]*\S")
        self.assertEqual(form.count("required: true"), 1, "exactly one box is required")
        self.assertIn("type: textarea", form)
        self.assertIn("What should the site do, be, or become?", form)

    def test_a_blank_issue_is_still_possible(self):
        # The same bargain the mood axiom makes: the question is an offer and never a gate. A form
        # is here to save someone the trouble of a shape, not to insist on one.
        config = self.form("config.yml")
        self.assertRegex(config, r"(?m)^blank_issues_enabled:[ \t]*true[ \t]*$")

    def test_the_forms_parse_and_declare_what_github_needs(self):
        # A form GitHub cannot parse is silently ignored, which would leave the button landing on a
        # bare box. PyYAML is not in the standard library, so this is the one test that asks for it
        # and skips without it; everything above is read as text and always runs.
        try:
            import yaml
        except ImportError:
            self.skipTest("PyYAML is not installed, so the forms are only checked as text")
        for path in sorted(self.dir.glob("*.yml")):
            with self.subTest(form=path.name):
                parsed = yaml.safe_load(path.read_text())
                self.assertIsInstance(parsed, dict)
                if path.name == "config.yml":
                    self.assertIn("blank_issues_enabled", parsed)
                    continue
                self.assertEqual(sorted(set(parsed) - {"labels", "title", "assignees"}),
                                 ["body", "description", "name"])
                for item in parsed["body"]:
                    self.assertIn(item["type"],
                                  ["markdown", "input", "textarea", "dropdown", "checkboxes"])
                    self.assertIn("attributes", item)
                    if item["type"] != "markdown":
                        self.assertIn("id", item, "a field with no id cannot be filled by a link")
                        self.assertIn("label", item["attributes"])

    def test_the_labels_the_forms_ask_for_are_owned_in_code(self):
        # The repository is repo-as-code (infra/repo.tf), so the labels its forms name are too. A
        # form naming a label the repository lacks is not an error -- GitHub files the issue without
        # it -- so this is about the labels existing on purpose rather than by hand.
        labels = (self.repo / "infra" / "issue-labels.tf").read_text()
        for path in sorted(self.dir.glob("*.yml")):
            for asked in re.findall(r"^labels:\s*\[(.*)\]\s*$", path.read_text(), re.M):
                for label in re.findall(r'"([^"]+)"', asked):
                    with self.subTest(label=label):
                        self.assertRegex(labels, rf'name\s*=\s*"{re.escape(label)}"')


class DestructiveCautionAxiomTest(SiteDirTestCase):
    """Issue #42: caution before a destructive action is a law of the site, not a page's own choice.

    The eighth axiom stands beside the other eight -- stated in the prompt, held to by
    validate_plan -- and it is held in the same shape: one shared component for the whole site, and
    three mechanical refusals. What code can settle is that the component stays, that a control
    whose own words say it throws saved state away reads as a warning button, and that no page
    writes a confirmation of its own.

    What it deliberately cannot settle -- whether a given control is above the threshold, and
    whether a warning button's press really reaches the modal -- is asked for in the prompt and
    left there, the way the mood axiom leaves "is this a good question" there.
    """

    PAGES = ["index.html", "error.html", "toy.html"]

    def setUp(self):
        super().setUp()
        (self.site / "js").mkdir()
        (self.site / "css").mkdir()
        (self.site / mi.DESTRUCTIVE_SCRIPT).write_text(
            "window.interestingSite = { destructive: function () {} };\n")
        (self.site / mi.SHARED_STYLESHEET).write_text("button.warning { color: #ffd4b0; }\n")
        (self.site / "index.html").write_text(self.wired(home("toy.html", "error.html")))
        (self.site / "error.html").write_text(self.wired("<p>404</p>"))
        (self.site / "toy.html").write_text(self.wired("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))

    def wired(self, body):
        """A bare fragment that loads the shared script and stylesheet the component lives in.

        Like tagged() and queried(), it is a fragment, so it falls short of the
        responsive-and-accessible axiom from the start and only check_destructive can refuse a
        fixture built from it.
        """
        return (f"<head><link rel='stylesheet' href='{mi.SHARED_STYLESHEET}'>"
                f"<script src='{mi.DESTRUCTIVE_SCRIPT}'></script></head>\n<body>{body}</body>")

    def added(self, body):
        """A whole page a run may add: it satisfies every other axiom, so only this one can refuse
        it, which is what page() is for everywhere else in these tests."""
        return page(body=body, title="notes")

    def rules(self):
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        return prompt[prompt.index("Rules:"):]

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.rules()
        for rule in ["AXIOM, every run: caution before a destructive action",
                     "a law of the site and not a page's own choice",
                     'reads as a warning button -- class="warning"',
                     'asks "are you sure you want to ______?"',
                     "with the specific thing about to go in the blank",
                     "window.interestingSite.destructive(button, {",
                     mi.DESTRUCTIVE_SCRIPT,
                     mi.SHARED_STYLESHEET,
                     f"{mi.SASS_DIR}/_controls.scss"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)

    def test_the_prompt_says_the_safety_switch_is_the_ui_and_nothing_more(self):
        # The issue's own answers, in as many words: the warning plus the modal *is* the safety
        # switch, and the modal is a plain confirm/cancel. Neither half may grow an extra act.
        rules = self.rules()
        for stated in ["There is no arming step beyond them",
                       "no checkbox, no toggle, no hold-to-arm press",
                       "the modal is a plain confirm/cancel",
                       "never ask a visitor to type a word or press twice"]:
            with self.subTest(stated=stated):
                self.assertIn(stated, rules)

    def test_the_prompt_states_the_threshold_the_caution_begins_at(self):
        # The issue leaves the threshold to the implementation and asks for it to be defined. It is
        # three steps, and the prompt names all three so a run can place a control it writes.
        rules = self.rules()
        self.assertIn("because there is a spectrum of severity", rules)
        for step in ["Above the threshold, and held to both halves",
                     "At the threshold, and held to the modal but not the warning",
                     "Below the threshold, and held to neither"]:
            with self.subTest(step=step):
                self.assertIn(step, rules)
        self.assertIn("window.interestingSite.areYouSure(options)", rules)

    def test_the_prompt_names_every_word_the_code_reads_as_destructive(self):
        # As with the cadence and mood axioms: the family is stated in full, so it is a rule a run
        # can follow rather than a trap it springs -- and the one word that is deliberately not in
        # it is named too, because that is the naming convention the narrowness rests on.
        rules = self.rules()
        for word in ["clear", "forget", "empty", "erase", "wipe", "delete", "discard",
                     "throw away", "throw out"]:
            with self.subTest(word=word):
                self.assertIn(word, rules)
                self.assertTrue(mi.DISCARDS_SAVED_STATE.search(f"{word} the thing"), word)
        self.assertIn('Name a control that takes one item out of a list "remove" instead', rules)
        self.assertIn("window.confirm is refused outright", rules)

    def test_the_words_the_code_reads_as_destructive_are_deliberately_narrow(self):
        # The other side of it, as with "midnight" and the cadence axiom: a control that discards
        # nothing a visitor saved must not be dragged in. These are the real site's own.
        for innocent in ["remove this star", "reset decoder", "sweep the floor", "turn the soil",
                         "regrow terrarium", "seed a small sky", "drop a star", "take one from "
                         "the shelf", "replace mine"]:
            with self.subTest(innocent=innocent):
                self.assertIsNone(mi.DISCARDS_SAVED_STATE.search(innocent))

    def test_a_destructive_control_is_found_and_a_warning_one_is_not(self):
        found = mi.DestructiveControls(
            "<button>clear omens</button>"
            "<button class='pill warning'>empty the kiln</button>"
            "<a class='action' href='x.html'>forget my reading</a>"
            "<a class='action warning' href='y.html'>wipe the slate</a>"
            "<button>remove this star</button>"
            "<a href='z.html'>clear your diary</a>"  # an ordinary link navigates, it does not act
            "<button class='warning'><span>erase</span> everything</button>")
        self.assertEqual(sorted(name for name, _ in found.controls),
                         ["clear omens", "empty the kiln", "erase everything",
                          "forget my reading", "wipe the slate"])
        self.assertEqual(found.bare(), ["clear omens", "forget my reading"])

    def test_a_glyph_with_a_destructive_label_is_not_a_way_round_it(self):
        # A control's own words are its text and whatever names it outright, so a button whose face
        # is a glyph cannot slip past by keeping the words in its aria-label.
        found = mi.DestructiveControls(
            "<button aria-label='clear everything'>&#10005;</button>"
            "<button class='warning' title='wipe the slate'>x</button>"
            "<button aria-label='try the doorway'>try this one</button>")
        self.assertEqual(found.bare(), ["clear everything \u2715"])

    def test_a_control_a_page_builds_in_a_script_is_not_markup_of_the_page(self):
        # The same bargain PageFacts makes, and for the same reason: only the page as committed is
        # judged, so a run cannot be refused over a string it happens to concatenate.
        built = mi.DestructiveControls(
            "<script>var b = \"<button>clear everything</button>\";</script>"
            "<style>.x { content: '<button>wipe it</button>'; }</style>")
        self.assertEqual(built.controls, [])

    def test_a_page_a_run_adds_must_dress_its_destructive_control_as_a_warning(self):
        plain = self.added("<button>clear my notes</button>")
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan({"files": [{"path": "notes.html", "content": plain},
                                        {"path": "sitemap.xml",
                                         "content": sitemap(*self.PAGES, "notes.html")},
                                        {"path": "index.html",
                                         "content": self.wired(home("toy.html", "error.html",
                                                                     "notes.html"))}]})
        self.assertIn("must read as a warning button", str(refused.exception))
        self.assertIn('"clear my notes"', str(refused.exception))

    def test_the_same_control_as_a_warning_button_is_exactly_what_the_axiom_wants(self):
        warned = self.added("<button class='warning'>clear my notes</button>")
        ops = mi.validate_plan({"files": [{"path": "notes.html", "content": warned},
                                          {"path": "sitemap.xml",
                                           "content": sitemap(*self.PAGES, "notes.html")},
                                          {"path": "index.html",
                                           "content": self.wired(home("toy.html", "error.html",
                                                                      "notes.html"))}]})
        self.assertEqual(sorted(t.name for _, t, _ in ops),
                         ["index.html", "notes.html", "sitemap.xml"])

    def test_taking_the_warning_off_a_page_a_run_rewrites_is_refused(self):
        (self.site / "toy.html").write_text(
            self.wired("<button class='warning'>empty the drawer</button>"))
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan({"files": [{"path": "toy.html",
                                         "content": self.wired("<button>empty the drawer</button>")}]})
        self.assertIn("must read as a warning button", str(refused.exception))

    def test_a_control_that_already_fell_short_blocks_nothing(self):
        # Only what the run itself breaks is refused, exactly as with the other six: a page that
        # already has a bare destructive control stays the site's own to repair, and refusing every
        # plan over it would leave no plan able to.
        (self.site / "toy.html").write_text(self.wired("<button>clear the shelf</button>"))
        ops = mi.validate_plan({"files": [{"path": "toy.html",
                                           "content": self.wired("<button>clear the shelf</button>"
                                                                  "<p>and a new line</p>")}]})
        self.assertEqual([t.name for _, t, _ in ops], ["toy.html"])

    def test_dressing_one_control_is_never_mistaken_for_undressing_another(self):
        # Every reason is one control's name, so a partial repair can only take reasons away.
        (self.site / "toy.html").write_text(
            self.wired("<button>clear the shelf</button><button>empty the bin</button>"))
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": self.wired(
            "<button class='warning'>clear the shelf</button><button>empty the bin</button>")}]})
        self.assertEqual([t.name for _, t, _ in ops], ["toy.html"])

    def test_retiring_a_page_with_a_bare_destructive_control_is_fine(self):
        (self.site / "old.html").write_text(self.wired("<button>wipe everything</button>"))
        self.assertEqual(len(mi.validate_plan({"delete": ["old.html"]})), 1)

    def test_a_page_that_writes_its_own_confirmation_is_refused(self):
        page_with = self.added("<button class='warning'>clear my notes</button>"
                               "<script>if (window.confirm('sure?')) wipe();</script>")
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan({"files": [{"path": "notes.html", "content": page_with},
                                        {"path": "sitemap.xml",
                                         "content": sitemap(*self.PAGES, "notes.html")},
                                        {"path": "index.html",
                                         "content": self.wired(home("toy.html", "error.html",
                                                                     "notes.html"))}]})
        self.assertIn("no page may write a confirmation of its own", str(refused.exception))

    def test_a_confirmation_federated_into_a_shared_script_counts(self):
        # Read of a page along with every script it loads, as the cadence and mood checks are: a
        # confirmation lifted into a shared file is still a confirmation on every page that loads it.
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan({"files": [{"path": mi.DESTRUCTIVE_SCRIPT, "content":
                                         "var ok = { destructive: function () { confirm('sure?'); } };"}]})
        self.assertIn("no page may write a confirmation of its own", str(refused.exception))

    def test_the_fixed_files_may_keep_a_confirmation_of_their_own(self):
        # js/state.js carries one as the fallback for a run having broken js/site.js: the meta menu
        # is the one thing on the site a visitor can rely on, and FIXED_FILES are never a run's
        # fault, exactly as with the cadence axiom's vendored library.
        (self.site / "js").mkdir(exist_ok=True)
        (self.site / mi.STATE_SCRIPT).write_text("if (window.confirm('sure?')) {}")
        (self.site / "toy.html").write_text(
            f"<head><script src='{mi.STATE_SCRIPT}'></script></head><body><p>toy</p></body>")
        self.assertEqual(mi.pages_improvising_confirmation(dict(mi.read_site())), {})

    def test_a_page_that_already_asked_in_the_browsers_words_blocks_nothing(self):
        asking = self.wired("<p>toy</p><script>if (confirm('sure?')) go();</script>")
        (self.site / "toy.html").write_text(asking)
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": asking + "<p>more</p>"}]})
        self.assertEqual([t.name for _, t, _ in ops], ["toy.html"])

    def test_the_shared_component_may_be_rewritten_but_never_taken_away(self):
        kept = mi.validate_plan({"files": [{"path": mi.DESTRUCTIVE_SCRIPT, "content":
                                            "window.interestingSite = { destructive: fn, areYouSure: fn };"}]})
        self.assertEqual([t.name for _, t, _ in kept], ["site.js"])
        for gone, content in [(mi.DESTRUCTIVE_SCRIPT, "window.interestingSite = { unlock: fn };"),
                              (mi.SHARED_STYLESHEET, "button { color: #fff; }")]:
            with self.subTest(gone=gone):
                with self.assertRaises(mi.RejectedChange) as refused:
                    mi.validate_plan({"files": [{"path": gone, "content": content}]})
                self.assertIn("shared destructive-control component must stay",
                              str(refused.exception))

    def test_a_site_that_never_had_the_component_blocks_nothing(self):
        # The same reasoning pages_missing_mood is not held to a site without the mood script:
        # there would be nothing for a control to use, so there is nothing to refuse over.
        (self.site / mi.DESTRUCTIVE_SCRIPT).unlink()
        (self.site / mi.SHARED_STYLESHEET).unlink()
        ops = mi.validate_plan({"files": [{"path": "toy.html", "content": "<p>a plainer toy</p>"}]})
        self.assertEqual([t.name for _, t, _ in ops], ["toy.html"])


def needs_the_build():
    """Skip the tests that run the real Node build when the toolchain is not installed.

    In CI it is a failure instead: a silent skip there would quietly stop checking the built site,
    which is the only site the axioms are about.

    This raises rather than calling skipTest/fail on a test, because it is asked from setUpClass:
    every build is a fresh Node process, so a probe per test would cost more than the checks do
    (see RealSiteTest.setUpClass).
    """
    try:
        mi.build_site({"index.html": "<h1>hi</h1>"})
    except mi.BuildToolchainError as err:
        if os.environ.get("CI"):
            raise AssertionError(f"the Node build toolchain is missing in CI: {err}") from None
        raise unittest.SkipTest(f"the Node build toolchain is not installed ({err})") from None


def front_matter(**fields):
    return "---\n" + "".join(f"{key}: {value}\n" for key, value in fields.items()) + "---\n"


def needs_the_piece_harness(test):
    """Skip a test that plays pieces through the Node harness when Node cannot run it.

    This is stricter than needs_node: the piece harness needs the permission model (Node >= 20),
    so a probe through run_piece_harness also catches a Node too old to enforce the axiom, where a
    plain `which node` would not. In CI it is a failure instead, for the same reason needs_the_build
    fails there: a silent skip would quietly stop holding the site to the completion axiom.
    """
    try:
        mi.run_piece_harness({"js/modules/probe.js": "export default { id: 'probe' };\n"})
    except mi.BuildToolchainError as err:
        if os.environ.get("CI"):
            test.fail(f"Node is missing in CI: {err}")
        test.skipTest(f"Node cannot run the piece harness ({err})")


_stage_harness_trouble = None  # "" once the harness has been seen to run, the reason it cannot if not


def needs_the_stage_harness(test):
    """Skip a test that runs js/stage.js through the stub browser when Node cannot run it.

    The same bargain as needs_the_piece_harness: the harness runs under the permission model and in
    worker threads, so an old Node cannot run it at all, and in CI that is a failure rather than a
    skip -- a silent skip would quietly stop holding the stage to the axiom it is half of. The
    answer is asked for once per run, because asking is a whole play of the stage.
    """
    global _stage_harness_trouble
    if _stage_harness_trouble is None:
        try:
            mi.run_stage_harness(stage_site())
            _stage_harness_trouble = ""
        except mi.BuildToolchainError as err:
            _stage_harness_trouble = str(err)
    if not _stage_harness_trouble:
        return
    if os.environ.get("CI"):
        test.fail(f"Node cannot run the stage harness in CI: {_stage_harness_trouble}")
    test.skipTest(f"Node cannot run the stage harness ({_stage_harness_trouble})")


def world_list(*worlds):
    """The #site-worlds JSON the layout writes into every page, listing `worlds` (page names)."""
    entries = [{"file": world, "name": world[:-5], "orientation": "o", "mood": "m", "aspect": "1 / 1", "what": "."}
               for world in worlds]
    return f"<script type='application/json' id='{mi.WORLD_LIST_ID}'>{json.dumps(entries)}</script>"


def piece_module(piece_js, world="toy"):
    """A world's module exporting the card half of the contract and `piece_js` as its piece()."""
    return ("let calls = 0;\nexport default {\n  id: '" + world + "',\n  paint() {},\n  spark() { return null; },\n"
            "  piece(env) {\n" + piece_js + "\n  }\n};\n")


# A piece that solves: a press knob to turn the toy, and the count of turns, which is the answer
# the visitor gives and the check judges -- differing by seed.
FINISHING_PIECE = """    const n = env.int(2, 4);
    let settled = 0;
    return {
      title: n + ' turns of the toy',
      brief: 'Turn it, then say how many turns it took.',
      goal: 'Say how many turns it took.',
      steps: [
        { id: 'turn', ask: 'turn it', kind: 'press', count: n },
        { id: 'count', ask: 'how many turns', kind: 'number', min: 1, max: 9, value: 1, after: 'turn' }
      ],
      solution: { count: n },
      check(ctx) {
        const right = Number(ctx.value('count')) === n;
        return { solved: right, say: right ? 'that is how many' : 'not that many' };
      },
      start(ctx) { ctx.g.fillRect(0, 0, ctx.w, ctx.h); },
      frame(t, dt, ctx) { settled += dt; }
    };"""

# The same piece with a wait knob it never satisfies: a visitor opens it and can never check.
ENDLESS_PIECE = FINISHING_PIECE.replace(
    "{ id: 'count', ask: 'how many turns', kind: 'number', min: 1, max: 9, value: 1, after: 'turn' }",
    "{ id: 'count', ask: 'how many turns', kind: 'number', min: 1, max: 9, value: 1, after: 'turn' },\n"
    "        { id: 'settle', ask: 'let it settle', kind: 'wait', after: 'turn' }")

# A piece whose title counts the calls: the same seed does not make the same piece.
UNSTABLE_PIECE = FINISHING_PIECE.replace("title: n + ' turns of the toy'", "title: (calls += 1) + ' turns'")

# A piece that reaches for Math.random, which the harness takes away: randomness is the seed's.
RANDOM_PIECE = FINISHING_PIECE.replace("const n = env.int(2, 4);", "const n = 2 + Math.floor(Math.random() * 3);")

# A piece that is the same whatever the seed.
SAME_PIECE = FINISHING_PIECE.replace("const n = env.int(2, 4);", "const n = 3;")

# A piece with six knobs: one more than the stage renders, and more than finishes expediently.
LONG_PIECE = """    return {
      title: 'the long way round',
      brief: 'Six things.',
      goal: 'Turn all six on.',
      steps: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, ask: id, kind: 'toggle' })),
      solution: { a: true, b: true, c: true, d: true, e: true, f: true },
      check(ctx) { return { solved: ['a', 'b', 'c', 'd', 'e', 'f'].every((id) => ctx.value(id) === true) }; }
    };"""

# A piece that reaches for the document, which the stage never hands it and the harness has not got.
DOCUMENT_PIECE = "    document.title = 'x';\n" + FINISHING_PIECE

# A piece with one knob: a lever, not a flow.
ONE_KNOB_PIECE = """    return {
      title: 'one switch',
      brief: 'Flip it.',
      goal: 'Turn it on.',
      steps: [{ id: 'flip', ask: 'flip it', kind: 'toggle' }],
      solution: { flip: true },
      check(ctx) { return { solved: ctx.value('flip') === true }; }
    };"""

# A piece shaped like the one issue #60 was reported on: a slider nobody is made to move, and the
# piece's last gesture gated behind the knobs below it, so the last knob a visitor touches is not
# the last knob the piece is waiting on.
SLIDER_PIECE = """    const n = env.int(2, 4);
    let settled = 0;
    return {
      title: n + ' turns at a pace',
      brief: 'Set the pace, turn it, let it settle, and seal it.',
      goal: 'Set the pace to three quarters.',
      steps: [
        { id: 'pace', ask: 'the pace', kind: 'range', min: 0, max: 100, step: 1, value: 40, low: 'slow', high: 'quick' },
        { id: 'turn', ask: 'turn it', kind: 'press', count: n },
        { id: 'settle', ask: 'let it settle', kind: 'wait', after: 'turn' },
        { id: 'seal', ask: 'seal it', kind: 'hold', ms: 900, label: 'hold to seal', after: 'settle' }
      ],
      solution: { pace: 75 },
      check(ctx) { return { solved: Number(ctx.value('pace')) === 75, say: 'checked' }; },
      start(ctx) { ctx.g.fillRect(0, 0, ctx.w, ctx.h); },
      frame(t, dt, ctx) {
        if ((ctx.value('turn') || 0) >= n) {
          settled += dt;
          ctx.progress('settle', settled);
          if (settled >= 1) ctx.satisfy('settle');
        }
      }
    };"""


# A piece whose first knob is a hold, with a plain toggle after it so filling the hold does not end the
# piece and the ceremony never writes over what the piece said. Its apply() counts the holds onto the
# status line -- the one thing a piece can say that the harness reads back -- so a release that set
# the knob a second time would be written there for the law to find (issue #74).
HOLD_PIECE = """    let holds = 0;
    return {
      title: 'one long hold',
      brief: 'Hold it until the bar fills, then turn the other thing.',
      goal: 'Turn the other thing on.',
      steps: [
        { id: 'seal', ask: 'hold to seal', kind: 'hold', ms: 900, label: 'hold to seal' },
        { id: 'after', ask: 'and then this', kind: 'toggle' }
      ],
      solution: { after: true },
      check(ctx) { return { solved: ctx.value('after') === true }; },
      start(ctx) { ctx.g.fillRect(0, 0, ctx.w, ctx.h); },
      apply(id, value, ctx) { if (id === 'seal') ctx.status('held ' + (holds += 1) + ' time(s)'); }
    };"""


# A piece that says what it is still being told, so a finished piece staying playable can be read
# back off the stage (issue #86). Its frame() writes the counts onto the one live line a piece has,
# so the harness can see the loop still drawing, the knob still reaching apply() and the scene still
# reaching tap() long after the ceremony wrote "finished" over that same line.
LIVE_PIECE = """    let frames = 0;
    let turns = 0;
    let taps = 0;
    return {
      title: 'a toy that keeps going',
      brief: 'Turn it the other way, then tap the scene. It is a toy before it is solved and after.',
      goal: 'Turn it the other way.',
      steps: [
        { id: 'turn', ask: 'turn it', kind: 'choice',
          options: [{ label: 'one way', value: 1 }, { label: 'the other way', value: 2 }] },
        { id: 'touch', ask: 'tap the scene', kind: 'tap', after: 'turn' }
      ],
      solution: { turn: 2 },
      check(ctx) { return { solved: ctx.value('turn') === 2 }; },
      start(ctx) { ctx.g.fillRect(0, 0, ctx.w, ctx.h); },
      frame(t, dt, ctx) { frames += 1; ctx.status('frames ' + frames + '; turns ' + turns + '; taps ' + taps); },
      apply(id, value, ctx) { if (id === 'turn') turns += 1; },
      tap(x, y, ctx) { taps += 1; ctx.satisfy('touch'); }
    };"""


def stage_site(toy=None, other=None):
    """A site the stage harness can play: the one list of worlds, js/stage.js and the configuration
    it imports as committed, and a module for each world. Neither of those two is ever a fixture --
    the point is to run the real ones."""
    return {
        "index.html": world_list("toy.html", "other.html"),
        mi.STAGE_SCRIPT: (mi.REPO_ROOT / "site" / mi.STAGE_SCRIPT).read_text(encoding="utf-8"),
        mi.VARIANT_SCRIPT: (mi.REPO_ROOT / "site" / mi.VARIANT_SCRIPT).read_text(encoding="utf-8"),
        "js/modules/toy.js": piece_module(toy or SLIDER_PIECE, "toy"),
        "js/modules/other.js": piece_module(other or FINISHING_PIECE, "other"),
    }


# A piece that says what the stage handed it, so the harness can read it back off the stage: the
# configuration on env.variant and the card on env.card (the alignment axiom, issue #80).
CARRIED_PIECE = """    const v = env.variant || {};
    const card = env.card || {};
    return {
      title: 'of ' + (card.title || 'no card') + ' at ' + (v.stretch == null ? 'no stretch' : Number(v.stretch).toFixed(2)),
      brief: 'of: ' + ((card.of && card.of.token) || 'nothing') + '; showing: ' + (card.quote || 'nothing')
        + '; density: ' + (v.density == null ? 'none' : Number(v.density).toFixed(2)),
      goal: 'Turn both on.',
      aspect: '4 / 3',
      steps: [
        { id: 'a', ask: 'one thing', kind: 'toggle' },
        { id: 'b', ask: 'and another', kind: 'toggle' }
      ],
      solution: { a: true, b: true },
      check(ctx) { return { solved: ctx.value('a') === true && ctx.value('b') === true }; },
      start(ctx) { ctx.g.fillRect(0, 0, ctx.w, ctx.h); }
    };"""


def card_module(piece_js, world="toy"):
    """A world's module whose cards differ by seed -- so the alignment axiom (issue #80) has two
    cards to tell apart -- with `piece_js` as its piece()."""
    return ("export default {\n  id: '" + world + "',\n  paint() {},\n"
            "  spark(env) { const n = env.int(1, 999); return { title: 'card ' + n, text: 'one of many', of: { n } }; },\n"
            "  piece(env) {\n" + piece_js + "\n  }\n};\n")


# The same piece, of the card it was opened from: a feature is the card that was pressed.
OF_ITS_CARD_PIECE = FINISHING_PIECE.replace(
    "title: n + ' turns of the toy'",
    "title: (env.card && env.card.of ? 'turning card ' + env.card.of.n : n + ' turns of the toy')")


# A piece that sets one of its own knobs on arrival, before its visitor has set anything.
SELF_FINISHING_PIECE = """    return {
      title: 'already done',
      brief: 'Nothing to do.',
      goal: 'Turn a on.',
      steps: [{ id: 'a', ask: 'a', kind: 'toggle' }, { id: 'b', ask: 'b', kind: 'wait' }],
      solution: { a: true },
      check(ctx) { return { solved: ctx.value('a') === true }; },
      start(ctx) { ctx.satisfy('b'); }
    };"""


class CompletionAxiomTest(SiteDirTestCase):
    """Every world is a puzzle a visitor can solve.

    A world's page is a stage, and what a visitor opens there is a piece its module makes from a
    seed: a goal, a few knobs, a check, a solution, a vanish, and the next. The ninth axiom stands
    beside the other eight -- stated in the prompt, held to by validate_plan -- and what code can
    settle about it is that every listed world has a module with a piece, that the piece's own
    solution solves it, and that no wrong answer does: by the harness here, exactly as by the
    stage in a browser.
    """

    PAGES = ["index.html", "error.html", "toy.html"]

    def setUp(self):
        super().setUp()
        needs_the_piece_harness(self)
        (self.site / "js" / "modules").mkdir(parents=True)
        (self.site / mi.MOOD_SCRIPT).write_text(mood_script(*MoodAxiomTest.MECHANISMS))
        (self.site / "index.html").write_text(queried(home("toy.html", "error.html") + world_list("toy.html")))
        (self.site / "error.html").write_text(queried("<p>404</p>"))
        (self.site / "toy.html").write_text(queried("<p>toy</p>"))
        (self.site / "sitemap.xml").write_text(sitemap(*self.PAGES))
        self.module = self.site / "js" / "modules" / "toy.js"
        self.module.write_text(piece_module(FINISHING_PIECE))

    def rules(self):
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        return prompt[prompt.index("Rules:"):]

    def plan(self, **files):
        return {"summary": "a change", "files": [{"path": path, "content": content} for path, content in files.items()]}

    def test_the_axiom_is_a_standing_rule_of_every_prompt(self):
        rules = self.rules()
        for rule in ["AXIOM, every run: every world is a puzzle a visitor can solve",
                     "every piece is a legitimate puzzle",
                     "a goal stated in one line",
                     "a check that says whether the answer solves it, and a solution the piece itself knows",
                     "A fidget toy finishes when its levers have been pulled; a puzzle finishes when it is solved",
                     "a press of it is a try",
                     "Solved plays its ceremony and lights up the way on",
                     "the stage never moves on by itself",
                     "opens the next card in the feed in its place",
                     "Not solved writes `say` on the live line, counts the try, and changes nothing else",
                     "every listed world's module exports piece(env)",
                     mi.STAGE_SCRIPT,
                     "choice (two to four options), toggle, range, number, word, order, pick, grid, press, hold, tap, wait",
                     "`solution` names every answer knob and the value that solves it",
                     "A press, a hold or a wait is never an answer",
                     "optional: true is a helper the check does not wait for",
                     "there is no auto and no complete()",
                     "The same seed makes the same piece and different seeds make different pieces",
                     "never reaches for the document, the window, the clock, Math.random or the browser's storage",
                     "only a tap or a wait knob is the piece's to set",
                     "ctx.set(id, value) writes a knob from tap() alone",
                     # What makes a puzzle legitimate, which is what the law holds a piece to.
                     "every answer wrong at once does not",
                     "each answer wrong on its own with the rest right does not",
                     "a puzzle that opens solved is no puzzle",
                     "a wrong check gives measured feedback",
                     "never a lone two-to-four-option choice as the whole answer",
                     "generate every puzzle from its solution",
                     "The world's old interactive page is the piece's material",
                     mi.PIECE_HARNESS_REL,
                     f"within {mi.PIECE_MAX_TAPS} taps and {mi.PIECE_MAX_SECONDS} seconds of",
                     # Issue #60: the half of the axiom the harness could not reach until there was
                     # a harness for the stage, said in the prompt so a run writing a piece or
                     # rewriting the stage knows it.
                     "Every knob must be one its visitor can actually set",
                     "solvable whatever order they reach its knobs in",
                     "A piece is one instantiation and keeps nothing between them",
                     mi.STAGE_HARNESS_REL,
                     "a wrong answer checked is refused and counted and leaves every knob live",
                     "a slider a visitor leaves where it stands counts as set",
                     "a knob nobody set is named rather than silently holding the check shut",
                     "a hold knob is set the moment its bar fills rather than when the visitor lets go",
                     "a solved piece stays on the stage with the way on lit",
                     "leaves nothing of itself on the stage or still running",
                     # Issue #86: Done is not the End, stated to the run that writes the pieces and
                     # to the run that rewrites the stage, and held by the same stage harness.
                     "a piece of content does not End just because it is Done",
                     "as long as the visitor is still interested",
                     "the ceremony takes nothing away",
                     "every knob stays enabled and can be set again",
                     "no timeout, no fade-out, no inert state and no teardown",
                     "Keep the done mark out of the way of the content",
                     "never laid over the scene",
                     "a solved piece is still fully playable",
                     # Issue #80: a piece is the card it was opened from, which the same two
                     # harnesses hold it to, so a run writing a piece is told as much.
                     "A piece is also the card it was opened from",
                     "piece(env) reads env.card",
                     "the same piece whichever of its world's cards it was opened from",
                     "a card pressed opens as that card"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, rules)
        self.assertIn(f"{mi.PIECE_MIN_STEPS} to {mi.PIECE_MAX_STEPS} knobs", rules)
        self.assertIn("A piece is finished by a check that solves it and by nothing else", rules)
        # The one piece of prose a doubled word would have hidden in: the ceremony's sentence runs
        # straight into the contract's, and the axiom of issue #86 was spliced between them.
        self.assertIn("the river of cards is the river of pieces.", rules)
        self.assertNotIn("pieces. pieces.", rules)
        # The prompt says which of the two harnesses refuses a plan and which holds the committed
        # site, because a rule the code does not enforce must not be dressed up as one that does.
        self.assertIn("checked on the site as committed rather than on a plan", rules)

    def test_the_prompt_tells_a_run_how_a_world_page_is_the_stage(self):
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        self.assertIn("A world page's <main> is the stage", prompt)
        self.assertIn("{% set stageWorld = 'thing' %}{% include 'stage.njk' %}", prompt)
        self.assertIn("with its card and its piece", prompt)
        self.assertIn("A world needs no stylesheet of its own", prompt)

    def test_the_list_of_worlds_is_read_off_the_home_page(self):
        self.assertEqual(mi.listed_worlds(dict(mi.read_site())), ["toy.html"])
        self.assertEqual(mi.listed_worlds({"index.html": "<p>no list</p>"}), [])
        self.assertEqual(mi.listed_worlds({"index.html": world_list().replace("[]", "not json")}), [])

    def test_a_world_whose_piece_finishes_is_not_a_world_without_a_finish(self):
        self.assertEqual(mi.worlds_without_a_finish(dict(mi.read_site())), {})

    def test_a_world_without_a_module_cannot_be_finished(self):
        self.module.unlink()
        self.assertEqual(mi.worlds_without_a_finish(dict(mi.read_site())),
                         {"toy.html": "has no module at js/modules/toy.js"})

    def test_a_module_without_a_piece_cannot_be_finished(self):
        self.module.write_text("export default { id: 'toy', paint() {}, spark() { return null; } };\n")
        self.assertEqual(mi.worlds_without_a_finish(dict(mi.read_site())),
                         {"toy.html": "has a module, js/modules/toy.js, that exports no piece()"})

    def test_a_piece_that_never_finishes_is_a_world_without_a_finish(self):
        self.module.write_text(piece_module(ENDLESS_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertEqual(list(missing), ["toy.html"])
        self.assertIn("the harness refused", missing["toy.html"])
        self.assertIn('"settle" was not set', missing["toy.html"])

    def test_the_same_seed_must_make_the_same_piece(self):
        self.module.write_text(piece_module(UNSTABLE_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn("the same seed does not make the same piece", missing.get("toy.html", ""))

    def test_a_piece_draws_its_randomness_from_the_seed(self):
        self.module.write_text(piece_module(RANDOM_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn("Math.random is not for a piece", missing.get("toy.html", ""))

    def test_different_seeds_must_make_different_pieces(self):
        self.module.write_text(piece_module(SAME_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn("every seed makes the same piece", missing.get("toy.html", ""))

    def test_a_piece_must_be_of_the_card_it_was_opened_from(self):
        # The alignment axiom (issue #80): a card and the feature it opens as are one content piece,
        # procedurally configured once. A module whose cards all differ and whose piece ignores them
        # opens the same feature whichever card a visitor pressed, which is the bug the axiom keeps
        # out, so the harness refuses it; the same piece made of its card is accepted.
        self.module.write_text(card_module(FINISHING_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        refused = missing.get("toy.html", "")
        # The harness's own words, which name the two cards it told apart rather than saying only
        # that it told them apart: a run reading this has to be able to see which pair it was.
        self.assertIn("the piece is the same piece", refused)
        self.assertIn("whether it is opened from", refused)
        self.assertIn("piece(env) has to read env.card", refused)
        self.module.write_text(card_module(OF_ITS_CARD_PIECE))
        self.assertEqual(mi.worlds_without_a_finish(dict(mi.read_site())), {})

    def test_a_world_whose_cards_are_all_alike_is_not_held_to_the_alignment(self):
        # The law needs two cards to tell apart. A module that deals the same content for every
        # seed -- the fixtures above, whose spark makes nothing at all -- has no card for its piece
        # to be of, so it is judged on its finishing alone rather than failing a check that could
        # not be made.
        self.module.write_text(piece_module(FINISHING_PIECE))
        self.assertEqual(mi.worlds_without_a_finish(dict(mi.read_site())), {})

    def test_a_piece_has_at_most_the_knobs_the_stage_renders(self):
        self.module.write_text(piece_module(LONG_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn(f"at most {mi.PIECE_MAX_STEPS}", missing.get("toy.html", ""))

    def test_a_flow_is_more_than_one_knob(self):
        self.module.write_text(piece_module(ONE_KNOB_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn(f"a flow is at least {mi.PIECE_MIN_STEPS}", missing.get("toy.html", ""))

    def test_a_piece_is_finished_by_its_visitor(self):
        self.module.write_text(piece_module(SELF_FINISHING_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn('itself before the visitor had set anything', missing.get("toy.html", ""))

    def test_a_piece_that_reaches_for_the_document_fails(self):
        self.module.write_text(piece_module(DOCUMENT_PIECE))
        missing = mi.worlds_without_a_finish(dict(mi.read_site()))
        self.assertIn("piece() threw", missing.get("toy.html", ""))

    def test_a_plan_that_leaves_a_world_unfinishable_is_refused(self):
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan(self.plan(**{"js/modules/toy.js": piece_module(ENDLESS_PIECE)}))
        self.assertIn("every world must be a puzzle a visitor can solve: toy.html", str(refused.exception))

    def test_a_plan_that_takes_a_piece_away_is_refused(self):
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan(self.plan(**{"js/modules/toy.js": "export default { id: 'toy', paint() {} };\n"}))
        self.assertIn("exports no piece()", str(refused.exception))

    def test_a_world_added_without_a_piece_is_refused(self):
        plan = self.plan(**{
            "index.html": queried(home("toy.html", "new.html", "error.html") + world_list("toy.html", "new.html")),
            "new.html": page(title="new"),
            "sitemap.xml": sitemap(*self.PAGES, "new.html"),
        })
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan(plan)
        self.assertIn("new.html has no module at js/modules/new.js", str(refused.exception))

    def test_a_world_added_with_a_finishing_piece_is_accepted(self):
        plan = self.plan(**{
            "index.html": queried(home("toy.html", "new.html", "error.html") + world_list("toy.html", "new.html")),
            "new.html": page(title="new"),
            "sitemap.xml": sitemap(*self.PAGES, "new.html"),
            "js/modules/new.js": piece_module(FINISHING_PIECE, world="new"),
        })
        ops = mi.validate_plan(plan)
        self.assertEqual(sorted(t.name for _, t, _ in ops), ["index.html", "new.html", "new.js", "sitemap.xml"])

    def test_only_what_the_run_breaks_is_refused(self):
        # A world that already cannot be finished blocks no plan, so a run can repair the site.
        self.module.write_text(piece_module(ENDLESS_PIECE))
        ops = mi.validate_plan(self.plan(**{"toy.html": queried("<p>toy, retouched</p>")}))
        self.assertEqual([t.name for _, t, _ in ops], ["toy.html"])

    def test_a_plan_that_repairs_a_piece_is_accepted(self):
        self.module.write_text(piece_module(ENDLESS_PIECE))
        ops = mi.validate_plan(self.plan(**{"js/modules/toy.js": piece_module(FINISHING_PIECE)}))
        self.assertEqual([t.name for _, t, _ in ops], ["toy.js"])

    def test_dropping_the_list_of_worlds_is_refused(self):
        with self.assertRaises(mi.RejectedChange) as refused:
            mi.validate_plan(self.plan(**{"index.html": queried(home("toy.html", "error.html"))}))
        self.assertIn("one list of worlds", str(refused.exception))

    def test_a_site_with_no_list_of_worlds_is_not_held_to_the_axiom(self):
        # The fixtures of every other axiom test list no worlds, and none of them is played.
        self.assertEqual(mi.worlds_without_a_finish({"index.html": "<h1>hi</h1>", "js/modules/x.js": "nope"}), {})

    def test_a_missing_harness_is_the_toolchain_and_not_the_model(self):
        with mock.patch.object(mi, "PIECE_HARNESS", self.root / "nowhere.mjs"):
            with self.assertRaises(mi.BuildToolchainError):
                mi.worlds_without_a_finish(dict(mi.read_site()))


class StageTest(unittest.TestCase):
    """The stage a piece is played on, run against a stub browser (issue #60).

    The completion axiom has two halves and the piece harness only ever reached one of them. A piece
    can be flawless -- two to five knobs, a clear end, the same for the same seed -- and the stage
    can still leave the visitor who is playing it with nothing to do and no way to finish, because
    the knob the piece offered is not a knob the stage will take. That is what was reported: a
    slider the stage only marked set when its value changed, so a visitor content with where it
    already stood set every other knob, watched the finale run, and waited on a piece that had no
    way left to finish. These tests run the real js/stage.js, through the elements stage.njk writes
    and a clock they step by hand, and hold it to eight things: a world played twice over plays the
    second time like the first, a finished piece waits for the visitor rather than seeing itself
    out, a finished piece is still a piece to play with rather than a picture of one (issue #86), a
    slider used where it stands counts as used, a knob nobody set is named rather than left
    a mystery, a hold knob is set the moment its bar fills rather than when the visitor lets go, a
    piece that is over leaves nothing of itself behind, and the feature a card opens as is the card
    that was pressed rather than the world's generic line (issue #80).
    """

    @classmethod
    def setUpClass(cls):
        cls.reports = {}

    def report(self, deal=(), **pieces):
        """The harness's report for this site and deal, played once per distinct scenario set."""
        needs_the_stage_harness(self)
        key = (tuple(sorted(pieces.items())), tuple(deal))
        if key not in self.reports:
            self.reports[key] = mi.run_stage_harness(stage_site(**pieces), deal=deal)
        return self.reports[key]

    def scenario(self, name, deal=(), **pieces):
        got = self.report(deal=deal, **pieces)[name]
        self.assertTrue(got.get("ok"), f"the {name} scenario did not run: {got.get('error')}")
        return got["result"]

    def test_a_world_played_again_plays_like_the_first_time(self):
        # The replay the note asked for: one stage, one session, and a world dealt a second time
        # after another has been played in between. Every round has to finish and open the next.
        deal = ["toy.html", "other.html", "toy.html"]
        result = self.scenario("rounds", deal=deal)
        self.assertEqual(len(result["rounds"]), len(deal))
        self.assertEqual([r["was"]["file"] for r in result["rounds"]], deal)
        for played in result["rounds"]:
            with self.subTest(world=played["was"]["file"], seed=played["was"]["seed"]):
                self.assertTrue(played["playable"], "the piece never became playable")
                self.assertEqual(played["unset"], [], "a knob the visitor worked was not set")
                self.assertTrue(played["checkOffered"], "every knob was set and no check was offered")
                self.assertTrue(played["checked"], "the check could not be pressed")
                self.assertTrue(played["solved"], "the piece's own solution did not solve it on the stage")
                self.assertEqual(played["doneText"], "solved")
                self.assertTrue(played["movedOn"], "the stage never opened the next piece")
                self.assertEqual(played["modes"][-5:], ["done", "vanishing", "loading", "arriving", "live"])
        self.assertEqual(result["completes"], len(deal))

    def test_a_finished_piece_waits_for_the_visitor_rather_than_showing_itself_out(self):
        # Issue #78: the stage used to see itself out on a timer -- the ceremony, a linger of a
        # second or so, and the next piece whether anyone was ready for it or not. Now the ceremony
        # ends by lighting the way on in the lower right and the stage stops there. Each round of
        # the scenario waits six seconds of its own clock, five times that linger, and the piece it
        # finished is still on the stage; what moves the stage on is the press and nothing else.
        deal = ["toy.html", "other.html", "toy.html"]
        for played in self.scenario("rounds", deal=deal)["rounds"]:
            with self.subTest(world=played["was"]["file"], seed=played["was"]["seed"]):
                self.assertFalse(played["litWhilePlaying"], "the way on was lit before the piece was over")
                self.assertFalse(played["movedOnByItself"],
                                 "the stage opened the next piece with nobody pressing anything")
                self.assertTrue(played["litWhenFinished"], "the ceremony ended and the way on never lit")
                # And it takes the keyboard, so the visitor who finished the piece with a key can
                # go on with one: a mark pinned in a corner is no use to someone who cannot see it.
                self.assertEqual(played["focusedWhenFinished"], "stage-next",
                                 "the way on lit and the keyboard was left wherever it was")
                self.assertTrue(played["pressed"], "there was nothing lit to press")
                self.assertTrue(played["movedOn"], "the way on was pressed and nothing followed")

    def test_a_finished_piece_is_still_a_piece_to_play_with(self):
        # Issue #86, site-wide: a piece of content does not End just because it is Done. The stage
        # used to disable every knob in finish(), so the moment a visitor solved the toy it went
        # dead under their hands -- under a mark that said the stage was waiting for them, and over
        # a scene taps no longer reached. Now finishing reports and lights the way on and takes
        # nothing away. LIVE_PIECE writes what it is still being told onto its live line, so what
        # reaches a finished piece can be read off the stage rather than taken on trust.
        result = self.scenario("afterDone", toy=LIVE_PIECE)
        self.assertTrue(result["playable"], "the piece never became playable")
        self.assertEqual(result["unset"], [], "a knob the visitor worked was not set")
        self.assertEqual(result["atDone"]["mode"], "done", "the piece did not finish")
        self.assertTrue(result["atDone"]["doneShown"], "nothing said the piece was done")
        # Six seconds on, and a second after that, with nobody touching anything: the frame loop is
        # still drawing (the burst's own frames are long spent by then) and nothing is disabled.
        self.assertGreater(result["drawing"]["frames"], result["later"]["frames"],
                           "the frame loop stopped when the piece finished")
        for when in ["atDone", "later", "drawing", "afterKnob", "afterTap"]:
            with self.subTest(when=when):
                seen = result[when]
                self.assertTrue(all(knob["live"] for knob in seen["knobs"]),
                                "a knob went inert on a piece the visitor is still playing with")
                self.assertTrue(all(knob["set"] for knob in seen["knobs"]))
                self.assertEqual(seen["mode"], "done", "the stage left the piece's own mode")
                self.assertEqual(seen["dots"], 2, "the dots went away with the finish")
                self.assertEqual(seen["sceneLabel"], "the scene: a toy that keeps going",
                                 "the scene stopped answering to the piece")
                # And the ceremony played once for all of it: still playable is not still finishing.
                self.assertEqual(seen["completes"], 1, "the piece finished other than once")
        # A knob worked a second time long after the finish reaches the piece's own apply()...
        self.assertEqual(result["reworked"], "turn")
        self.assertIn("turns 2", result["afterKnob"]["status"], "a re-worked knob never reached the piece")
        self.assertIn("taps 1", result["afterKnob"]["status"])
        # ...and so does a tap on the scene, which the stage used to swallow once the piece was over.
        self.assertIn("taps 2", result["afterTap"]["status"], "a tap never reached the finished piece")
        # Nothing was torn down and nothing moved on: this is still the same piece, with the way on
        # as the one thing that can take it away -- and it still does.
        self.assertEqual(result["current"]["file"], result["world"])
        self.assertEqual(result["current"]["seed"], result["seed"])
        self.assertGreater(result["running"], 0, "the stage had nothing left running for a live piece")
        self.assertTrue(result["onward"]["lit"], "the way on never lit over the finished piece")
        self.assertFalse(result["onward"]["movedOnByItself"])
        self.assertTrue(result["onward"]["movedOn"], "the way on was pressed and nothing followed")

    def test_the_done_mark_is_clear_of_the_piece_it_reports_on(self):
        # The other half of issue #86: the mark used to be a 64px disc and a pill laid over the
        # scene's lower-right corner, on top of the piece's own finale. A finished piece's picture
        # is still the content, so the report on it is laid out with the rail -- at the end of the
        # dots' row, which is where the stage already says how much of the piece is set.
        result = self.scenario("afterDone", toy=LIVE_PIECE)
        for when in ["atDone", "later", "afterTap"]:
            with self.subTest(when=when):
                self.assertTrue(result[when]["doneShown"], "nothing said the piece was done")
                self.assertFalse(result[when]["doneOverScene"],
                                 "the done mark is inside the scene, over the picture it reports on")

    def test_a_slider_the_visitor_leaves_where_it_is_still_counts_as_set(self):
        # A slider opens with an answer already on it -- which is why ctx.value(id) is the piece's
        # from the first frame -- so pressing it and letting go where it stands is an answer, and
        # the piece it belongs to has to be finishable by someone who gives it.
        result = self.scenario("sliderUsed")
        self.assertTrue(result["playable"], "no world the harness tried had a slider on it")
        self.assertTrue(result["ranges"], "the check is worth nothing without a slider")
        self.assertEqual(result["unset"], [], "the slider was used and the stage did not take it")
        self.assertTrue(result["checkOffered"], "every knob was set and the stage offered no check")
        self.assertTrue(result["judged"], "the check was pressed and the stage gave no verdict")
        # Where the slider stands is not this piece's answer, so the verdict is a refusal: the piece
        # is still on the stage, live, the way on dim, the try counted, and nothing has moved on.
        self.assertFalse(result["finished"], "a wrong answer finished the piece")
        self.assertIn(result["look"]["mode"], ["live", "arriving"], "an unsolved piece left its mode")
        self.assertFalse(result["look"]["nextLit"], "the way on lit over an unsolved piece")
        self.assertIn("one try", result["look"]["tries"], "the try was not counted")

    def test_a_knob_nobody_set_is_named_rather_than_left_a_mystery(self):
        # The other way round: a knob genuinely untouched is genuinely unset, and the stage must not
        # pretend otherwise -- but it must say which one, because the last knob on the page is often
        # not the last one the piece is waiting on, and silence there reads as a piece that broke.
        result = self.scenario("sliderUntouched")
        self.assertTrue(result["playable"])
        self.assertIn(result["ranges"][0], result["unset"])
        self.assertFalse(result["finished"], "a piece finished with a knob nobody set")
        self.assertFalse(result["checkOffered"], "the check was offered with a knob nobody set")
        self.assertTrue(result["wanted"], "the stage said nothing about the knob it was waiting on")
        self.assertIn("the pace", result["wanted"])
        self.assertNotIn("done", result["modes"])
        # The way on is there the whole time and dim the whole time: an unfinished piece is not a
        # piece to be let out of, and the mark that says so never moves (issue #78).
        self.assertFalse(result["look"]["nextLit"], "the way on lit over a piece nobody had finished")

    def test_a_hold_is_set_when_its_bar_fills_and_not_when_the_visitor_lets_go(self):
        # Issue #74: the holding is the answer, so a visitor who presses the knob, watches the bar
        # fill and keeps on holding has set it -- the piece carries on under their finger -- and the
        # bar stays full for as long as they hold it. Here the hold is the piece's last knob, so
        # filling it is what offers the check: the whole flow runs off the fill and not off the
        # release, and nothing finishes until the check is pressed.
        result = self.scenario("holdFilled")
        self.assertTrue(result["playable"], "no world the harness tried had a hold on it")
        self.assertTrue(result["held"], "the check is worth nothing without a hold")
        self.assertGreater(result["waited"], 0, "the knob was set before the bar had any filling to do")
        self.assertTrue(result["filled"]["set"], "the bar filled and the stage waited for the release")
        for when in ["filled", "kept", "after"]:
            with self.subTest(when=when):
                self.assertTrue(result[when]["set"], "the knob stopped being set")
                self.assertEqual(result[when]["pct"], "100%", "the bar did not stay full")
                self.assertNotIn("let go early", result[when]["status"])
                self.assertTrue(result[when]["checkEnabled"], "the last knob filled and no check was offered")
                self.assertEqual(result[when]["completes"], 0, "a piece finished without its check")

    def test_letting_go_of_a_hold_already_set_does_nothing_at_all(self):
        # The other half: the release. HOLD_PIECE's apply() writes how many times the knob has been
        # applied onto the status line, and its second knob keeps the piece from finishing, so what
        # the stage did is readable right through the hold and out the other side. Letting go of a
        # knob that is already set must not apply it again, must not say "let go early", and must
        # not empty the bar it filled.
        result = self.scenario("holdFilled", toy=HOLD_PIECE)
        self.assertEqual(result["held"], "seal")
        self.assertTrue(result["filled"]["set"], "the bar filled and the stage waited for the release")
        for when in ["filled", "kept", "after"]:
            with self.subTest(when=when):
                self.assertEqual(result[when]["status"], "held 1 time(s)")
                self.assertEqual(result[when]["pct"], "100%")
                self.assertTrue(result[when]["set"])
                self.assertEqual(result[when]["completes"], 0, "a piece with a knob nobody set finished")

    def test_a_wrong_answer_is_refused_and_the_right_one_solves(self):
        # The puzzle axiom, on the stage: a piece is finished by a check that solves it and by
        # nothing else. FINISHING_PIECE's answer is a count; the scenario sets it wrong (the far end
        # of its range) and checks, then sets it right and checks again. The first check has to be
        # refused -- counted, said, every knob still live, nothing lit, nothing finished -- and the
        # second has to solve it, on try two, with the done chip saying so.
        result = self.scenario("wrongThenRight", toy=FINISHING_PIECE)
        self.assertTrue(result["playable"], "the piece never became playable")
        self.assertEqual(result["answers"], ["count"], "the module's own solution was not read")
        self.assertTrue(result["opened"]["goal"], "the stage showed no goal line")
        self.assertFalse(result["opened"]["checkEnabled"], "the check was offered before any knob was set")
        self.assertEqual(result["unset"], [], "a knob the visitor worked was not set")
        self.assertTrue(result["beforeCheck"]["checkEnabled"], "every knob was set and no check was offered")
        self.assertTrue(result["wrongChecked"], "the check could not be pressed")
        wrong = result["afterWrong"]
        self.assertNotEqual(wrong["mode"], "done", "a wrong answer finished the piece")
        self.assertEqual(wrong["verdict"], "wrong", "the stage did not mark the verdict")
        self.assertEqual(wrong["completes"], 0, "a wrong answer played the ceremony")
        self.assertEqual(wrong["tries"], "one try so far", "the try was not counted")
        self.assertEqual(wrong["status"], "not that many", "the piece's own word on a wrong answer was not said")
        self.assertFalse(wrong["nextLit"], "the way on lit over an unsolved piece")
        self.assertFalse(wrong["doneShown"], "the done mark showed over an unsolved piece")
        self.assertTrue(all(knob["live"] for knob in wrong["knobs"]), "a wrong answer put a knob out of action")
        self.assertTrue(all(knob["set"] for knob in wrong["knobs"]), "a wrong answer unset a knob")
        self.assertEqual(result["laterWrong"]["mode"], wrong["mode"], "the stage moved on by itself after a wrong answer")
        self.assertEqual(result["laterWrong"]["completes"], 0)
        self.assertTrue(result["rightChecked"], "the check could not be pressed a second time")
        right = result["afterRight"]
        self.assertEqual(right["mode"], "done", "the right answer did not solve the piece")
        self.assertEqual(right["verdict"], "solved")
        self.assertEqual(right["completes"], 1, "the ceremony played other than once")
        self.assertEqual(right["doneText"], "solved", "the done chip does not say solved")
        self.assertEqual(right["tries"], "solved on try 2", "the solve was not scored by its try")
        self.assertTrue(right["doneShown"])
        self.assertEqual([c["solved"] for c in right["checks"]], [False, True], "the stage:check events do not tell the story")
        self.assertEqual([c["tries"] for c in right["checks"]], [1, 2])
        self.assertTrue(result["onward"]["lit"], "the way on never lit over the solved piece")
        self.assertFalse(result["onward"]["movedOnByItself"])
        self.assertTrue(result["onward"]["movedOn"], "the way on was pressed and nothing followed")

    def test_a_piece_leaves_nothing_on_the_stage_or_running_behind_it(self):
        # "Components should completely reset between instantiations." A piece part-played, with a
        # hold still pressed down under a finger that never lifts, and then another piece opened
        # over it: nothing of the first may be on the stage and nothing of it may still be running.
        result = self.scenario("teardown")
        self.assertTrue(result["playable"])
        self.assertTrue(result["held"], "the check is worth nothing without a hold left pressed")
        self.assertGreater(result["whilePlaying"], 0, "the stage had nothing running while playing")
        self.assertEqual(result["waiting"], 0, "the stage left a timer running after the piece")
        self.assertIsNone(result["current"])
        left = result["look"]
        self.assertEqual(left["knobs"], [])
        self.assertEqual(left["dots"], 0)
        self.assertEqual(left["status"], "")
        self.assertEqual(left["wanted"], "")
        self.assertFalse(left["doneShown"])
        self.assertEqual(left["sceneLabel"], "the scene", "the scene still answers to the piece that is gone")
        self.assertEqual(left["aspect"], "", "the scene kept the shape of the piece that is gone")
        # The way on is the one thing that is lit rather than torn down, because the world opened
        # over the first piece has nothing to play: a stage with nothing to finish is never a dead
        # end, which is the job "skip this one" used to do before the way on took it over.
        self.assertEqual(left["mode"], "empty")
        self.assertTrue(left["nextLit"], "a world with nothing to play offered no way on")

    def test_a_feature_is_the_card_that_was_pressed(self):
        # The alignment axiom (issue #80). A card is a seed, the configuration rolled from it and
        # the content its world's module made for the two; all of that is handed over when the card
        # is pressed, and this is the stage's side of the bargain. CARRIED_PIECE writes what it was
        # handed into its own title and line, so what reached piece(env) can be read back off the
        # stage rather than taken on trust.
        result = self.scenario("carried", toy=CARRIED_PIECE)
        card = result["card"]
        # While the module loads, what the card was showing stands. The world's one-line
        # description is not written at all: it is the same line for every card of that world, and
        # writing it here is exactly the bug -- every card of a world opened the same generic page.
        self.assertEqual(result["loading"]["title"], card["title"])
        self.assertEqual(result["loading"]["brief"], card["quote"])
        self.assertNotEqual(result["loading"]["title"], result["world"]["what"])
        # Then the piece names itself, from the card and the configuration it was handed: both
        # reached piece(env), and the module's own note about what its card is of came back whole.
        self.assertTrue(result["playable"], "the piece never became playable")
        self.assertIn(card["title"], result["opened"]["title"], "the card never reached the piece")
        self.assertIn("1.14", result["opened"]["title"], "the configuration never reached the piece")
        self.assertIn(card["of"]["token"], result["opened"]["brief"], "the card's own note was dropped")
        self.assertIn(card["quote"], result["opened"]["brief"])
        self.assertIn("1.21", result["opened"]["brief"], "the configuration's dials never arrived")
        # The scene is framed as the card's picture was: the piece's own ratio, stretched by the
        # same dial that stretched the card's frame in the feed.
        self.assertNotEqual(result["opened"]["aspect"], "4 / 3", "the scene kept its plain frame")
        self.assertAlmostEqual(float(result["opened"]["aspect"]), (4 / 3) * 1.14, places=2)
        # A world with no module at all -- the other place the generic line used to be written.
        self.assertEqual(result["missingLoading"]["title"], card["title"])
        self.assertEqual(result["missing"]["title"], card["title"])
        self.assertNotEqual(result["missing"]["title"], result["world"]["what"])
        # And a piece nobody pressed: the stage configures it from the seed, so a direct visit to
        # world.html#<seed> wears what a card of that seed would have worn.
        self.assertTrue(result["barePlayable"])
        self.assertIn("no card", result["bare"]["title"], "this fixture's world deals no cards")
        self.assertNotIn("no stretch", result["bare"]["title"],
                         "a piece nobody pressed was handed no configuration at all")
        self.assertNotEqual(result["bare"]["aspect"], "4 / 3")

    def test_a_missing_harness_is_the_toolchain_and_not_the_model(self):
        with tempfile.TemporaryDirectory() as empty:
            with mock.patch.object(mi, "STAGE_HARNESS", Path(empty) / "nowhere.mjs"):
                with self.assertRaises(mi.BuildToolchainError):
                    mi.run_stage_harness(stage_site())

    def test_a_site_without_a_stage_or_without_worlds_is_the_toolchain_saying_so(self):
        without_stage = stage_site()
        del without_stage[mi.STAGE_SCRIPT]
        with self.assertRaises(mi.BuildToolchainError):
            mi.run_stage_harness(without_stage)
        without_worlds = stage_site()
        without_worlds["index.html"] = "<h1>hi</h1>"
        with self.assertRaises(mi.BuildToolchainError):
            mi.run_stage_harness(without_worlds)


class BuildPipelineTest(unittest.TestCase):
    """Issue #25: the real build, and all nine axioms judged on what it produces.

    SiteDirTestCase stands the build in with the identity, which is exactly right for its plain-HTML
    fixtures; this is where the pipeline itself is exercised. /site is source now -- a layout is not
    a page, and a page is whatever the templates make of it -- so these are the tests that say what
    "every page" means.
    """

    # The shell carries what every page owes the axioms: the analytics line, the local-state line,
    # the participation line, the viewport tag and the one <main> landmark. That is how the real
    # /site writes it, and it is why a layout a run damages is refused through every page it builds
    # rather than on its own account -- which matters most for the three lines, since layout.njk is
    # a file a run may rewrite while the files behind those lines are not.
    LAYOUT = ("<!DOCTYPE html>\n<html lang='en'>\n<head><title>{{ title }}</title>\n"
              "<meta name='viewport' content='width=device-width, initial-scale=1'>\n"
              "<link rel='stylesheet' href='css/site.css'>\n"
              f"{mi.ANALYTICS_TAG}\n{mi.STATE_TAG}\n{mi.PARTICIPATE_TAG}</head>\n"
              "<body>\n<main>{{ content | safe }}</main></body>\n</html>\n")
    NAV = "<nav>{% for page in ['toy.html', 'error.html'] %}<a href='{{ page }}'>{{ page }}</a>{% endfor %}</nav>\n"
    PAGES = ["index.html", "toy.html", "error.html"]

    @classmethod
    def setUpClass(cls):
        needs_the_build()

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.site = Path(tmp.name).resolve() / "site"
        (self.site / "_includes").mkdir(parents=True)
        (self.site / "_sass").mkdir()
        (self.site / "js").mkdir()
        (self.site / "css").mkdir()
        patcher = mock.patch.object(mi, "SITE_DIR", self.site)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.write("_includes/layout.njk", self.LAYOUT)
        self.write("_includes/nav.njk", self.NAV)
        self.write("_sass/_tokens.scss", ":root { --fg: #eeeeff; }\n")
        self.write("css/site.scss", "@use 'tokens';\nbody { color: var(--fg); }\n")
        # The analytics, local-state and participation axioms reach the built site too: all three
        # lines live in the shared layout, exactly as /site writes them, so no page below carries
        # one of them and every built page has all three.
        self.write(mi.ANALYTICS_SCRIPT, "/* the shared tag and banner */\n")
        self.write(mi.STATE_SCRIPT, "/* the shared store and its meta menu */\n")
        self.write(mi.PARTICIPATE_SCRIPT, "/* the button that opens a new issue */\n")
        # The home page links nothing itself: its navigation arrives from the shared partial, so
        # only the built site shows that toy.html and error.html can be reached.
        self.write("index.html", front_matter(layout="layout.njk", title="interesting")
                   + '<h1>interesting</h1>\n{% include "nav.njk" %}')
        self.write("toy.html", front_matter(layout="layout.njk", title="toy")
                   + "<h1>toy</h1>\n<p>toy</p>\n")
        self.write("error.html", front_matter(layout="layout.njk", title="lost")
                   + "<h1>lost</h1>\n<p>lost</p>\n")
        self.write("sitemap.xml", sitemap(*self.PAGES))

    def write(self, rel, content):
        (self.site / rel).write_text(content, encoding="utf-8")

    def built(self):
        return mi.build_site(dict(mi.read_site()))

    def test_templates_render_and_sass_compiles_to_the_same_paths(self):
        built = self.built()
        self.assertEqual(sorted(built), sorted(["css/site.css", "error.html", "index.html",
                                                mi.ANALYTICS_SCRIPT, mi.STATE_SCRIPT,
                                                mi.PARTICIPATE_SCRIPT,
                                                "sitemap.xml", "toy.html"]))
        self.assertTrue(built["index.html"].startswith("<!DOCTYPE html>"))
        self.assertIn("<title>interesting</title>", built["index.html"])
        self.assertIn("<h1>interesting</h1>", built["index.html"])
        self.assertNotIn("layout: layout.njk", built["index.html"], "front matter is not published")
        self.assertIn("--fg: #eeeeff", built["css/site.css"], "the @use'd partial reached the output")
        self.assertIn("color:var(--fg)", built["css/site.css"])

    def test_the_shared_files_are_never_published(self):
        # A layout, a partial and a Sass partial are source: they are built into the pages and the
        # stylesheets that use them, and nothing of them is served on its own.
        built = self.built()
        for shared in ["_includes/layout.njk", "_includes/nav.njk", "_sass/_tokens.scss", "css/site.scss"]:
            with self.subTest(shared=shared):
                self.assertIn(shared, dict(mi.read_site()))
                self.assertNotIn(shared, built)

    def test_a_page_is_whatever_the_templates_make_of_it(self):
        # Every axiom asks about pages, and every one is asked of the built site. In the source,
        # index.html names no page, no page carries any shared line, and no page is a whole page
        # at all; built, every page is each of those things.
        source = dict(mi.read_site())
        self.assertEqual(mi.links_from("index.html", source), set())
        self.assertEqual(mi.pages_missing_analytics(source), set(self.PAGES))
        self.assertEqual(mi.pages_missing_state(source), set(self.PAGES))
        self.assertEqual(mi.pages_missing_participate(source), set(self.PAGES))
        self.assertEqual(sorted(mi.inaccessible_pages(source)), sorted(self.PAGES))
        built = self.built()
        self.assertEqual(mi.html_pages(built), set(self.PAGES))
        self.assertEqual(mi.links_from("index.html", built), {"toy.html", "error.html"})
        self.assertEqual(mi.unreachable_pages(built), {})
        self.assertEqual(mi.pages_missing_analytics(built), set())
        self.assertEqual(mi.pages_missing_state(built), set())
        self.assertEqual(mi.pages_missing_participate(built), set())
        self.assertEqual(mi.inaccessible_pages(built), {})

    def test_damaging_the_shared_shell_is_refused_through_every_page_it_builds(self):
        # The flip side of putting the viewport tag and the <main> landmark in the layout: a run
        # that rewrites the shell without them leaves the whole site failing the axiom, and the
        # axiom is judged on that built site rather than on the layout, which is not a page.
        for gone, reason in [("<meta name='viewport' content='width=device-width, initial-scale=1'>\n",
                              "has no viewport meta tag"),
                             ("<main>", "has no <main> landmark")]:
            with self.subTest(reason=reason):
                bare = self.LAYOUT.replace(gone, "", 1)
                with self.assertRaisesRegex(mi.RejectedChange, reason):
                    mi.validate_plan({"files": [{"path": "_includes/layout.njk", "content": bare}]})

    def test_a_page_added_as_a_template_is_held_to_the_axiom_through_the_build(self):
        added = {"path": "new.html",
                 "content": front_matter(layout="layout.njk", title="new") + "<h1>new</h1>\n<p>new</p>\n"}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not reachable.*not listed"):
            mi.validate_plan({"files": [added]})
        wired = {"files": [
            added,
            {"path": "_includes/nav.njk", "content": self.NAV.replace("'error.html'", "'error.html', 'new.html'")},
            {"path": "sitemap.xml", "content": sitemap(*self.PAGES, "new.html")},
        ]}
        self.assertEqual(len(mi.validate_plan(wired)), 3)

    def test_dropping_any_shared_line_breaks_every_page_at_once(self):
        # The flip side of putting the three lines in the layout: a run that rewrites the shell
        # without one leaves the whole site without it, and every one of those axioms is judged on
        # that built site. layout.njk is a file a run may rewrite, which is why this is the
        # scenario that matters: the files behind the lines are fixed, the line that loads them is
        # not.
        for tag, axiom in [(mi.ANALYTICS_TAG, "analytics tag and consent banner"),
                           (mi.STATE_TAG, "shared local-state store and its meta menu"),
                           (mi.PARTICIPATE_TAG, "a visitor's way of steering the site")]:
            with self.subTest(axiom=axiom):
                bare = self.LAYOUT.replace(tag, "")
                with self.assertRaisesRegex(mi.RejectedChange, r"has no <script"):
                    mi.validate_plan({"files": [{"path": "_includes/layout.njk", "content": bare}]})

    def test_a_plan_that_does_not_build_is_refused(self):
        for broken, what in [
            ({"path": "index.html", "content": front_matter(layout="gone.njk") + "<p>x</p>"}, "a missing layout"),
            ({"path": "index.html", "content": '{% include "gone.njk" %}'}, "a missing partial"),
            ({"path": "css/site.scss", "content": "@use 'gone';\n"}, "a missing Sass partial"),
            ({"path": "css/site.scss", "content": "body { color: ; }\n"}, "broken Sass"),
        ]:
            with self.subTest(what=what), self.assertRaisesRegex(mi.RejectedChange, "does not build"):
                mi.validate_plan({"files": [broken]})

    def test_a_site_that_already_does_not_build_blocks_nothing(self):
        # Same reasoning as the orphan that was already there: every run is asked to repair the
        # site, so a run must not be refused over damage it did not do. It still has to build.
        self.write("css/site.scss", "@use 'gone';\n")
        with mock.patch("builtins.print"):
            ops = mi.validate_plan({"files": [{"path": "css/site.scss", "content": "body { color: red; }\n"}]})
        self.assertEqual(len(ops), 1)


def ray_crosses_chip(star, chip):
    """Whether `star`'s ray passes across `chip`'s pill on its way out from the logo.

    The ray is the line from the logo's heart to the middle of its own chip's left edge, which is
    what _sass/_nav.scss draws from the --mx, --my, --len and --a js/site.js writes; nav_harness.mjs
    reports both ends and every chip's box. A segment against a rectangle and nothing more: the
    stretch of the ray inside the chip's left-and-right edges, narrowed to the stretch inside its
    top-and-bottom ones, is not empty. Touching is not crossing, so a ray that only grazes a corner
    -- or that ends on an edge, as every ray does on its own chip -- does not count.
    """
    x0, y0 = star["heartX"], star["heartY"]
    x1, y1 = star["x"], star["y"] + star["height"] / 2
    enter, leave = 0.0, 1.0
    for start, delta, low, high in ((x0, x1 - x0, chip["x"], chip["x"] + chip["width"]),
                                    (y0, y1 - y0, chip["y"], chip["y"] + chip["height"])):
        if not delta:
            if not low <= start <= high:
                return False  # parallel to this pair of edges, and outside them
            continue
        first, second = (low - start) / delta, (high - start) / delta
        enter = max(enter, min(first, second))
        leave = min(leave, max(first, second))
    return enter < leave


class NavTest(unittest.TestCase):
    """The main nav: the sparkles logo, and the constellation it opens (issue #54).

    "This is not the sort of website that uses conventional navigation." The top app bar is gone,
    and the whole of the site's navigation is two marks floating over the page -- the logo in the
    upper left, which says the site's name on rollover and opens a lightbox with the options
    branching out of it, and the persona in the upper right. Two, exactly: a "go to <world>" link
    beside the persona and a button pinned to the bottom edge both outlived the first pass at this
    and are gone (issue #64), and the options they stood for are in the constellation.

    Two halves, checked two ways. What the shell writes is read off the built site, because that is
    the site a visitor gets and the one the axioms are about: every option is in the markup, so
    index.html leads to every page with no script at all. What the logo does when it is pressed is
    behaviour, so nav_harness.mjs loads the real js/site.js into a stub browser, drives it through
    a scenario each and reports what it saw; the assertions are here.
    """

    # The ids the three pieces agree on: the shell writes them, js/site.js finds them, and the
    # harness builds the same tree. A rename that touched only one of the three would leave the
    # nav quietly inert, which is exactly what this catches.
    IDS = ["sparknav", "sparknav-logo", "lightbox-veil", "sparknav-modal",
           "sparknav-reading", "sparknav-reading-go", "sparknav-reading-label",
           "sparknav-participate", "sparknav-participate-open",
           "sparknav-cookies", "sparknav-cookies-open", "sparknav-state", "sparknav-state-open",
           "sparknav-state-label"]
    # And the two the script never names, because it takes the orbits as it finds them: however
    # many the shell writes, in the order it writes them.
    ORBITS = ["sparknav-near", "sparknav-far"]
    # Everything the site's own stylesheets pin over the page, and why each one is allowed to be
    # there: one of the two marks, a part of one of them, or shown only while something is open.
    # Nothing may join this list without being one of those things (issue #64).
    FLOATS = {
        ".skip-link": "off the top of the screen until a keyboard focuses it",
        ".sparknav": "the sparkles logo, upper left",
        ".lightbox-veil": "the one shared lightbox's veil, only while something is open",
        ".sparknav-modal": "the middle of the lightbox, only while it holds the state interface",
        ".persona": "the persona, upper right",
        ".persona-sheet-fallback[open]": "the persona's sheet, only while it is open",
        ".are-you-sure-fallback[open]": "the shared confirmation, only while it is asked",
        ".stage-next": "the stage's way on, only on a page with a stage and only while a piece is on it",
    }

    built = None
    observed = None

    def setUp(self):
        self.repo = Path(mi.__file__).resolve().parents[2]
        site = self.repo / "site"
        if not site.is_dir():
            self.skipTest(f"no site directory at {site}")
        needs_the_build()
        if NavTest.built is None:
            with mock.patch.object(mi, "SITE_DIR", site):
                source = dict(mi.read_site())
                NavTest.built = (source, mi.build_site(source))
        self.source, self.site = NavTest.built
        self.worlds = json.loads(self.source["_data/worlds.json"])

    def seen(self):
        """What the stub browser saw js/site.js do, built once and shared by the tests below."""
        needs_node(self)
        if NavTest.observed is None:
            harness = Path(mi.__file__).resolve().parent / "nav_harness.mjs"
            script = self.repo / "site" / "js" / "site.js"
            if not harness.is_file() or not script.is_file():
                self.skipTest("no nav harness to run")
            run = subprocess.run([mi.NODE_BIN, str(harness), str(script)],
                                 capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 0, f"the harness failed: {run.stderr[-2000:]}")
            NavTest.observed = json.loads(run.stdout)
        return NavTest.observed

    def pages(self):
        return sorted(mi.html_pages(self.site))

    def floated(self):
        """Every selector in the site's own stylesheets that pins something over the page.

        Read off the Sass rather than the built CSS because the Sass is where a rule is written and
        where the comment explaining it sits; FIXED_FILES are left out, the three affordances they
        pin being theirs to place and the shell's to hide (see RealSiteTest).
        """
        found = {}
        for rel, content in sorted(self.source.items()):
            if rel in mi.FIXED_FILES or not rel.endswith((".scss", ".css")):
                continue
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if not re.match(r"\s*position:\s*fixed\b", line):
                    continue
                selector = next((lines[j].rstrip()[:-1].strip() for j in range(i - 1, -1, -1)
                                 if lines[j].rstrip().endswith("{")), line.strip())
                found.setdefault(selector, []).append(rel)
        return found

    # ---- what the shell writes ---------------------------------------------------------------

    def test_no_page_has_a_top_app_bar_any_more(self):
        # The surface goes away entirely -- the sticky blurred bar, its scroll lift and its row of
        # destinations -- leaving the logo and the persona floating over the page.
        for rel, content in self.site.items():
            if rel.endswith((".html", ".css", ".js")):
                with self.subTest(rel=rel):
                    for gone in ["top-bar", "nav-dest", "nav-pill", "is-scrolled", "--top-bar-h"]:
                        self.assertNotIn(gone, content, f"{gone} is a piece of the old app bar")

    def test_every_page_floats_the_logo_and_the_persona(self):
        for page in self.pages():
            with self.subTest(page=page):
                self.assertIn("<details class='sparknav' id='sparknav'>", self.site[page])
                self.assertIn("class='persona' id='persona'", self.site[page])
        self.assertGreater(len(self.pages()), 1, "the check is worth nothing on one page")

    def test_the_persona_is_the_portrait_and_nothing_beside_it(self):
        # The upper-right corner is one control, the avatar. A "go to <world>" link used to sit
        # beside it, which made a second floating item of that corner on any screen wide enough
        # for it; the world a reading opens onto is an option in the constellation instead, where
        # it already was, so nothing of it was lost in taking it out of the chrome (issue #64).
        for page in self.pages():
            with self.subTest(page=page):
                corner = self.site[page]
                corner = corner[corner.index("<div class='persona'"):]
                corner = corner[:corner.index("</div>")]
                self.assertEqual(corner.count("<button"), 1, "one control in that corner")
                self.assertNotIn("<a ", corner, "and no link floating beside it")
        # And nothing of the old link is left in the shell, its stylesheet or its script.
        for rel in ["_includes/layout.njk", "_sass/_persona.scss", "js/persona.js"]:
            with self.subTest(rel=rel):
                self.assertNotIn("persona-go", self.source[rel])

    def test_the_logo_is_a_disclosure_that_says_the_sites_name(self):
        shell = self.source["_includes/layout.njk"]
        logo = shell[shell.index("<summary"):shell.index("</summary>")]
        # Named, so a screen reader has something to say about it, with the visible word inside the
        # name (WCAG 2.5.3 Label in Name); the mark itself is decorative.
        self.assertIn("aria-label='interesting: the site menu'", logo)
        self.assertIn("<span class='sparknav-name'>interesting</span>", logo)
        self.assertIn("aria-hidden='true'", logo)
        # Pressing it opens the menu and never navigates: there is no link in it, and the way home
        # is the home icon in the near orbit instead.
        self.assertNotIn("href", logo)
        near = shell[shell.index("sparknav-near"):shell.index("sparknav-far")]
        self.assertIn("{{ icons[link.icon] }}", near)
        self.assertEqual(self.worlds["wayIn"][0]["file"], "index.html")
        self.assertEqual(self.worlds["wayIn"][0]["icon"], "home", "the way home is a home icon")

    def test_the_name_fades_rather_than_disappearing_from_the_nav_tree(self):
        # The title is clipped to nothing and faded out, never display:none, so the logo keeps its
        # accessible name whether or not a pointer is over it.
        css = self.source["_sass/_nav.scss"]
        fade = css[css.index(".sparknav-name {"):css.index("// ---- the state interface")]
        self.assertIn("max-width: 0", fade)
        self.assertIn("opacity: 0", fade)
        self.assertNotIn("display: none", fade)
        self.assertIn("transition:", fade)
        # And it answers a keyboard as well as a pointer.
        self.assertIn(".sparknav-logo:focus-visible .sparknav-name", fade)

    def test_every_destination_and_the_fine_print_is_an_option_in_the_markup(self):
        # The reachability axiom with no script at all: every option the constellation can hold is
        # a plain link in every page's own markup, so index.html leads to every page of the site.
        wanted = [link["file"] for link in self.worlds["wayIn"] + self.worlds["finePrint"]]
        self.assertIn("privacy.html", wanted)
        self.assertIn("terms.html", wanted)
        for page in self.pages():
            nav = self.site[page]
            nav = nav[nav.index("<details class='sparknav'"):nav.index("</details>")]
            for file in wanted:
                with self.subTest(page=page, file=file):
                    # error.html writes its links from the site's root, as its front matter says,
                    # because it is served at whatever path was asked for; every other page keeps
                    # the relative link the whole site is written with.
                    self.assertRegex(nav, rf"class='sparknav-node' href='/?{re.escape(file)}'")

    def test_the_options_that_depend_on_something_are_written_away(self):
        # "Things come and go from here depending on the state": the three that do are in the
        # markup, hidden, and js/site.js is what brings each one out.
        nav = self.site["moods.html"]
        nav = nav[nav.index("<details class='sparknav'"):nav.index("</details>")]
        for option in ["sparknav-reading", "sparknav-participate", "sparknav-cookies",
                       "sparknav-state"]:
            with self.subTest(option=option):
                self.assertRegex(nav, rf"id='{option}' hidden>")

    def test_the_page_a_visitor_is_on_is_marked_in_the_constellation(self):
        # The same thing the feed does with its own card: say where the visitor is rather than
        # offering them a trip to where they already are.
        for page in ["moods.html", "sitemap.html", "privacy.html", "terms.html", "index.html"]:
            with self.subTest(page=page):
                self.assertIn(f"href='{page}' aria-current='page'", self.site[page])
        # And a page that is on no destination of the nav's has nothing marked in it.
        self.assertNotIn("aria-current", self.site["quiet-room.html"][:self.site["quiet-room.html"]
                                                                      .index("</details>")])

    def test_the_shell_the_script_and_the_harness_agree_on_every_id(self):
        shell = self.source["_includes/layout.njk"]
        script = self.source["js/site.js"]
        harness = (Path(mi.__file__).resolve().parent / "nav_harness.mjs").read_text()
        for name in self.IDS:
            with self.subTest(id=name):
                self.assertIn(f"id='{name}'", shell, "the shell has to write it")
                # Either quote: the script writes strings with single ones, the harness double.
                quoted = "['\"]" + re.escape(name) + "['\"]"
                self.assertRegex(script, quoted, "the script has to look for it")
                self.assertRegex(harness, quoted, "the harness has to stand in for it")
        for name in self.ORBITS:
            with self.subTest(orbit=name):
                self.assertIn(f"id='{name}'", shell)
                self.assertNotIn(name, script, "the orbits are taken as they are found")
        self.assertIn("'.sparknav-orbit'", script, "which is by their one shared class")

    def test_the_fine_print_is_two_real_pages_listed_everywhere(self):
        for page in self.worlds["finePrint"]:
            with self.subTest(page=page["file"]):
                for key in ("file", "name", "gloss", "icon", "what"):
                    self.assertIn(key, page)
                self.assertIn(page["file"], self.site, "a listed page exists")
                self.assertIn(f"<loc>{page['file']}</loc>", self.site[mi.SITEMAP])
                # The site map page lists every page itself, and reads the same one list.
                self.assertIn(f"href='{page['file']}'", self.site["sitemap.html"])
                self.assertIn(page["what"], self.site["sitemap.html"])
        self.assertEqual([page["file"] for page in self.worlds["finePrint"]],
                         ["privacy.html", "terms.html"])

    def test_the_nav_answers_for_its_own_motion(self):
        # The responsive-and-accessible axiom, for the two things the nav moves: the fade and the
        # branching. (inaccessible_pages holds the whole site to this; this says where it is met.)
        css = self.source["_sass/_nav.scss"]
        self.assertIn("prefers-reduced-motion: reduce", css)
        calm = css[css.index("prefers-reduced-motion: reduce"):]
        for still in [".sparknav-name", ".sparknav-node"]:
            with self.subTest(still=still):
                self.assertIn(still, calm)
        # The veil's own fade answers for itself, where the veil now lives (see LightboxTest).
        veil = self.source["_sass/_lightbox.scss"]
        self.assertIn("prefers-reduced-motion: reduce", veil)
        self.assertIn(".lightbox-veil", veil[veil.index("prefers-reduced-motion: reduce"):])
        # And the tap target every chip carries, which no layout may shrink below.
        self.assertGreaterEqual(len(re.findall(r"min-height: 44px", css)), 2)

    def test_every_page_holds_the_middle_of_the_lightbox_open_for_the_state_interface(self):
        # Issue #66: the state interface is a modal inside the lightbox, so the shell writes the
        # box it is hosted in -- inside the <details>, so the veil, the inert page and the focus
        # trap are the ones already up, and hidden until the option is picked.
        for page in self.pages():
            with self.subTest(page=page):
                nav = self.site[page]
                nav = nav[nav.index("<details class='sparknav'"):nav.index("</details>")]
                self.assertIn("<div class='sparknav-modal' id='sparknav-modal' hidden></div>", nav)
        css = self.source["_sass/_nav.scss"]
        box = css[css.index(".sparknav-modal {"):css.index(".sparknav-modal[hidden]")]
        self.assertIn("position: fixed", box)
        self.assertIn("inset: 0", box)
        self.assertIn("place-items: center", box, "it centres what it holds")
        self.assertIn("overflow: auto", box, "a viewport too short for it scrolls")
        self.assertIn("display: none", css[css.index(".sparknav-modal[hidden]"):],
                      "a hidden grid is still a grid")
        # And the constellation it replaces is put away by the same attribute, over both layouts.
        self.assertIn("html[data-nav] .sparknav-sky[hidden]", css)

    def test_the_shell_asks_the_state_menu_for_its_panel_by_the_one_agreed_name(self):
        # The contract across the fixed file and the shell: js/state.js offers
        # window.interestingState.menu.present(host) and js/site.js is what asks. A rename on
        # either side would leave the option falling back to the corner menu for ever, which is
        # exactly the quiet regression the ids check catches for the markup.
        offered = self.source[mi.STATE_SCRIPT]
        self.assertIn("window.interestingState.menu = { panel: panel, present: present };", offered)
        shell = self.source["js/site.js"]
        self.assertIn("store.menu", shell, "the shell has to ask the store it already holds")
        self.assertIn("typeof menu.present === 'function'", shell, "and check before it does")
        self.assertIn("menu.present(nav.modal)", shell)
        harness = (Path(mi.__file__).resolve().parent / "nav_harness.mjs").read_text()
        self.assertIn("present(host)", harness, "the harness has to stand in for it")

    def test_the_lightbox_dims_blurs_and_stills_the_page_behind_it(self):
        # Read off _lightbox.scss rather than _nav.scss: the veil the logo raises is the one the
        # whole site shares now (issue #70), and the nav holds no paint of its own for it.
        css = self.source["_sass/_lightbox.scss"]
        veil = css[css.index(".lightbox-veil {"):css.index("@keyframes lightbox-veil")]
        self.assertIn("position: fixed", veil)
        self.assertIn("inset: 0", veil)
        self.assertIn("backdrop-filter: blur(", veil)
        self.assertRegex(veil, r"background: color-mix\(")
        self.assertIn("animation-play-state: paused", css)
        # And the nav's own veil is gone, markup, paint and keyframes alike: there is one.
        for rel, content in sorted(self.source.items()):
            with self.subTest(rel=rel):
                self.assertNotIn("sparknav-veil", content)

    # ---- what the logo does when it is pressed -----------------------------------------------

    def test_at_rest_the_constellation_holds_only_what_is_there(self):
        seen = self.seen()["atRest"]
        self.assertEqual(seen["nav"], "live", "the stylesheet has to know a script is here")
        self.assertEqual(seen["expanded"], "false")
        self.assertIsNone(seen["lightbox"])
        self.assertEqual(seen["options"],
                         ["the threshold", "the mood atlas", "site map", "privacy", "terms"])
        for away in ("reading", "participate", "cookies", "state"):
            with self.subTest(option=away):
                self.assertTrue(seen[away], "nothing has happened yet, so it is not in the orbit")

    def test_nothing_but_the_logo_and_the_persona_floats_over_a_page(self):
        # The regression issue #64 is about, in both halves. What the site's own stylesheets pin
        # over the page is a closed list -- the two marks, the parts of them, the overlays that are
        # only up while something is open, and the stage's own way on, which a page without a stage
        # does not have at all -- and everything the fixed files pin is hidden where they pinned it
        # and offered in the constellation instead, so at rest a visitor sees two things floating
        # and no more.
        floats = self.floated()
        self.assertEqual(sorted(floats), sorted(self.FLOATS),
                         f"the list of things pinned over the page has changed: {floats}")
        seen = self.seen()["whatFloatsAtRest"]
        for name, state in sorted(seen["pinned"].items()):
            with self.subTest(pinned=name):
                self.assertTrue(state["drawn"], "the harness has to draw it to prove anything")
                self.assertFalse(state["laidOut"], f"{name} is still laid out over the page")
                # The attribute alone is not enough, and that is not a detail: each of these files
                # injects the styles for its own control, and js/participate.js gives its link
                # `display: inline-flex`, which outranks the `display: none` the hidden attribute
                # leans on. The inline declaration beside the attribute is what actually puts it
                # away -- without it, "steer the site" would still be on the bottom edge.
                self.assertEqual(state["display"], "none", f"{name} is hidden in name only")
        self.assertEqual(seen["addedToTheBody"], 0, "the shell floats nothing of its own either")
        self.assertIsNone(seen["lightbox"], "and all of that is true with the page at rest")
        # Hidden, not gone: every one of the three is one press of the logo away.
        for option in ["change this site", "cookies", "state · 1 kept"]:
            with self.subTest(option=option):
                self.assertIn(option, seen["options"])

    def test_the_pinned_affordances_are_adopted_rather_than_copied(self):
        # The heart of the constraint: js/participate.js, js/analytics.js and js/state.js are fixed
        # files, so the shell hides the controls they pin over the page and presses those same
        # controls from the constellation -- there is still exactly one new-issue link, one cookies
        # dialog and one state menu.
        seen = self.seen()["whenTheCornersArrive"]
        for away in ("participate", "cookies", "state"):
            with self.subTest(option=away):
                self.assertTrue(seen["before"][away], "offered nothing before it was drawn")
        for pinned in ("steer", "cookies", "state"):
            with self.subTest(pinned=pinned):
                self.assertTrue(seen["corners"][pinned],
                                "put away where its own file pinned it, attribute and display")
        self.assertTrue(seen["corners"]["panel"], "and the state panel is left alone, closed")
        self.assertIn("change this site", seen["options"])
        self.assertIn("cookies", seen["options"])
        self.assertIn("state · 3 kept", seen["options"])
        pressed = self.seen()["whenAnAdoptedOptionIsPressed"]
        self.assertEqual(pressed["cookies"]["corner"], 1, "it pressed the banner's own button")
        self.assertEqual(pressed["steer"]["corner"], 1, "and the link js/participate.js drew")
        # Which is the whole of how the invitation works: its destination, its new tab and the
        # query that shapes the issue are that file's, and none of them is reproduced in the shell.
        self.assertEqual(pressed["steer"]["target"], "_blank")
        self.assertIn("/issues/new", pressed["steer"]["href"])
        self.assertFalse(pressed["steer"]["inert"], "the lightbox has to let go of it first")
        for name in ("steer", "cookies"):
            with self.subTest(pressed=name):
                self.assertFalse(pressed[name]["open"], "it closed the lightbox out of the way")
        # The three are answered for differently, because two of them hand the visitor to a dialog
        # of somebody else's and the third is a thing to do here (issue #66): the state menu's own
        # panel -- the very element it built, never a copy of it -- is hosted in the lightbox,
        # which stays up around it rather than getting out of its way.
        self.assertTrue(pressed["state"]["open"], "the lightbox keeps the state interface")
        self.assertEqual(pressed["state"]["panelHost"], "sparknav-modal")
        self.assertEqual(pressed["state"]["corner"], 0, "its button is not pressed any more")
        self.assertFalse(pressed["state"]["panelHidden"])

    def test_the_state_interface_takes_the_lightbox_over_without_dropping_it(self):
        # Issue #66, steps 2 and 3: the constellation gives way to the state interface and the
        # lightbox around it is not torn down and raised again -- "zero jitter/glitch/flicker".
        seen = self.seen()["whenTheStateInterfaceTakesOver"]
        before, taken = seen["before"], seen["taken"]
        self.assertEqual(before["lightbox"], "nav")
        self.assertFalse(before["sky"], "the constellation is what the lightbox holds first")
        self.assertTrue(before["modal"], "and nothing is hosted yet")
        # The swap: one attribute write, never a removal in between, so every rule keyed on the
        # lightbox being up stays matched throughout.
        writes = seen["lightboxWrites"]
        self.assertEqual(writes[:writes.index(None)] if None in writes else writes,
                         ["nav", "state"], "the lightbox came down between the two")
        self.assertEqual(taken["lightbox"], "state")
        self.assertTrue(taken["open"], "the <details> never closed")
        self.assertTrue(taken["veil"], "and the veil is the same veil, still up")
        self.assertTrue(taken["sky"], "the constellation is put away")
        self.assertFalse(taken["modal"], "and the middle of the lightbox is holding the panel")
        self.assertEqual(taken["panelHost"], "sparknav-modal")
        self.assertFalse(taken["panelHidden"], "opened, rather than merely moved")
        self.assertTrue(taken["presented"], "dressed as a modal by its own file")
        self.assertEqual(taken["ariaModal"], "true", "and announced as one")
        self.assertTrue(taken["openedOnScreen"],
                        "the host was still hidden when the panel opened in it, so the focus it "
                        "puts in its own text landed nowhere")
        # Everything else about the lightbox carries on exactly as it was.
        self.assertEqual(taken["ranWhileOpen"], 0, "the page's frame loop is still held")
        for behind in ["main-content", "page", "persona", "site-meta"]:
            with self.subTest(behind=behind):
                self.assertTrue(taken["aside"][behind]["inert"], f"{behind} came back to life")
                self.assertEqual(taken["aside"][behind]["ariaHidden"], "true")
        self.assertFalse(taken["aside"]["sparknav"]["inert"],
                         "and the menu hosting it is the one live thing")

    def test_closing_the_state_interface_closes_the_lightbox_and_gives_the_page_back(self):
        # Step 4: there is no way back to the constellation. Closing the panel -- by its own
        # "close", which is all the shell sees -- returns the visitor to the page.
        closed = self.seen()["whenTheStateInterfaceTakesOver"]["closed"]
        self.assertIsNone(closed["lightbox"])
        self.assertFalse(closed["open"], "the <details> closed with it")
        self.assertTrue(closed["modal"], "the host is empty and put away again")
        self.assertFalse(closed["sky"], "and the constellation is there for the next press")
        self.assertEqual(closed["panelHost"], "site-meta",
                         "the panel is back in the corner its own file built it in")
        self.assertFalse(closed["presented"], "and undressed")
        self.assertIsNone(closed["ariaModal"])
        self.assertTrue(closed["panelHidden"])
        self.assertEqual(closed["ranOnClose"], 1, "a held frame is run, not dropped")
        self.assertEqual(closed["focusedLogo"], 1, "the focus comes back to the logo")
        for name, state in closed["aside"].items():
            with self.subTest(element=name):
                self.assertFalse(state["inert"])
                self.assertEqual(state["ariaHidden"], "true" if name == "cc-main" else None)

    def test_escape_and_a_press_outside_the_state_interface_close_it(self):
        seen = self.seen()["whenTheStateInterfaceIsDismissed"]
        for how in ("escape", "pressed"):
            with self.subTest(how=how):
                self.assertIsNone(seen[how]["lightbox"], "the lightbox goes with the modal")
                self.assertFalse(seen[how]["open"])
                self.assertTrue(seen[how]["panelHidden"])
                self.assertEqual(seen[how]["panelHost"], "site-meta")
                self.assertEqual(seen[how]["focusedLogo"], 1)
        # But a question floating over it answers Escape itself: dismissing "are you sure you want
        # to clear everything?" is not dismissing the interface that asked it.
        asking = seen["whileAsking"]
        self.assertEqual(asking["lightbox"], "state")
        self.assertFalse(asking["panelHidden"])
        self.assertEqual(asking["panelHost"], "sparknav-modal")

    def test_the_state_interfaces_own_question_can_still_be_answered(self):
        # Its "clear" opens the shared "are you sure you want to ______?" dialog, and now it opens
        # it from inside the lightbox. That dialog is a child of the body, built the first time
        # anything on the page asks, so the lightbox may have put it aside long before -- and an
        # unanswerable question is worse than no question (see the destructive-caution axiom).
        seen = self.seen()["whenTheStateInterfaceAsksAQuestion"]
        self.assertTrue(seen["putAside"]["inert"], "the lightbox did put it aside, as it should")
        self.assertTrue(seen["question"]["open"])
        self.assertFalse(seen["question"]["inert"], "and the question came back to life to be asked")
        self.assertIsNone(seen["question"]["ariaHidden"])
        self.assertGreaterEqual(seen["question"]["focusedCancel"], 1,
                                "the focus starts on cancel, as it does everywhere")
        # And the interface that asked it is untouched behind the question: the question is the
        # second lightbox up over the same veil, which never drops, so the panel is still hosted
        # where it was and <html data-lightbox> names the box on top rather than going empty.
        self.assertEqual(seen["stillUp"]["lightbox"], "are-you-sure")
        self.assertTrue(seen["stillUp"]["veil"], "over the same veil, which never came down")
        self.assertEqual(seen["stillUp"]["panelHost"], "sparknav-modal")
        self.assertFalse(seen["stillUp"]["panelHidden"])

    def test_a_keyboard_reaches_all_of_the_state_interface_and_stays_inside_it(self):
        # The page behind is inert, so the wrap at either end is what keeps a keyboard in the
        # modal -- and the text box holding the document is as much of it as the buttons.
        seen = self.seen()["whenTabReachesTheEndOfTheStateInterface"]
        self.assertEqual(seen["reachable"][0], "summary", "the logo is still the way out")
        self.assertIn("textarea", seen["reachable"])
        for control in ["button:copy", "button:replace mine", "button:clear", "button:close"]:
            with self.subTest(control=control):
                self.assertIn(control, seen["reachable"])
        self.assertTrue(seen["forward"]["prevented"])
        self.assertTrue(seen["forward"]["toTheLogo"], "Tab wraps to the start of the menu")

    def test_the_state_option_falls_back_to_the_corner_menu_with_nothing_to_host_it(self):
        # js/state.js is the fixed file and js/site.js is a run's to rewrite, so the asking is the
        # shell's and the answer is the store's: a store that offers no panel leaves the behaviour
        # the constellation had before issue #66, which is a menu that still opens.
        seen = self.seen()["withoutAHostedStateInterface"]
        self.assertIsNone(seen["fallen"]["lightbox"], "the lightbox gets out of the way instead")
        self.assertFalse(seen["fallen"]["open"])
        self.assertEqual(seen["fallen"]["corner"], 1, "and the corner button is pressed")
        self.assertEqual(seen["fallen"]["panelHost"], "site-meta")
        # Hiding that button means its own menu cannot hand the focus back to it, so the logo takes
        # it when the menu closes, and not before (WCAG 2.4.3 Focus Order).
        self.assertEqual(seen["focus"]["afterClose"], seen["focus"]["whileOpen"] + 1)

    def test_an_affordance_that_was_never_drawn_is_not_offered(self):
        # A copy of the site with no measurement id draws no consent button, so there is nothing to
        # adopt -- and an option that opened nothing would be worse than no option.
        seen = self.seen()["withoutAConsentBanner"]
        self.assertNotIn("cookies", seen["options"])
        self.assertTrue(seen["cookies"])
        self.assertFalse(seen["state"], "the state menu is always there")
        self.assertFalse(seen["participate"], "and so is the way to say what the site should be")

    def test_the_state_option_says_how_much_there_is_to_carry_away(self):
        self.assertEqual(self.seen()["withNothingKept"]["stateLabel"], "state")
        self.assertEqual(self.seen()["whenTheCornersArrive"]["stateLabel"], "state · 3 kept")

    def test_the_world_a_reading_opens_onto_comes_and_goes_with_the_reading(self):
        read = self.seen()["onceSomethingIsRead"]
        self.assertEqual(read["read"]["href"], "quiet-room.html")
        self.assertEqual(read["read"]["label"], "go to the quiet room")
        self.assertTrue(read["fromSignals"], "a guess from the clock is not a reading")
        self.assertTrue(read["withNoFlow"], "and a page without the flow has nothing to say")
        changed = self.seen()["whenTheReadingChanges"]
        self.assertTrue(changed["before"])
        self.assertEqual(changed["after"]["label"], "go to loam")
        self.assertTrue(changed["forgotten"], "forgetting the reading takes the option out again")
        # On the world itself it says where the visitor is, as the feed's own card does.
        here = self.seen()["onTheWorldItOpensOnto"]
        self.assertEqual(here["label"], "loam")
        self.assertEqual(here["current"], "page")

    def test_opening_it_makes_a_lightbox_of_everything_else(self):
        seen = self.seen()["whenItOpens"]
        self.assertEqual(seen["open"]["lightbox"], "nav")
        self.assertEqual(seen["open"]["expanded"], "true")
        self.assertTrue(seen["open"]["veil"], "the shared veil is what is raised")
        self.assertTrue(seen["open"]["branching"], "the constellation branches out on every press")
        aside = seen["open"]["aside"]
        # Everything behind the veil: inert, so no pointer and no Tab reaches it, and hidden from a
        # screen reader, so the menu is all there is to read. The nav itself is left alone.
        for behind in ["main-content", "page", "persona", "site-consent-link", "site-meta",
                       "site-steer"]:
            with self.subTest(behind=behind):
                self.assertTrue(aside[behind]["inert"], f"{behind} is still reachable")
                self.assertEqual(aside[behind]["ariaHidden"], "true")
        self.assertFalse(aside["sparknav"]["inert"], "the menu is the one thing still live")
        self.assertTrue(aside["sparknav"]["front"], "and the one thing left in front of the veil")
        self.assertFalse(aside["lightbox-veil"]["inert"], "the veil itself takes the press")
        # What was already hidden for its own reasons is not this one's to mark or to give back.
        self.assertFalse(aside["cc-main"]["marked"])
        self.assertEqual(aside["cc-main"]["ariaHidden"], "true")
        # And the page's own frame loop stops: a frame asked for while it is open does not run.
        self.assertEqual(seen["ranWhileOpen"], 0)

    def test_closing_it_gives_the_page_back_exactly_as_it_was(self):
        seen = self.seen()["whenItCloses"]
        self.assertEqual(seen["whileOpen"]["ran"], 0)
        self.assertEqual(seen["ranOnClose"], 1, "a held frame is run, not dropped")
        self.assertIsNone(seen["closed"]["lightbox"])
        self.assertEqual(seen["closed"]["expanded"], "false")
        self.assertFalse(seen["closed"]["veil"], "and the veil comes down with it")
        self.assertFalse(seen["closed"]["branching"])
        for name, state in seen["closed"]["aside"].items():
            with self.subTest(element=name):
                self.assertFalse(state["inert"])
                self.assertFalse(state["marked"])
                self.assertFalse(state["front"], "and nothing is left lifted over a veil that is down")
                # The consent library's own markup stays hidden, because it was never this one's.
                self.assertEqual(state["ariaHidden"], "true" if name == "cc-main" else None)

    def test_escape_and_the_veil_both_close_it(self):
        seen = self.seen()["whenItIsDismissed"]
        self.assertFalse(seen["escape"]["open"])
        self.assertIsNone(seen["escape"]["lightbox"])
        self.assertEqual(seen["escape"]["focused"], 1, "the focus goes back to the logo")
        self.assertTrue(seen["veil"]["raised"], "the press has to land on a veil that was up")
        self.assertFalse(seen["veil"]["open"])
        self.assertIsNone(seen["veil"]["lightbox"])
        self.assertTrue(seen["veil"]["down"], "and the veil goes down with the constellation")
        self.assertEqual(seen["veil"]["focused"], 1, "the focus goes back to the logo either way")

    def test_a_keyboard_stays_inside_the_constellation(self):
        seen = self.seen()["whenTabReachesTheEnd"]
        self.assertTrue(seen["forward"]["prevented"])
        self.assertTrue(seen["forward"]["toTheLogo"], "Tab wraps to the start of the menu")
        self.assertTrue(seen["back"]["prevented"])
        self.assertTrue(seen["back"]["toTheLast"], "and Shift+Tab to the end of it")
        self.assertFalse(seen["middle"], "a Tab in the middle of the menu is the browser's")

    def test_a_destination_closes_the_menu_on_its_way_out(self):
        seen = self.seen()["whenADestinationIsTaken"]
        self.assertFalse(seen["open"])
        self.assertIsNone(seen["lightbox"])

    def test_no_two_stars_land_on_each_other_on_any_screen(self):
        # The one thing a constellation of chips can get wrong that a list cannot. Every chip is
        # 44px tall and up to 150px wide in the stub, so two of them overlap when they are closer
        # than that in both directions at once.
        for shape, seen in self.seen()["whereTheStarsLand"].items():
            stars, view = seen["stars"], seen["viewport"]
            self.assertGreaterEqual(len(stars), 7, "a thin constellation proves nothing")
            for star in stars:
                with self.subTest(shape=shape, star=star["label"]):
                    self.assertGreaterEqual(star["x"], 0)
                    self.assertGreaterEqual(star["y"], 0)
                    self.assertLessEqual(star["x"] + 150, view["width"], "off the right-hand edge")
                    self.assertLessEqual(star["y"] + 44, view["height"], "below the fold")
                    # Every star is on a ray from the logo, so the set reads as one constellation.
                    self.assertGreater(star["len"], 0)
            for one in stars:
                for other in stars:
                    if one["order"] >= other["order"]:
                        continue
                    with self.subTest(shape=shape, pair=(one["label"], other["label"])):
                        self.assertTrue(abs(one["y"] - other["y"]) >= 44
                                        or abs(one["x"] - other["x"]) >= 150,
                                        f"{one['label']} and {other['label']} overlap")

    def test_no_ray_is_ever_drawn_over_an_option(self):
        # Issue #72: "the lines of the main nav constellation should never appear over the options".
        # Two halves, because neither on its own would catch it. The geometry says the rule is
        # needed at all: on every shape of screen there are rays that run clear across other
        # options' chips -- the far column's rays over the near column's chips where there are two
        # columns, and a lower star's ray over the chips above it where there is one -- and some of
        # those rays belong to an option drawn after the chip they cross, which is the case equal
        # stacking paints the wrong way round. The stylesheet says the rule is kept: every ray is in
        # a layer strictly below every chip, so a ray crossing a chip passes behind its pill.
        for shape, seen in self.seen()["whereTheStarsLand"].items():
            stars = seen["stars"]
            crossed = [(one, other) for one in stars for other in stars
                       if one["order"] != other["order"] and ray_crosses_chip(one, other)]
            with self.subTest(shape=shape):
                self.assertTrue(crossed, "no ray crosses a chip here, so the layers prove nothing")
                self.assertTrue([pair for pair in crossed if pair[0]["order"] > pair[1]["order"]],
                                "no ray reaches an option drawn after the chip it crosses")
        # The layers, read off the sheet a browser is served: every ray, then every chip, then the
        # logo the rays leave from. All of it inside the one layer the shared lightbox lifts the
        # whole mark into, which is why the veil is not among them any more (see LightboxTest).
        sheet = Stylesheet(self.site["css/site.css"], 1440, 900)
        layers = {}
        for part, selector in [("ray", "html[data-nav=live] .sparknav-ray"),
                               ("chip", "html[data-nav=live] .sparknav-node"),
                               ("logo", ".sparknav-logo")]:
            found = sheet.value(selector, "z-index")
            self.assertIsNotNone(found, f"{selector} declares no layer of its own")
            layers[part] = int(found)
        self.assertLess(layers["ray"], layers["chip"], "a ray is below every chip, whatever the order")
        self.assertLess(layers["chip"], layers["logo"], "and the whole scatter is below the logo")
        # Which only holds while an option is not a stacking context of its own: one that was would
        # group its own ray with its own chip and carry the pair up over an earlier option again.
        # The branch animates the chip and the ray, each already in a layer, and never the option.
        grouping = ["z-index", "opacity", "transform", "filter", "backdrop-filter", "isolation",
                    "mix-blend-mode", "will-change", "contain", "perspective", "animation"]
        for selector, declarations in sheet.rules:
            # The option itself, however it was reached: the last compound of the selector, which is
            # whatever follows the final descendant, child or sibling combinator in it.
            if not re.search(r"\.sparknav-option(?![\w-])", re.split(r"[\s>+~]+", selector)[-1]):
                continue
            for declaration in declarations.split(";"):
                name = declaration.partition(":")[0].strip()
                with self.subTest(rule=selector, declaration=name):
                    self.assertNotIn(name, grouping, "this makes a stacking context of the option")

    def test_a_viewport_too_short_for_a_constellation_gets_the_cascade(self):
        # The one layout that can always fit, because it scrolls: an option below the fold of a
        # fixed constellation would be one nothing could reach (WCAG 1.4.10 Reflow).
        seen = self.seen()["onAViewportTooShortForIt"]
        self.assertEqual(seen["tooShort"], "cascade")
        self.assertEqual(seen["roomy"], "live", "the same width with room for it keeps the scatter")
        self.assertTrue(seen["stillOpen"], "and it is still the same open menu either way")
        self.assertEqual(seen["stillALightbox"], "nav")
        # Which means the stylesheet has to hold both layouts, and say so by name.
        css = self.source["_sass/_nav.scss"]
        self.assertIn("html[data-nav='live']", css)
        self.assertIn("overflow: auto", css, "the cascade is what scrolls")

    def test_a_shell_without_the_nav_takes_nothing_else_down(self):
        # js/site.js carries the unlock helper every world leans on, so a half-rewritten shell must
        # not be able to stop it loading.
        seen = self.seen()["withoutTheNav"]
        self.assertIsNone(seen["logo"])
        self.assertIsNone(seen["lightbox"])
        self.assertEqual(seen["nav"], "live")
        self.assertGreaterEqual(seen["observers"], 1, "the rest of the shell still ran")


class LightboxTest(unittest.TestCase):
    """One lightbox, shared between the nav, the persona sheet and the confirmation (issue #70).

    "the lightbox effect for the main nav (top left logo) is amazing!! the lightbox effect for the
    persona should be identical; they should share a common lightbox component. the current persona
    lightbox is weak." That was the whole of the note. The nav's veil, its inert page and its held
    frame loop were built by hand inside the nav, and the persona sheet was a bare <dialog> with a
    flat `::backdrop` and none of the rest.

    The architectural decision the issue asked for -- "make a proper architectural decision about
    where the shared component lives, then federate and document it" -- is
    window.interestingSite.lightbox() in js/site.js, painted by _sass/_lightbox.scss, with one
    #lightbox-veil in the shell. js/site.js is where every other shared component of the shell
    already lives, every page already loads it, and it is already loaded after js/persona.js and
    before anything builds, which is the one ordering constraint a new file would have had to
    reproduce. The decision is written down in three places a reader will actually be standing in:
    the header comment of js/site.js, the README section "The lightbox", and the prompt every run
    of make_interesting.py is given.

    Two halves, checked two ways, as with NavTest: what the shell and the stylesheets say is read
    off the source and the built site, and what the three callers do is behaviour, so
    lightbox_harness.mjs loads the real js/site.js and js/persona.js into one stub browser and
    drives each of them.
    """

    # The ids the shell writes, the scripts find and the harness stands in for.
    IDS = ["lightbox-veil", "sparknav", "persona-sheet", "persona-open", "persona-close"]
    # What "identical" means, as four things a stub browser can watch: the same veil element up,
    # every other child of <body> put behind it, the one thing open left in front, and the page's
    # frame loop held. Issue #70's third answer -- "yes" -- is the fourth of these.
    EVERY_CALLER = ["whenTheLogoOpens", "whenTheSheetOpens"]

    # The real site is read and built once for the whole class, and the harness run once, for the
    # reason RealSiteTest gives: a build is a whole Node run, and every test below only reads.
    built = None
    observed = None

    def setUp(self):
        self.repo = Path(mi.__file__).resolve().parents[2]
        site = self.repo / "site"
        if not site.is_dir():
            self.skipTest(f"no site directory at {site}")
        needs_the_build()
        if LightboxTest.built is None:
            with mock.patch.object(mi, "SITE_DIR", site):
                source = dict(mi.read_site())
                LightboxTest.built = (source, mi.build_site(source))
        self.source, self.site = LightboxTest.built

    def seen(self):
        """What the stub browser saw the two real files do, built once and shared by the tests."""
        needs_node(self)
        if LightboxTest.observed is None:
            harness = Path(mi.__file__).resolve().parent / "lightbox_harness.mjs"
            scripts = [self.repo / "site" / "js" / "site.js",
                       self.repo / "site" / "js" / "persona.js"]
            if not harness.is_file() or not all(script.is_file() for script in scripts):
                self.skipTest("no lightbox harness to run")
            run = subprocess.run([mi.NODE_BIN, str(harness)] + [str(s) for s in scripts],
                                 capture_output=True, text=True, timeout=120)
            self.assertEqual(run.returncode, 0, f"the harness failed: {run.stderr[-2000:]}")
            LightboxTest.observed = json.loads(run.stdout)
        for name, got in LightboxTest.observed.items():
            self.assertTrue(got["ok"], f"the {name} scenario did not run: {got.get('error')}")
        return {name: got["result"] for name, got in LightboxTest.observed.items()}

    # ---- where the component lives, and that it is the only one ------------------------------

    def test_the_component_lives_in_the_one_shared_script_and_is_offered_by_name(self):
        helper = self.source[mi.DESTRUCTIVE_SCRIPT]  # js/site.js: the shell's shared components
        for part in ["window.interestingSite = {", "lightbox: lightbox,",
                     "function lightbox(options)", "One lightbox, shared"]:
            with self.subTest(part=part):
                self.assertIn(part, helper)
        # And it is documented where a reader of the shell would be standing, in all three places.
        self.assertIn("window.interestingSite.lightbox", self.source["_includes/layout.njk"])
        readme = (self.repo / "README.md").read_text(encoding="utf-8")
        self.assertIn("### The lightbox", readme)
        self.assertIn("window.interestingSite.lightbox", readme)
        prompt = mi.build_prompt([("index.html", "<h1>hi</h1>")])
        self.assertIn("window.interestingSite.lightbox(", prompt)
        self.assertIn(f"{mi.SASS_DIR}/_lightbox.scss", prompt)

    def test_the_paint_is_written_once_and_reaches_every_page(self):
        partial = self.source[f"{mi.SASS_DIR}/_lightbox.scss"]
        for rule in [".lightbox-veil", "@keyframes lightbox-veil", "[data-lightbox-front]",
                     "[data-lightbox-aside]"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, partial)
        # Through the one stylesheet every page links, like every other shared partial.
        self.assertIn("@use 'lightbox'", self.source["css/site.scss"])
        self.assertIn(".lightbox-veil{", self.site[mi.SHARED_STYLESHEET])
        # One blur, one dim, one fade, in one file: the two dialogs paint nothing behind themselves.
        for rel in [f"{mi.SASS_DIR}/_persona.scss", f"{mi.SASS_DIR}/_controls.scss"]:
            with self.subTest(rel=rel):
                sheet = self.source[rel]
                self.assertEqual(sheet.count("::backdrop"), 1, "one backdrop rule, and it is empty")
                backdrop = sheet[sheet.index("::backdrop {"):]
                backdrop = backdrop[:backdrop.index("}")]
                self.assertIn("background: transparent", backdrop,
                              "the shared veil is what dims the page behind a dialog")
        # And the veil's own blur is named in exactly one place in the whole site.
        blurred = sorted(rel for rel, content in self.source.items()
                         if rel.endswith((".scss", ".css")) and "saturate(70%)" in content)
        self.assertEqual(blurred, [f"{mi.SASS_DIR}/_lightbox.scss"])

    def test_the_veil_goes_over_either_mark_and_under_the_skip_link(self):
        """The layers, read off the stylesheet a browser is served (there is no browser here).

        The whole claim of one shared lightbox rests on this: the veil has to sit over *both* marks,
        because either one of them opens it and the other has to go under it, and the one that is
        open has to be lifted back over the veil. The skip link stays above everything, as its own
        comment in _nav.scss says.
        """
        css = Stylesheet(self.site[mi.SHARED_STYLESHEET], 1280, 900)
        layer = lambda selector: css.px(css.value(selector, "z-index"), ":root")  # noqa: E731
        veil = layer(".lightbox-veil")
        front = layer("html [data-lightbox-front]")
        self.assertGreater(veil, layer(".sparknav"), "the logo goes under the veil the sheet raises")
        self.assertGreater(veil, layer(".persona"), "and the avatar under the one the logo raises")
        self.assertGreater(front, veil, "and whichever one is open comes back over it")
        self.assertGreater(layer(".skip-link"), front, "the skip link is above whatever is open")
        # The two fallback boxes, for a browser with no dialog.showModal(): in front of the veil,
        # and the question in front of the sheet, because a control in the sheet is what asks it.
        self.assertEqual(layer(".persona-sheet-fallback[open]"), front)
        self.assertGreater(layer(".are-you-sure-fallback[open]"), front)

    def test_every_page_carries_the_one_veil_and_nothing_raises_it_without_a_script(self):
        for page in sorted(mi.html_pages(self.site)):
            with self.subTest(page=page):
                self.assertIn("<div class='lightbox-veil' id='lightbox-veil' hidden></div>",
                              self.site[page])
                self.assertEqual(self.site[page].count("id='lightbox-veil'"), 1, "exactly one")
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_shell_the_scripts_and_the_harness_agree_on_every_id(self):
        shell = self.source["_includes/layout.njk"]
        scripts = self.source["js/site.js"] + self.source["js/persona.js"]
        harness = (Path(mi.__file__).resolve().parent / "lightbox_harness.mjs").read_text()
        for name in self.IDS:
            with self.subTest(id=name):
                quoted = "['\"]" + re.escape(name) + "['\"]"
                self.assertIn(f"id='{name}'", shell, "the shell has to write it")
                self.assertRegex(scripts, quoted, "a script has to look for it")
                self.assertRegex(harness, quoted, "the harness has to stand in for it")

    # ---- what the three callers do -----------------------------------------------------------

    def test_nothing_is_under_a_veil_until_something_raises_one(self):
        seen = self.seen()["atRest"]
        self.assertIsNone(seen["look"]["name"])
        self.assertFalse(seen["look"]["veil"])
        self.assertEqual(seen["frameRan"], 1, "the page's frame loop runs untouched")
        for name, state in seen["look"]["body"].items():
            with self.subTest(element=name):
                self.assertFalse(state["marked"])
                self.assertFalse(state["front"])
                self.assertFalse(state["inert"])

    def test_the_logo_and_the_persona_open_the_very_same_lightbox(self):
        # The issue itself, in one assertion: the same veil element, the whole of the rest of the
        # page behind it, and exactly one thing in front -- whichever of the two was pressed.
        seen = self.seen()["theSameLightboxEitherWay"]
        self.assertEqual(seen["nav"]["veilId"], "lightbox-veil")
        self.assertEqual(seen["persona"]["veilId"], seen["nav"]["veilId"])
        self.assertTrue(seen["nav"]["veil"] and seen["persona"]["veil"])
        self.assertEqual(seen["nav"]["front"], ["sparknav"])
        self.assertEqual(seen["persona"]["front"], ["persona-sheet"])
        # Each one puts the other away, which is what makes the two marks one piece of chrome: the
        # avatar goes behind the veil the logo raises, and the logo behind the veil the sheet does.
        self.assertIn("persona", seen["nav"]["behind"])
        self.assertIn("sparknav", seen["persona"]["behind"])
        # And everything else on the page is behind it either way, the same list either way.
        shared = {"main-content", "page", "skip-link", "persona"}
        for side in ("nav", "persona"):
            with self.subTest(side=side):
                self.assertTrue(shared.issubset(set(seen[side]["behind"]) | {"persona"}))

    def test_each_caller_dims_holds_and_puts_aside_the_same_way(self):
        for scenario in self.EVERY_CALLER:
            seen = self.seen()[scenario]
            with self.subTest(scenario=scenario):
                open_ = seen["open"]["look"]
                self.assertTrue(open_["veil"], "the veil is up")
                self.assertIn(open_["name"], ("nav", "persona"))
                front = [name for name, state in open_["body"].items() if state["front"]]
                self.assertEqual(len(front), 1, "one thing in front of the veil, and one only")
                for name, state in open_["body"].items():
                    if name == front[0] or name == "lightbox-veil":
                        continue
                    with self.subTest(element=name):
                        self.assertTrue(state["inert"], f"{name} is still reachable behind the veil")
                        self.assertEqual(state["ariaHidden"], "true")
                        self.assertTrue(state["marked"], "and marked, so it can be given back")
                # Issue #70's third answer, for the persona as much as for the nav: yes, the page's
                # requestAnimationFrame loop is held while it is open.
                self.assertEqual(seen["open"]["frameRan"], 0, "a frame ran behind the veil")
                # And the page comes back exactly as it was, with the held frame run and not dropped.
                closed = seen["closed"]["look"]
                self.assertIsNone(closed["name"])
                self.assertFalse(closed["veil"])
                self.assertEqual(seen["closed"]["frameRan"], 1)
                for name, state in closed["body"].items():
                    with self.subTest(element=name):
                        self.assertFalse(state["inert"])
                        self.assertIsNone(state["ariaHidden"])
                        self.assertFalse(state["marked"])
                        self.assertFalse(state["front"])

    def test_the_sheet_really_opens_and_closes_around_it(self):
        # The veil is worth nothing if the sheet it is behind never opened: the same scenario has
        # to show the dialog open while the lightbox is up and shut when it comes down.
        seen = self.seen()["whenTheSheetOpens"]
        self.assertTrue(seen["open"]["sheetOpen"])
        self.assertEqual(seen["open"]["look"]["name"], "persona")
        self.assertFalse(seen["closed"]["sheetOpen"])

    def test_the_question_asked_over_the_sheet_leaves_the_sheet_where_it_was(self):
        # The one case that only exists because they are shared: "seed a small sky" over a placed
        # sky asks the shared question, so one lightbox opens over another. The veil never drops,
        # the frame loop stays held, and answering hands the sheet back to the front.
        seen = self.seen()["whenTheQuestionIsAskedOverTheSheet"]
        self.assertEqual(seen["sheetUp"]["name"], "persona")
        self.assertTrue(seen["sheetUp"]["body"]["persona-sheet"]["front"])

        asked = seen["asked"]["look"]
        self.assertEqual(asked["name"], "are-you-sure", "the question is what is up now")
        self.assertTrue(asked["veil"], "and the veil never flickers between the two")
        self.assertTrue(asked["body"]["are-you-sure"]["front"])
        self.assertTrue(asked["body"]["persona-sheet"]["inert"], "the sheet is behind the question")
        self.assertFalse(asked["body"]["persona-sheet"]["front"])
        self.assertEqual(seen["asked"]["frameRan"], 0, "and the loop stays held across the two")
        self.assertIn("seed a fresh sky", seen["asked"]["question"])

        answered = seen["answered"]["look"]
        self.assertEqual(answered["name"], "persona", "the sheet's own lightbox is back on top")
        self.assertTrue(answered["veil"])
        self.assertTrue(answered["body"]["persona-sheet"]["front"], "and the sheet is live again")
        self.assertFalse(answered["body"]["persona-sheet"]["inert"])
        self.assertEqual(seen["answered"]["frameRan"], 0, "with the page still behind the veil")
        self.assertIn("Kept as it was", seen["answered"]["status"], "and the answer was no")

        # Then closing the sheet gives the whole page back: nothing is left under a stale veil.
        self.assertIsNone(seen["closed"]["name"])
        self.assertFalse(seen["closed"]["veil"])
        for name, state in seen["closed"]["body"].items():
            with self.subTest(element=name):
                self.assertFalse(state["inert"])
                self.assertFalse(state["front"])

    def test_the_question_asked_from_a_page_raises_the_same_veil(self):
        # The fifth answer of the issue -- "if that makes sense, yes" -- for the ordinary case: a
        # control on a page presses, and the question is asked over the same dimmed, held page.
        seen = self.seen()["whenTheQuestionIsAskedFromAPage"]
        self.assertEqual(seen["asked"]["look"]["name"], "are-you-sure")
        self.assertTrue(seen["asked"]["look"]["veil"])
        self.assertTrue(seen["asked"]["look"]["body"]["are-you-sure"]["front"])
        self.assertEqual(seen["asked"]["frameRan"], 0)
        self.assertEqual(seen["said"], "yes", "the confirm button still confirms")
        self.assertIsNone(seen["answered"]["look"]["name"])
        self.assertFalse(seen["answered"]["look"]["veil"])
        self.assertEqual(seen["answered"]["frameRan"], 1)
        # The control the question was asked from was inert a moment ago, so the lightbox has to
        # come down before the focus goes back to it (WCAG 2.4.3 Focus Order).
        self.assertEqual(seen["focused"], 1)

    def test_a_press_on_the_veil_dismisses_whatever_is_on_top(self):
        seen = self.seen()["whenTheVeilIsPressed"]
        for side in ("nav", "persona"):
            with self.subTest(side=side):
                self.assertFalse(seen[side]["open"], "the thing in front put itself away")
                self.assertIsNone(seen[side]["look"]["name"])
                self.assertFalse(seen[side]["look"]["veil"])

    def test_something_drawn_while_a_lightbox_is_up_goes_behind_it(self):
        # The three affordances the constellation adopts arrive from deferred scripts, and one may
        # arrive while the persona sheet is open, where the nav is watching nothing. That is the
        # lightbox's business now, so the lightbox watches the body itself.
        seen = self.seen()["whenSomethingArrivesLate"]
        self.assertTrue(seen["inert"], "a control drawn behind the veil is still reachable")
        self.assertEqual(seen["ariaHidden"], "true")
        self.assertEqual(seen["look"]["name"], "persona", "and the sheet is still the one up")
        self.assertTrue(seen["look"]["body"]["persona-sheet"]["front"])

    def test_a_site_whose_shared_component_has_gone_still_opens_the_sheet(self):
        # The same bargain NavTest makes about a shell with no nav: the persona borrows a veil from
        # js/site.js, and a half-rewritten js/site.js must not be able to take the sheet with it.
        seen = self.seen()["withoutTheSharedComponent"]
        self.assertTrue(seen["opened"], "the sheet still opens")
        self.assertTrue(seen["closed"], "and still closes")
        self.assertFalse(seen["veil"], "with no veil behind it, which is the only thing lost")
        self.assertIsNone(seen["lightbox"])


class RealSiteTest(unittest.TestCase):
    """The site in this repository obeys all nine axioms: every page is reachable from the root,
    every page carries the analytics tag and consent banner, every page is responsive and
    accessible, every page carries the local-state store and its meta menu, no page ties the site
    to an update frequency, every page asks before it offers, every page carries a visitor's way
    of steering the site, no control throws a visitor's saved state away without the shared warning
    button and its confirmation, and every world is a puzzle a visitor can solve.

    validate_plan only refuses what a run breaks, so the invariants have to start out true: this is
    what makes them hold from the next deploy onward and not only for pages a later run adds. It
    runs on every pull request and on main before each deploy, so a hand-written commit that
    orphans a page, drops the tag or makes a page inaccessible is caught there too, and the deploy
    is blocked (open question 5 of issue #26: fail, not warn -- a warning in an hourly log nobody
    reads changes nothing).
    """

    # What deploy.yml replaces with the GA_MEASUREMENT_ID repository secret on the way to S3.
    # Spelled out here rather than imported, so renaming it in one place fails here.
    GA_PLACEHOLDER = "__GA_MEASUREMENT_ID__"

    # The real site is read and built once for the whole class. Every test below only reads the
    # two mappings -- a test that wants damaged source builds its own copy with dict(self.site,
    # ...) -- and a build is a whole Node run, so building per test spent minutes of the job's
    # five-minute budget rendering the same site forty times over.
    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        site = cls.repo / "site"
        if not site.is_dir():
            raise unittest.SkipTest(f"no site directory at {site}")
        needs_the_build()
        patcher = mock.patch.object(mi, "SITE_DIR", site)
        patcher.start()
        cls.addClassCleanup(patcher.stop)
        cls.source = dict(mi.read_site())
        cls.site = mi.build_site(cls.source)

    def test_every_page_is_reachable_from_the_root_and_listed_in_the_sitemap(self):
        self.assertEqual(mi.unreachable_pages(self.site), {})
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_every_world_is_a_piece_a_visitor_can_finish(self):
        # The completion axiom, on the site as committed: every world the layout lists has a module
        # with a piece, and the harness plays every one of them to its end for every seed it tries.
        needs_the_piece_harness(self)
        worlds = mi.listed_worlds(self.site)
        self.assertGreaterEqual(len(worlds), 10, "the check is worth nothing on a few worlds")
        self.assertEqual(mi.worlds_without_a_finish(self.site), {})

    def test_every_world_opens_its_cards_as_its_features(self):
        # The alignment axiom on the site as committed (issue #80): the piece harness plays each
        # world's first seed as the card that configuration deals it and as a card another seed was
        # dealt, and the two have to be different pieces -- a world that opened the same feature
        # whichever of its cards was pressed is the bug the axiom keeps out. The law needs two cards
        # to tell apart, so this asks for that too: a world whose spark deals every seed the same
        # content would pass it vacuously, and would be a world whose cards do not vary either.
        needs_the_piece_harness(self)
        report = mi.run_piece_harness(self.site)
        self.assertGreaterEqual(len(report), 10, "the check is worth nothing on a few worlds")
        for world, entry in sorted(report.items()):
            alignment = entry.get("alignment") or {}
            with self.subTest(world=world):
                self.assertTrue(alignment.get("hasSpark"), "this world deals no cards at all")
                self.assertTrue(alignment.get("tested"),
                                "this world deals every seed the same card, so nothing could be told apart")
                self.assertTrue(alignment.get("follows"),
                                f"this world opens the same feature whether its card said "
                                f"{alignment.get('card')!r} or {alignment.get('other')!r}")

    def test_the_stage_plays_the_site_as_committed(self):
        # The other half of the completion axiom, on the site as committed: the real js/stage.js,
        # run through a stub browser (issue #60). A world is dealt, another is played, the first is
        # dealt again, and every round has to finish and -- once the visitor presses the way on,
        # because nothing advances by itself any more (issue #78) -- open the next; a slider a
        # visitor leaves where it stands has to count as used; a knob nobody set has to be named
        # rather than silently holding the piece shut; a hold has to be set when its bar fills
        # rather than when the visitor lets go (issue #74); a finished piece has to stay fully
        # playable, with the done mark clear of its picture (issue #86); a piece that is over has
        # to leave nothing running; and a card pressed has to open as that card rather than as the
        # world's generic line (issue #80).
        needs_the_stage_harness(self)
        worlds = mi.listed_worlds(self.site)
        self.assertGreaterEqual(len(worlds), 10, "the check is worth nothing on a few worlds")
        report = mi.run_stage_harness(self.site, deal=[worlds[0], worlds[1], worlds[0]])
        for name, got in report.items():
            self.assertTrue(got.get("ok"), f"the {name} scenario did not run: {got.get('error')}")
        rounds = report["rounds"]["result"]
        self.assertEqual([r["was"]["file"] for r in rounds["rounds"]], [worlds[0], worlds[1], worlds[0]])
        for played in rounds["rounds"]:
            with self.subTest(world=played["was"]["file"], seed=played["was"]["seed"]):
                self.assertTrue(played["playable"])
                self.assertEqual(played["unset"], [])
                self.assertTrue(played["checkOffered"], "every knob was set and no check was offered")
                self.assertTrue(played["solved"], "the module's own solution did not solve its piece on the stage")
                self.assertEqual(played["doneText"], "solved")
                self.assertFalse(played["movedOnByItself"],
                                 "the stage opened the next piece with nobody pressing anything")
                self.assertTrue(played["litWhenFinished"], "the ceremony ended and the way on never lit")
                self.assertEqual(played["focusedWhenFinished"], "stage-next",
                                 "the way on lit and the keyboard was left wherever it was")
                self.assertTrue(played["movedOn"], "the way on was pressed and nothing followed")
        # Done is not the End (issue #86), on the site as committed. What can be held of every
        # world's piece without knowing which piece it is, is held: the frames still drawing a
        # second after the ceremony is long over, every knob still enabled, nothing of the piece
        # torn down, the done mark clear of the scene, the ceremony played once through all of it,
        # and the way on still the one thing that takes the piece away.
        live = report["afterDone"]["result"]
        self.assertTrue(live["playable"], f"{live['world']}: the piece never became playable")
        self.assertEqual(live["unset"], [], f"{live['world']}: a knob the visitor worked was not set")
        self.assertEqual(live["atDone"]["mode"], "done", f"{live['world']}: the piece never finished")
        self.assertGreater(live["drawing"]["frames"], live["later"]["frames"],
                           f"{live['world']}: the frame loop stopped when the piece finished")
        for when in ["atDone", "later", "drawing", "afterKnob", "afterTap"]:
            with self.subTest(when=when):
                seen = live[when]
                self.assertTrue(all(knob["live"] for knob in seen["knobs"]),
                                f"{live['world']}: a knob went inert on a finished piece")
                self.assertEqual(seen["mode"], "done", f"{live['world']}: the stage left the piece's mode")
                self.assertEqual(seen["completes"], 1, f"{live['world']}: the piece finished other than once")
                self.assertTrue(seen["doneShown"], f"{live['world']}: nothing said the piece was done")
                self.assertFalse(seen["doneOverScene"],
                                 f"{live['world']}: the done mark is laid over the piece's own picture")
                # One dot per knob the check waits for: an optional hint is not a dot.
                self.assertEqual(seen["dots"], sum(1 for knob in live["atDone"]["knobs"] if not knob.get("optional")),
                                 f"{live['world']}: the dots went away with the finish")
        self.assertTrue(live["reworked"], f"{live['world']}: no knob on this piece could be worked again")
        self.assertEqual(live["current"]["file"], live["world"], "the stage left the finished piece")
        self.assertGreater(live["running"], 0, f"{live['world']}: nothing was left running for a live piece")
        self.assertTrue(live["onward"]["movedOn"], f"{live['world']}: the way on was pressed and nothing followed")
        used = report["sliderUsed"]["result"]
        self.assertTrue(used["ranges"], "no world the stage opened had a slider to check")
        self.assertEqual(used["unset"], [], f"{used['world']}: a slider used where it stood was not taken")
        self.assertTrue(used["checkOffered"], f"{used['world']}: every knob set and no check offered")
        self.assertTrue(used["judged"], f"{used['world']}: the check was pressed and no verdict given")
        left = report["sliderUntouched"]["result"]
        self.assertFalse(left["finished"], "a piece finished with a knob nobody set")
        self.assertFalse(left["checkOffered"], "the check was offered with a knob nobody set")
        self.assertTrue(left["wanted"], "the stage said nothing about the knob it was waiting on")
        # The puzzle axiom on the site as committed: a wrong answer is refused and the right one
        # solves, through the stage's own controls, for the first world the deal opens.
        puzzle = report["wrongThenRight"]["result"]
        self.assertTrue(puzzle["playable"], f"{puzzle['world']}: the piece never became playable")
        self.assertTrue(puzzle["answers"], f"{puzzle['world']}: the piece declares no answer")
        self.assertTrue(puzzle["opened"]["goal"], f"{puzzle['world']}: the stage showed no goal line")
        self.assertEqual(puzzle["unset"], [], f"{puzzle['world']}: a knob the visitor worked was not set")
        self.assertTrue(puzzle["wrongChecked"], f"{puzzle['world']}: the check could not be pressed")
        self.assertNotEqual(puzzle["afterWrong"]["mode"], "done", f"{puzzle['world']}: a wrong answer solved it")
        self.assertEqual(puzzle["afterWrong"]["completes"], 0, f"{puzzle['world']}: a wrong answer played the ceremony")
        self.assertEqual(puzzle["afterWrong"]["verdict"], "wrong")
        self.assertTrue(puzzle["afterWrong"]["status"], f"{puzzle['world']}: a wrong check said nothing")
        self.assertTrue(all(knob["live"] for knob in puzzle["afterWrong"]["knobs"]),
                        f"{puzzle['world']}: a wrong answer put a knob out of action")
        self.assertTrue(puzzle["rightChecked"])
        self.assertEqual(puzzle["afterRight"]["mode"], "done", f"{puzzle['world']}: the solution did not solve it on the stage")
        self.assertEqual(puzzle["afterRight"]["completes"], 1)
        self.assertEqual(puzzle["afterRight"]["doneText"], "solved")
        self.assertIn("solved on try 2", puzzle["afterRight"]["tries"])
        self.assertTrue(puzzle["onward"]["movedOn"], f"{puzzle['world']}: the way on was pressed and nothing followed")
        # A hold is a toy's gesture and no puzzle on the site needs one now, so the hold scenario
        # may well find no hold to press; StageTest holds the stage to it with pieces of its own.
        # Where a world does deal one, the rules of issue #74 still apply to it.
        filled = report["holdFilled"]["result"]
        if filled["held"]:
            self.assertTrue(filled["filled"]["set"],
                            f"{filled['world']}: a hold's bar filled and the stage waited for the release")
            for when in ["filled", "kept", "after"]:
                with self.subTest(when=when):
                    self.assertTrue(filled[when]["set"], f"{filled['world']}: the hold stopped being set")
                    self.assertEqual(filled[when]["pct"], "100%", f"{filled['world']}: the bar did not stay full")
                    self.assertNotIn("let go early", filled[when]["status"])
            self.assertEqual(filled["after"]["completes"], filled["filled"]["completes"],
                             f"{filled['world']}: letting go of a hold already set did something of its own")
        torn = report["teardown"]["result"]
        self.assertEqual(torn["waiting"], 0, "the stage left a timer running after the piece")
        self.assertEqual(torn["look"]["knobs"], [])
        self.assertEqual(torn["look"]["sceneLabel"], "the scene")
        # And the alignment axiom on the site as committed (issue #80): a card pressed opens a
        # feature that is that card. While the world's module loads, and on a world with no piece
        # at all, what stands is the card's own title -- never the world's one-line description,
        # which is the same line for every card of it.
        carried = report["carried"]["result"]
        card = carried["card"]
        for when in ["loading", "missingLoading", "missing"]:
            with self.subTest(when=when):
                self.assertEqual(carried[when]["title"], card["title"],
                                 "the stage wrote something other than the card that was pressed")
                self.assertNotEqual(carried[when]["title"], carried["world"]["what"])
        self.assertEqual(carried["loading"]["brief"], card["quote"], "the card's own line was dropped")
        self.assertTrue(carried["playable"], "a card pressed opened no piece")
        self.assertTrue(carried["barePlayable"], "a piece nobody pressed opened nothing")
        # The scene is framed by the configuration the card was wearing, inside the limits no frame
        # on this site leaves (js/variant.js, ASPECT_LIMITS).
        for when in ["opened", "bare"]:
            with self.subTest(when=when):
                ratio = float(carried[when]["aspect"])
                self.assertGreaterEqual(ratio, 0.6)
                self.assertLessEqual(ratio, 1.9)

    def test_a_finished_piece_hands_the_visitor_the_way_on(self):
        # Issue #78: nothing moves on by itself, so every piece ends on one mark the visitor
        # presses. Four things make that trustworthy, and all four are read off the site as
        # committed. It is in the stage's own markup, so every world page and the threshold have
        # it, and it starts out dim; it is not inside #stage-inner, whose transform during the
        # vanish is what a fixed child would be positioned against, so it cannot drift as the
        # piece scales away; the stylesheet pins it to one corner of the viewport rather than
        # laying it out with the knobs, so it is in the same place whatever shape the piece is;
        # and "skip this one" is gone from the whole site, the feed being where a visitor goes
        # for a world of their own choosing.
        stage = self.source[mi.STAGE_INCLUDE]
        self.assertIn("id='stage-next'", stage, "the stage writes no way on")
        mark = stage[stage.index("<button type='button' class='stage-next'"):]
        mark = mark[:mark.index("</button>")]
        self.assertIn("disabled", mark, "the way on starts out lit")
        self.assertIn("aria-label=", mark, "a mark with no words needs a name")
        self.assertNotIn(">Next<", mark, "the mark is a double caret, not a word")
        inner = stage[stage.index("<div class='stage-inner'"):stage.index("id='stage-next'")]
        self.assertEqual(inner.count("<div"), inner.count("</div>"),
                         "the way on is inside #stage-inner, which the vanish transforms")
        css = self.source[f"{mi.SASS_DIR}/_stage.scss"]
        pinned = css[css.index(".stage-next {"):]
        pinned = pinned[:pinned.index("}")]
        for rule in ["position: fixed", "right: var(--nav-inset)", "bottom: var(--nav-inset)"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, pinned, "the way on is not pinned to the lower right")
        for rel, content in sorted(self.source.items()):
            if rel.endswith((".html", ".njk", ".scss", ".js")) and rel not in mi.FIXED_FILES:
                with self.subTest(rel=rel):
                    self.assertNotIn("stage-skip", content, "'skip this one' is still here")
                    self.assertNotIn("skip this one", content, "'skip this one' is still here")
        # And the stage runs it: lit when the ceremony is over, and dim again with every teardown.
        script = self.source[mi.STAGE_SCRIPT]
        self.assertIn("lightTheWayOn(true)", script, "nothing lights the way on when a piece is over")
        self.assertIn("dimTheWayOn()", script, "nothing dims it again")
        self.assertIn("ui.onward.focus(", script, "the way on never takes the keyboard")
        finish = script.split("function finish(say) {", 1)[1].split("\n}", 1)[0]
        self.assertNotIn("next()", finish, "the stage still shows itself out when a piece is finished")

    def test_a_finished_piece_is_not_a_finished_page(self):
        # Issue #86, as a site-wide axiom: a piece of content does not End just because it is Done.
        # The stage harness plays the whole of that on the committed site (afterDone); these are the
        # two things it cannot see, because they are where the markup and the stylesheet put the
        # done mark rather than what the stage then does with it.
        #
        # The mark is not in the scene. It was a 64px disc and a pill pinned over the scene's
        # lower-right corner, on top of the piece's own finale and taking a corner of the picture;
        # it reports from the end of the dots' row instead, where the stage already says how much
        # of the piece is set, and it is laid out there rather than positioned over anything.
        stage = self.source[mi.STAGE_INCLUDE]
        self.assertIn("id='stage-done'", stage, "the stage says nothing when a piece is done")
        scene = stage[stage.index("<div class='stage-scene'"):]
        scene = scene[:scene.index("</div>")]
        self.assertNotIn("stage-done", scene, "the done mark is inside the scene, over the content")
        foot = stage[stage.index("class='stage-foot'"):]
        for beside in ["id='stage-done'", "id='stage-progress'"]:
            with self.subTest(beside=beside):
                self.assertIn(beside, foot, "the done mark does not report beside the progress dots")
        css = self.source[f"{mi.SASS_DIR}/_stage.scss"]
        rule = css[css.index(".stage-done {"):]
        rule = rule[:rule.index("}")]
        for over in ["position: absolute", "position: fixed", "inset: 0", "z-index"]:
            with self.subTest(over=over):
                self.assertNotIn(over, rule, "the done mark is laid over the piece rather than beside it")
        # And finishing takes nothing away: the knobs are not disabled, and a tap on the scene is
        # not turned back, so the piece stays workable until the way on is actually pressed.
        script = self.source[mi.STAGE_SCRIPT]
        finish = script.split("function finish(say) {", 1)[1].split("\n}", 1)[0]
        self.assertNotIn("disabled = true", finish, "finishing a piece puts its knobs out of action")
        taps = script[script.index("ui.canvas.addEventListener('pointerdown'"):]
        taps = taps[:taps.index("\n  });")]
        self.assertNotIn("completed", taps, "a tap on the scene stops reaching a finished piece")
        self.assertIn("tapsOpen()", taps, "nothing decides whether a tap reaches the piece")

    def test_every_world_page_is_the_stage(self):
        # A world page is the stage and nothing else, so what a visitor opens is a piece, not a
        # fixed page; the threshold is the same stage in its asking state.
        for world in mi.listed_worlds(self.site):
            with self.subTest(world=world):
                page = self.site[world]
                self.assertIn("id='stage'", page)
                self.assertIn(f"data-stage-world='{world[:-5]}'", page)
                self.assertIn(mi.STAGE_SCRIPT, page)
        self.assertIn("data-threshold='true'", self.site["index.html"])
        self.assertIn("id='persona-probe'", self.site["index.html"])

    def test_the_list_of_worlds_is_the_one_list(self):
        # The JSON the layout writes for the scripts is rendered from _data/worlds.json, so the
        # stage, the feed, the site map and the mood atlas all name the same worlds.
        data = json.loads(self.source["_data/worlds.json"])
        self.assertEqual(mi.listed_worlds(self.site), [world["file"] for world in data["worlds"]])
        for page in mi.html_pages(self.site):
            with self.subTest(page=page):
                self.assertIn(f"id='{mi.WORLD_LIST_ID}'", self.site[page])

    def test_the_prompt_and_the_harness_agree_on_the_limits(self):
        # The limits the prompt states are the harness's own, repeated in Python for the prompt.
        played = subprocess.run([mi.NODE_BIN, str(mi.PIECE_HARNESS), "--modules",
                                 str(self.repo / "site" / "js" / "modules"), "--json"],
                                capture_output=True, text=True, cwd=self.repo, timeout=120)
        report = json.loads(played.stdout)
        self.assertEqual((report["minSteps"], report["maxSteps"], report["maxTaps"], report["maxSeconds"]),
                         (mi.PIECE_MIN_STEPS, mi.PIECE_MAX_STEPS, mi.PIECE_MAX_TAPS, mi.PIECE_MAX_SECONDS))
        self.assertTrue(report["ok"], [m for m in report["modules"] if not m["ok"]])

    def test_every_page_is_responsive_and_accessible(self):
        # Open question 3 of issue #26: the pages that exist today are audited and held to the rule
        # too, not just the ones a future run writes. This is the check that does the auditing, and
        # it is the reason constellation-diary.html gained its prefers-reduced-motion handling.
        self.assertEqual(mi.inaccessible_pages(self.site), {})
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_check_would_notice_a_real_page_losing_what_makes_it_accessible(self):
        # A guard against the checks quietly becoming no-ops as the site is rewritten around them:
        # take one thing away from the real home page and the check has to say so.
        #
        # The damage is done to the page and to everything it loads, because /site is federated now
        # (issue #25): the focus ring and the reduced-motion rule live in the shared Sass rather
        # than in any one page, so a check that read only the page would find nothing to object to
        # and this guard would pass vacuously. That the check follows a page into its assets is what
        # keeps it meaningful here.
        for damage, reason in [
            (lambda html: re.sub(r"<meta[^>]*viewport[^>]*>", "", html, flags=re.I),
             "has no viewport meta tag with width=device-width"),
            (lambda html: re.sub(r"<html[^>]*>", "<html>", html, count=1, flags=re.I),
             "has no lang attribute on <html>"),
            (lambda html: html.replace("main", "div"), "has no <main> landmark"),
            (lambda html: re.sub(r":focus(-visible|-within)?", ":hover", html),
             "takes the focus outline away without a :focus style of its own"),
            (lambda html: html.replace("prefers-reduced-motion", "prefers-contrast"),
             "animates without honouring prefers-reduced-motion"),
        ]:
            with self.subTest(reason=reason):
                broken = dict(self.site)
                for rel in ["index.html", *mi.assets_of("index.html", self.site)]:
                    broken[rel] = damage(broken[rel])
                self.assertIn(reason, mi.inaccessible_pages(broken).get("index.html", []))

    def test_no_page_ties_the_site_to_an_update_frequency(self):
        # Issue #32, and the audit half of it: the pages that exist today are swept too, not only
        # the ones a future run writes. This is the check that caught "Tonight's experiment" on the
        # home page, "tonight starts fresh" in its storage-failure note, "rewritten every hour" in
        # the sitemap's closing axiom, and the oracle readings that sent a visitor away until
        # tomorrow.
        self.assertEqual(mi.pages_dating_the_site(self.site), {})
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_night_sky_theme_survives_the_cadence_axiom(self):
        # The other side of open question 2: the check has to be narrow enough to leave the theme
        # alone, so this fails if "midnight" is ever read as a schedule and the atmosphere is swept
        # out of the site along with the cadence.
        atmosphere = [rel for rel in self.site if "midnight" in self.site[rel].lower()]
        self.assertGreater(len(atmosphere), 1, f"the night-sky theme has gone: {atmosphere}")

    def test_the_check_would_notice_a_real_page_dating_itself_again(self):
        # A guard against the check quietly becoming a no-op, as with accessibility above: put the
        # phrase this issue removed back on the real home page and the check has to say so.
        for damage, phrase in [("Tonight's experiment: a wish constellation.", "tonight"),
                               ("Rewritten every hour by a model.", "every hour"),
                               ("Move one star tomorrow and ask again.", "tomorrow")]:
            with self.subTest(phrase=phrase):
                dated = dict(self.site, **{"index.html": self.site["index.html"] + f"<p>{damage}</p>"})
                self.assertEqual(mi.pages_dating_the_site(dated), {"index.html": [phrase]})

    # How the mood flow names the world an orientation opens onto, so this test can check that
    # every one of them is a real page and that they are not all sky.
    WORLD = re.compile(r"world:\s*'([a-z0-9][a-z0-9-]*\.html)'")
    SKY = re.compile(r"constellation|sky|star|orbit|wish")

    def worlds(self):
        return set(self.WORLD.findall(self.site[mi.MOOD_SCRIPT]))

    def test_every_page_carries_the_mood_flow(self):
        # Issue #30: the site asks before it offers, on every page, not only at the front door --
        # the flow is ongoing, which is what "the whole site transmogrifies" needs.
        self.assertIn(mi.MOOD_SCRIPT, self.site, "the file behind the one line has to be there")
        self.assertEqual(mi.pages_missing_mood(self.site), set())
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_site_keeps_a_wide_library_of_ways_to_ask(self):
        # "Never the same way twice" is only true while there are ways to spare, and the issue asks
        # for the library to be wildly varied rather than merely present.
        self.assertGreaterEqual(len(mi.probe_mechanisms(self.site)), mi.MIN_MOOD_PROBES)

    def test_no_page_asks_a_visitor_to_report_their_own_mood(self):
        self.assertEqual(mi.pages_asking_to_self_report(self.site), {})

    # The one file of the site's own that may name one of those classes, and the one thing it may
    # do with it: the shared shell finds all three of the controls the fixed files pin over the
    # page, hides them where their own files put them, and presses them from the logo's
    # constellation (issues #54 and #64). Nothing else may take those names.
    ADOPTS_THREE = "js/site.js"

    def test_the_site_leaves_the_corner_affordances_their_own_class_names(self):
        # js/state.js draws the export/import menu and js/participate.js the "steer the site"
        # link, each injecting the styles for its own, and the prompt says in as many words that
        # neither is the site's to restyle. Every name they use is site-meta* or site-steer*, so a
        # template or stylesheet of the site's own that mentions one is either restyling them or
        # colliding with them. That is not hypothetical: the header's pulse arrived as
        # <p class='site-meta'>, which the menu's own `position: fixed` then tore out of the header
        # and pinned over the menu in the bottom-right corner.
        # Either form that actually takes one of those names: a selector, or a class written onto an
        # element. Prose about them is neither, so the comments that explain this rule -- in the
        # layout, the nav's Sass and js/site.js -- do not trip it.
        for prefix in ["site-meta", "site-steer"]:
            with self.subTest(prefix=prefix):
                theirs = re.compile(rf"\.{prefix}\b"
                                    rf"|class(?:Name)?\s*[=:]\s*'[^']*\b{prefix}\b"
                                    rf"|class(?:Name)?\s*[=:]\s*\"[^\"]*\b{prefix}\b")
                claiming = sorted(rel for rel, content in self.source.items()
                                  if rel not in mi.FIXED_FILES and rel != self.ADOPTS_THREE
                                  and theirs.search(content))
                self.assertEqual(claiming, [])

    def test_the_shell_may_find_the_three_it_adopts_and_nothing_more(self):
        # What the one exception above is allowed to be: a selector in a string, used to find the
        # control its own file pinned over the page, hide it there and press it from the
        # constellation. Not a class written onto anything of the shell's own, and not a rule in a
        # stylesheet: the look of all three stays entirely theirs.
        shell = self.source[self.ADOPTS_THREE]
        self.assertIn("'.site-meta-open'", shell, "the state menu's own button, to press it")
        self.assertIn("'.site-consent-link'", shell, "the consent banner's")
        self.assertIn("'.site-steer'", shell, "and the link js/participate.js draws")
        self.assertNotRegex(shell, r"class(?:Name)?\s*[=:]\s*['\"][^'\"]*\bsite-(?:meta|steer)\b")

    def test_every_orientation_opens_onto_a_real_world_and_not_all_of_them_are_sky(self):
        # The whole point of the issue: a visitor who does not respond to stars still arrives
        # somewhere that suits them. A world named by the flow has to be a page that exists, and
        # enough of them have to be off the sky for the answer to mean anything.
        worlds = self.worlds()
        self.assertGreaterEqual(len(worlds), 10, "too few orientations to be choosing between")
        for world in sorted(worlds):
            with self.subTest(world=world):
                self.assertIn(world, self.site, "an orientation opens onto a page that is not there")
        off_sky = {world for world in worlds if not self.SKY.search(world)}
        self.assertGreaterEqual(len(off_sky), 6,
                                f"the sky is still nearly all there is on offer: {sorted(worlds)}")

    def test_the_one_list_of_worlds_is_flat_and_every_world_is_whole(self):
        # One flat list, no sky and off-sky groups: a world is a world. Every entry on it is a page
        # that exists, has a module for the feed to paint and deal from, and wears a mood that
        # _mood.scss knows; and the mood flow names no world the list does not. A world need not
        # be offered by an orientation to be on the list -- the feed reaches every world, and a
        # run adds an orientation only if the world is to be offered -- so the flow's worlds are
        # a subset of the list, not the list.
        listed = json.loads((self.repo / "site" / "_data" / "worlds.json").read_text())
        self.assertIn("worlds", listed)
        for group in ("offSky", "underSky"):
            self.assertNotIn(group, listed, "the sky categories are gone")
        moods = set(re.findall(r"^\s+([a-z]+):\s*\(#", self.source["_sass/_mood.scss"], re.M))
        self.assertGreaterEqual(len(moods), 10)
        files = set()
        for world in listed["worlds"]:
            with self.subTest(world=world.get("file")):
                for key in ("file", "name", "orientation", "mood", "aspect", "what"):
                    self.assertIn(key, world)
                self.assertIn(world["file"], self.site, "a listed world is a page that exists")
                self.assertIn("js/modules/" + world["file"].replace(".html", ".js"), self.site,
                              "a listed world has a feed module")
                self.assertIn(world["mood"], moods, "a listed world wears a mood the Sass knows")
                files.add(world["file"])
        self.assertLessEqual(self.worlds(), files, "the mood flow names no world the list does not")

    def test_the_site_theme_follows_the_card_that_was_picked(self):
        # Issue #61: pressing a card features that world's piece on the stage, so the site's own
        # colour has to become that card's. It did not: a visitor with a reading kept the reading's
        # palette whatever they pressed, because the reading is written after the page's own world
        # in _mood.scss and nothing outranked either of them, while the card itself was painted in
        # its world's colours -- the mismatch the issue reports. Four things make it true now, and
        # each is checked where it lives rather than taken on trust.
        #
        # One: the precedence, read off the built stylesheet rather than the source, because equal
        # specificity is settled by order and the order that settles it is the one a browser reads.
        css = self.site["css/site.css"]
        order = [css.find(f":root[data-{name}=tender]") for name in ("world", "mood", "featured")]
        self.assertNotIn(-1, order, f"the three palettes on :root are not all in the stylesheet: {order}")
        self.assertEqual(order, sorted(order),
                         "a featured activity has to be written last to outrank the visitor's reading")
        moods = set(re.findall(r"^\s+([a-z]+):\s*\(#", self.source[f"{mi.SASS_DIR}/_mood.scss"], re.M))
        self.assertGreaterEqual(len(moods), 10)
        for mood in sorted(moods):
            # Every mood is featurable, or picking the card of a world that wears it changes nothing.
            with self.subTest(mood=mood):
                self.assertIn(f":root[data-featured={mood}]", css)
        # Two: the stage features the world it opens, and stops featuring it on the way home -- so a
        # piece is what the site wears while it is on the stage, and the reading has the site back
        # after it, rather than one pressed card re-skinning the site for good.
        stage = self.source[mi.STAGE_SCRIPT]
        self.assertIn("feature(world.mood, opts.seeds, variant)", stage, "the stage features no world")
        self.assertIn("root.dataset.featured = mood", stage, "nothing writes the featured mood")
        self.assertIn("delete root.dataset.featured", stage, "nothing stops being featured")
        home = stage.split("function goHome() {", 1)[1].split("\n}", 1)[0]
        self.assertIn("unfeature()", home, "going home leaves the last piece's palette on the site")
        # Three: the four seeds and no more. --fg and --muted are what hold the site's text at
        # 4.5:1 over all fifteen palettes, so a theme that follows a card may never carry them off.
        self.assertIn("const SEEDS = ['bg', 'bg2', 'accent', 'accent2'];", stage)
        for held in ("--fg", "--muted"):
            with self.subTest(seed=held):
                self.assertNotIn(f"setProperty('{held}'", stage)
        # Four: it is the card's colour and not merely its world's. A card the feed dealt wears the
        # four seeds its own configuration derived (js/variant.js), and those are what the stage is
        # handed -- both for a card pressed and for the next one off the stack when a piece ends.
        feed = self.source["js/feed.js"]
        self.assertRegex(feed, r"interestingStage\.open\(file, seed, \{[^}]*\bseeds\b",
                         "a pressed card hands the stage no palette")
        self.assertRegex(feed, r"seeds: palette\(card, m\)",
                         "the next card off the stack hands the stage no palette")
        # And a piece with no card behind it is painted in the palette its own configuration
        # derives inside its mood, by the same arithmetic that derived the card's (issue #80), so
        # the colour follows the configuration whether or not anything was pressed.
        self.assertIn("someSeeds(recolor(own, variant))", stage,
                      "a piece nobody pressed is not painted in the colour its configuration derives")

    def test_the_feature_a_card_opens_as_is_that_card(self):
        # The alignment axiom (issue #80): every content piece on this site is procedurally
        # configured, and that configuration is the same whether the piece appears as a card in the
        # feed or as the feature it opens as. It was not: the card handed the stage its file, its
        # seed and its four palette seeds, and nothing else, so the feature was titled by the
        # world's one-line description -- the same line for every card of that world, which is the
        # generic text the cards fell back to. Three things make it true, and each is checked where
        # it lives; the stage harness plays the rest (the "carried" scenario).
        #
        # One: the whole configuration leaves the feed with the card, both for a card a visitor
        # pressed and for the next one off the stack when a piece ends.
        feed = self.source["js/feed.js"]
        self.assertRegex(feed, r"interestingStage\.open\(file, seed, \{[^}]*\bvariant\b[^}]*\bcard\b",
                         "a pressed card hands the stage neither its configuration nor its content")
        self.assertRegex(feed, r"variant: m\.variant, card: shown\(m\)",
                         "the next card off the stack hands the stage no configuration")
        self.assertIn("function shown(m)", feed, "nothing reads what a card is showing")
        # Two: the stage exposes both on the env it hands a world's module, the way the feed does
        # on a card's, and frames the scene by the same stretch the card's frame was stretched by.
        stage = self.source[mi.STAGE_SCRIPT]
        env = stage.split("function makeEnv(", 1)[1].split("\n}", 1)[0]
        self.assertIn("variant: variant || PLAIN", env, "a piece is handed no configuration")
        self.assertIn("card: card || null", env, "a piece is handed no card")
        self.assertIn("revive(opts.variant, seed)", stage,
                      "the stage does not revive the configuration a card handed it")
        self.assertIn("framed(piece.aspect", stage, "the scene is not framed as the card was")
        self.assertIn("from './variant.js'", stage,
                      "the stage keeps a configuration of its own rather than the site's one file")
        # Three: the world's one line is never a feature's title. It is the one thing every card of
        # a world says, so writing it while a module loads, or when a world has no piece, is exactly
        # the bug: the card's own title stands there instead (heading() in the stage). The line keeps
        # its one honest use -- a page with no card to speak for it, which says the same thing in its
        # quiet state -- so what is checked is every line that writes the title.
        self.assertIn("function heading(world, card)", stage, "nothing writes the card's own title")
        titles = [line for line in stage.splitlines() if "ui.title.textContent =" in line]
        self.assertTrue(titles, "nothing on the stage writes a title at all")
        for line in titles:
            with self.subTest(line=line.strip()):
                self.assertNotIn("world.what", line,
                                 "the stage still titles a feature with the world's generic line")
        # And every world's module says what its cards are of, so its piece can open on that very
        # thing rather than rolling another (the piece harness holds each one to it). `of` may be
        # written out as an object or be the plan the card was dealt from (`of: p`, as the pulse
        # loom and the gravity well hand theirs over): what it holds is the harness's to judge.
        for rel, text in sorted(self.source.items()):
            if not rel.startswith("js/modules/"):
                continue
            with self.subTest(module=rel):
                self.assertIn("env.card", text, "this world's piece ignores the card it opens from")
                self.assertRegex(text, r"\bof:\s*[\w{]", "this world's cards say nothing about what they are of")

    # The viewport the screenshot on issue #65 was taken at -- a 14-inch MacBook Pro is 1512 CSS
    # pixels wide, and about 850 tall with the browser's own chrome off the top of it -- and three
    # more desktops: a laptop, a large monitor, and a tall screen where the width runs out first.
    DESKTOPS = [(1512, 850), (1280, 800), (1920, 1080), (1512, 1200)]

    # Every aspect ratio a world writes its pieces in. The squarer ones are the whole of issue #65:
    # a piece narrower than the column it was given is what left a band of empty page behind.
    PIECE_ASPECTS = ["16 / 9", "16 / 10", "5 / 3", "4 / 3", "1 / 1", "4 / 5", "3 / 4"]

    # And the frames the stage can write over those: a piece's own ratio, stretched by the
    # configuration the card it opened from was wearing (the alignment axiom, issue #80). That
    # arrives as a bare number rather than "a / b", and js/variant.js clamps it to ASPECT_LIMITS,
    # so the two limits are the squarest and the widest scene the stage can ask the sheet for.
    STRETCHED = ["0.6", "1.9"]

    def test_the_stage_fills_the_real_estate_the_first_screen_has(self):
        # Issue #65: on the wish constellation, whose pieces are 4/3, a band of empty page sat
        # between the scene and the knobs. Two things left it there. The scene was as wide as its
        # own height allowed at the piece's ratio but pinned to the start of a column sized 1fr, so
        # whatever that column had over was nobody's; and the height it was allowed came off a flat
        # 19rem guess at everything above and below it, about 90px more than the first screen owes.
        #
        # Both are checked here against the built stylesheet rather than the Sass, because the
        # cascade that settles them is the one a browser is served (Stylesheet reads that cascade).
        # First, that the ratios above are the ones the worlds are actually written in, so this is a
        # check of the site and not of a list that has drifted away from it.
        written = set(re.findall(r"aspect:\s*\'([^\']+)\'", "".join(
            text for rel, text in self.source.items() if rel.startswith("js/modules/"))))
        self.assertTrue(written, "no piece names an aspect ratio: the ratios below check nothing")
        self.assertEqual(written - set(self.PIECE_ASPECTS), set(), "a ratio no case here covers")
        for width, height in self.DESKTOPS:
            sheet = Stylesheet(self.site["css/site.css"], width, height)
            # The scene's column is the scene's own width, and the knobs take every pixel of the row
            # it does not: without the 1fr it would be the knobs' turn to leave the band.
            tracks = Stylesheet.parts(sheet.value(".stage-body", "grid-template-columns"))
            self.assertEqual(tracks[0], "var(--stage-scene)", "the scene's column is not the scene")
            self.assertTrue(tracks[-1].endswith("1fr)"), f"the knobs take no slack: {tracks}")
            self.assertEqual(sheet.value(".stage-scene", "width"), "100%",
                             "the scene does not fill the column it was given")
            # main's own centred column (_panel.scss), and the first screen less the feed's peek.
            column = min(sheet.px(sheet.var("--page-max", ":root"), ":root"), width - 2 * sheet.px(
                sheet.var("--gutter", ":root"), ":root"))
            padding = Stylesheet.parts(sheet.value("main", "padding"))
            above, below = sheet.px(padding[0], "main"), sheet.px(padding[2], "main")
            first_screen = sheet.px(sheet.value("main", "min-height"), "main")
            heading = sheet.px(sheet.var("--stage-head", ".stage"), ".stage")
            gap = sheet.px(sheet.var("--stage-gap", ".stage-body"), ".stage-body", column)
            knobs = sheet.px(sheet.var("--stage-knobs", ".stage-body"), ".stage-body", column)
            for aspect in self.PIECE_ASPECTS + self.STRETCHED:
                ratio = eval_ratio(aspect)
                # What js/stage.js writes onto the scene for the piece it has opened.
                given = {"--piece-ratio": f"{ratio:.4f}", "--piece-aspect": aspect}
                budget = sheet.px(sheet.var("--stage-h", ".stage-body"), ".stage-body", column, given)
                scene = sheet.px(tracks[0], ".stage-body", column, given)
                with self.subTest(viewport=(width, height), aspect=aspect):
                    # The scene is as large as the first screen lets it be: as wide as its own height
                    # allows at this ratio, or as wide as the row can spare the knobs, and no less.
                    self.assertAlmostEqual(scene, min(budget * ratio, column - gap - knobs), delta=1,
                                           msg="the scene is not using the room it has")
                    # The knobs keep a column of their own whatever the scene takes.
                    self.assertGreaterEqual(column - scene - gap, knobs - 1, "the knobs are squeezed out")
                    # And the feature ends exactly above the fold: the heading, the scene and
                    # main's own padding are the whole of it, and what is left of the first screen is
                    # the peek the feed gets (_feed.scss, --fold-peek). A piece whose height is what
                    # ran out reaches that line, which is what "fills the real estate" comes to --
                    # the 19rem guess stopped about 90px short of it -- and nothing ever crosses it.
                    feature = above + heading + scene / ratio + below
                    self.assertLessEqual(feature, first_screen + 1,
                                         "the feature outgrew the first screen: the feed stops peeking")
                    if scene > budget * ratio - 1:
                        self.assertGreaterEqual(feature, first_screen - 1,
                                                "the scene stops short of the fold with room to spare")
        # Under 900px the knobs stack under the scene instead of standing beside it: one column, a
        # rail nothing caps because it is the whole width, room kept back for the knobs now that they
        # are below the scene, and the scene capped by the height it may have rather than sized by its
        # column -- so a piece upright enough still cannot run past the first screen on a phone.
        phone = Stylesheet(self.site["css/site.css"], 390, 844)
        self.assertEqual(phone.value(".stage-body", "grid-template-columns"), "1fr")
        self.assertEqual(phone.value(".stage-side", "max-width"), "none")
        self.assertGreater(phone.px(phone.var("--stage-keep", ".stage"), ".stage"), 0,
                           "nothing is kept back for the knobs under the scene")
        narrow = 390 - 2 * phone.px(phone.var("--gutter", ":root"), ":root")
        for aspect in self.PIECE_ASPECTS + self.STRETCHED:
            ratio = eval_ratio(aspect)
            given = {"--piece-ratio": f"{ratio:.4f}", "--piece-aspect": aspect}
            capped = phone.px(phone.value(".stage-scene", "max-width"), ".stage-scene", narrow, given)
            budget = phone.px(phone.var("--stage-h", ".stage-scene"), ".stage-scene", narrow, given)
            with self.subTest(phone=aspect):
                self.assertGreater(min(narrow, capped), 0, "the scene has no width on a phone")
                self.assertLessEqual(min(narrow, capped) / ratio, budget + 1,
                                     "a piece on a phone is taller than the first screen leaves it")
        # Second: the heading the scene is measured against is the real one. The sheet can only guess
        # at it (one line at the widest type scale), and a title that wraps has to be paid for by the
        # scene rather than by the feed's peek, so the stage measures it onto --stage-head itself.
        stage_js = self.source[mi.STAGE_SCRIPT]
        self.assertIn("setProperty('--stage-head'", stage_js, "nothing measures the heading")
        self.assertIn("ui.head.offsetHeight", stage_js, "the heading is measured through a transform")
        self.assertIn("observe(ui.head)", stage_js, "a heading that changes shape is never measured again")
        self.assertIn("id='stage-head'", self.source[mi.STAGE_INCLUDE], "the heading cannot be found")

    def test_every_page_ends_in_the_feed(self):
        # The feed is the one index of every world, written once in the shell, and every page
        # carries it as plain markup -- the site map and the mood atlas included. The two of them
        # used to be the exceptions, because each listed every world itself; those duplicate lists
        # were retired and both pages send a visitor to the cards below instead ("choose a link
        # here or a world card below"), so the feed is the one list of worlds on every page there
        # is and nothing in the shell has to know which page it is on.
        for page in sorted(mi.html_pages(self.site)):
            with self.subTest(page=page):
                self.assertIn("id='feed-grid'", self.site[page])
                self.assertIn("js/feed.js", self.site[page])

    def test_the_query_is_never_a_gate(self):
        # references_from reads the threshold's own markup and not the scripts it loads, so this
        # fails if a world is only reachable by answering the question -- or by having scripting at
        # all. That is the line between asking before offering and gating.
        offered = mi.references_from("index.html", self.site)
        for world in sorted(self.worlds()):
            with self.subTest(world=world):
                self.assertIn(world, offered, "this world is hidden behind an answer")

    def test_the_check_would_notice_the_site_assuming_again(self):
        # A guard against the mood checks quietly becoming no-ops, as with the two above: take the
        # flow off the real home page, gut the library, or ask outright, and each has to be caught.
        without = dict(self.site)
        without["index.html"] = without["index.html"].replace(mi.MOOD_SCRIPT, "js/nothing.js")
        self.assertEqual(mi.pages_missing_mood(without), {"index.html"})

        gutted = dict(self.site, **{mi.MOOD_SCRIPT: "/* one question, asked over and over */"})
        self.assertLess(len(mi.probe_mechanisms(gutted)), mi.MIN_MOOD_PROBES)

        asked = dict(self.site,
                     **{"index.html": self.site["index.html"] + "<p>So, how are you feeling?</p>"})
        self.assertEqual(mi.pages_asking_to_self_report(asked), {"index.html": ["how are you feeling"]})

    # The controls of the real site that are above the destructive threshold today, by the words
    # a visitor presses: the meta menu's "clear" (built by js/state.js, so not in any page's
    # markup) and the persona sheet's two, which ride the shared shell onto every page. The mood
    # atlas adds a "forget my reading" of its own, which is the same words and so the same entry.
    # There is no longer one per world: a world page is a stage and its piece keeps nothing, so
    # "clear omens", "empty the drawer" and "empty the kiln" went with the pages that kept those
    # lists (see the completion axiom). Spelled out rather than discovered, so retiring one is a
    # deliberate edit here.
    DESTRUCTIVE_CONTROLS = {"clear the sky", "forget my reading"}

    def test_the_site_shares_one_destructive_control_component(self):
        # Issue #42: the three steps are written once -- the behaviour in js/site.js, the warning
        # treatment and the modal in the shared controls partial, which reaches every page through
        # css/site.css -- rather than improvised per page.
        self.assertTrue(mi.shares_destructive_caution(self.site))
        helper = self.source[mi.DESTRUCTIVE_SCRIPT]
        for part in ["window.interestingSite.destructive(", "function areYouSure(",
                     "are you sure you want to ", "are-you-sure"]:
            with self.subTest(part=part):
                self.assertIn(part, helper)
        partial = self.source[f"{mi.SASS_DIR}/_controls.scss"]
        self.assertIn("button.warning", partial)
        self.assertIn(".are-you-sure", partial)

    def test_every_control_that_throws_saved_state_away_reads_as_a_warning(self):
        # The audit half of the axiom, as with the other six: the controls that exist today are
        # held to it too, not only the ones a future run writes. This is the check that found
        # "clear omens", "empty the drawer" and "empty the kiln" pressing without a word.
        self.assertEqual(mi.pages_with_bare_destructive_controls(self.site), {})
        found = {name for page in mi.html_pages(self.site)
                 for name, _ in mi.DestructiveControls(self.site[page]).controls}
        self.assertEqual(found, self.DESTRUCTIVE_CONTROLS)

    def test_no_page_writes_a_confirmation_of_its_own(self):
        # One question, everywhere. js/state.js keeps a window.confirm as the fallback for a run
        # having broken js/site.js, and it is in FIXED_FILES, so it is not a page's improvisation.
        self.assertEqual(mi.pages_improvising_confirmation(self.site), {})
        self.assertIn("window.confirm", self.source[mi.STATE_SCRIPT],
                      "the fixed menu keeps a fallback, which is the one exception")
        self.assertIn(mi.STATE_SCRIPT, mi.FIXED_FILES)

    def test_the_modal_is_a_plain_confirm_cancel_and_nothing_more(self):
        # "Don't overdo it": no typing a word, no second deliberate press, no arming affordance.
        helper = self.source[mi.DESTRUCTIVE_SCRIPT]
        for ceremony in ["prompt(", "type the word", "press again", "hold to"]:
            with self.subTest(ceremony=ceremony):
                self.assertNotIn(ceremony, helper)
        # Keyboard-operable, Escape to dismiss, and the focus returned however it is answered.
        for owed in ["showModal", "'cancel'", "Escape", "back.focus()", "sure.no.focus()"]:
            with self.subTest(owed=owed):
                self.assertIn(owed, helper)

    def test_the_check_would_notice_a_real_destructive_control_losing_its_warning(self):
        # A guard against the check quietly becoming a no-op as the site is rewritten around it:
        # take the warning off the real controls of a real page and the check has to name them.
        # Whole-page rather than one control at a time because bare() stays quiet about a name
        # while a twin of it still wears the warning, and the persona sheet's two are on every
        # page -- the home page, a world's stage and the mood atlas, which has one of its own.
        for page in ["index.html", "sky-archive.html", "moods.html"]:
            with self.subTest(page=page):
                bare = dict(self.site)
                bare[page] = bare[page].replace(f"class='{mi.WARNING_CLASS}'", "class=''")
                self.assertEqual(mi.pages_with_bare_destructive_controls(bare).get(page),
                                 ["clear the sky", "forget my reading"])

    def test_the_check_would_notice_a_page_asking_in_the_browsers_own_words(self):
        asking = dict(self.site, **{"loam.html": self.site["loam.html"]
                                    + "<script>if (window.confirm('sure?')) wipe();</script>"})
        self.assertEqual(mi.pages_improvising_confirmation(asking), {"loam.html": ["loam.html"]})

    def test_the_site_has_a_sitemap_of_both_kinds(self):
        # Open question 2 of the issue: both. sitemap.xml for anything reading the site
        # mechanically, and a page a visitor can read, reachable from the home page.
        self.assertIn("sitemap.xml", self.site)
        self.assertIn("sitemap.html", mi.links_from("index.html", self.site))

    def test_every_page_loads_the_analytics_and_consent_script(self):
        for rel in mi.FIXED_FILES:
            self.assertIn(rel, self.site, "the files behind the tag have to be there")
        self.assertEqual(mi.pages_missing_analytics(self.site), set())
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_measurement_id_is_not_committed_but_the_deploy_injects_it(self):
        analytics = self.site[mi.ANALYTICS_SCRIPT]
        self.assertIn(self.GA_PLACEHOLDER, analytics)
        self.assertNotRegex(analytics, r"G-[A-Z0-9]{6,}", "a measurement ID is committed")
        deploy = (self.repo / ".github" / "workflows" / "deploy.yml").read_text()
        self.assertIn(self.GA_PLACEHOLDER, deploy, "nothing replaces the placeholder at deploy time")
        self.assertIn("GA_MEASUREMENT_ID", deploy)
        # The injection has to edit the built artifact -- the copy that is synced to S3 -- and not
        # site/ in the checkout. /site is source now (issue #25): the build renders analytics.js
        # into that artifact (copied through verbatim, placeholder and all), and the deploy publishes
        # the artifact, never the checkout. Injecting into the source would leave the deployed
        # analytics.js on its placeholder, so the whole site would ship with analytics switched off.
        self.assertIn('analytics="${BUILD_DIR}/js/analytics.js"', deploy)
        self.assertNotIn("analytics='site/js/analytics.js'", deploy,
                         "the deploy injects into the source, which is never published")

    def test_every_page_loads_the_local_state_store_and_its_meta_menu(self):
        self.assertIn(mi.STATE_SCRIPT, self.site, "the file behind the line has to be there")
        self.assertEqual(mi.pages_missing_state(self.site), set())
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_line_is_written_once_in_the_shared_shell(self):
        # The same bargain the analytics line makes: the axiom is about the built site, so one line
        # in the shell carries it to every page, and a run that drops it is refused for all of them
        # at once rather than page by page.
        self.assertRegex(self.source["_includes/layout.njk"], in_the_shell(mi.STATE_TAG))

    def test_no_page_keeps_state_behind_the_stores_back(self):
        # Issue #31: one document and one way in and out of it. A page that parsed localStorage
        # itself would be state the meta menu could not export.
        self.assertEqual(mi.pages_touching_storage(self.site), {})
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_check_would_notice_a_page_going_round_the_store(self):
        # A guard against the check quietly becoming a no-op, as with the accessibility one: put a
        # direct read back into the real home page and it has to be named.
        broken = dict(self.site)
        broken["index.html"] += "<script>var raw = localStorage.getItem('mine');</script>"
        self.assertEqual(sorted(mi.pages_touching_storage(broken)), ["index.html"])

    def test_the_store_carries_over_every_key_the_site_used_to_keep(self):
        # The per-page keys of issue #31's "today": each one is named in the store's migration
        # table, and none is left in a page, so a visitor who was here before keeps their sky.
        store = self.site[mi.STATE_SCRIPT]
        for earlier in ["interesting_wish_constellation_v1",
                        "interesting_constellation_capsules_v1",
                        "interesting_sky_archive_omens_v1"]:
            with self.subTest(earlier=earlier):
                self.assertIn(earlier, store, "the store has to know what to carry over")
                for page in sorted(mi.html_pages(self.site)):
                    self.assertNotIn(earlier, self.site[page], f"{page} still keeps its own slice")

    def test_the_meta_menu_is_out_of_every_runs_reach(self):
        # Open question 4 of the issue: the same machinery as the analytics tag, which means the
        # file is fixed rather than merely discouraged.
        self.assertIn(mi.STATE_SCRIPT, mi.FIXED_FILES)
        with self.assertRaises(mi.RejectedChange):
            mi.validate_plan({"files": [{"path": mi.STATE_SCRIPT, "content": "mine now"}]})
        with self.assertRaises(mi.RejectedChange):
            mi.validate_plan({"delete": [mi.STATE_SCRIPT]})

    def test_every_page_carries_a_visitors_way_of_steering_the_site(self):
        # Issue #43: the way in is on every page, not only on a page a visitor might think to look
        # for -- steering the site should be no harder than looking at it.
        self.assertIn(mi.PARTICIPATE_SCRIPT, self.site, "the file behind the line has to be there")
        self.assertEqual(mi.pages_missing_participate(self.site), set())
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_steering_line_is_written_once_in_the_shared_shell(self):
        # The same bargain the analytics and local-state lines make: one line in the shell carries
        # it to every page, so a run that drops it is refused for all of them at once.
        self.assertRegex(self.source["_includes/layout.njk"], in_the_shell(mi.PARTICIPATE_TAG))

    def test_the_way_in_is_out_of_every_runs_reach(self):
        # The heart of the issue: an affordance the AI never modifies. The same machinery the
        # analytics tag and the local-state store use, which means fixed rather than discouraged.
        self.assertIn(mi.PARTICIPATE_SCRIPT, mi.FIXED_FILES)
        with self.assertRaises(mi.RejectedChange):
            mi.validate_plan({"files": [{"path": mi.PARTICIPATE_SCRIPT, "content": "a quieter word"}]})
        with self.assertRaises(mi.RejectedChange):
            mi.validate_plan({"delete": [mi.PARTICIPATE_SCRIPT]})

    def test_the_check_would_notice_the_way_in_going_quiet(self):
        # A guard against the check quietly becoming a no-op, as with the five above it: take the
        # line off the real home page and it has to be named.
        without = dict(self.site)
        without["index.html"] = without["index.html"].replace(mi.PARTICIPATE_SCRIPT, "js/nothing.js")
        self.assertEqual(mi.pages_missing_participate(without), {"index.html"})

    def test_the_three_corner_affordances_each_keep_to_their_own_edge(self):
        # They are a cadre: pinned to the device boundary, each injecting its own styles, none of
        # them a page's to restyle. The one in the middle reserves room for the other two rather
        # than trusting a wide screen, so the three do not meet on a 320px phone.
        for rel, spot in [(mi.ANALYTICS_SCRIPT, "left: 0.55rem"),
                          (mi.STATE_SCRIPT, "right: 0.55rem"),
                          (mi.PARTICIPATE_SCRIPT, "left: 50%")]:
            with self.subTest(rel=rel):
                self.assertIn("position: fixed", self.site[rel])
                self.assertIn(spot, self.site[rel])
        self.assertRegex(self.site[mi.PARTICIPATE_SCRIPT], r"max-width: calc\(100vw - [\d.]+rem\)")

    def test_the_destination_is_this_repositorys_new_issue_page(self):
        # The one thing the issue asks for in as many words, held here so a rename of the
        # repository or the form cannot leave the button pointing at nothing.
        script = self.site[mi.PARTICIPATE_SCRIPT]
        self.assertIn("https://github.com/outrightmental/interesting/issues/new", script)
        named = re.search(r"TEMPLATE\s*=\s*'([^']+)'", script)
        self.assertIsNotNone(named)
        self.assertTrue((self.repo / ".github" / "ISSUE_TEMPLATE" / named[1]).is_file())

    def test_the_vendored_consent_library_keeps_its_license_and_version(self):
        for rel in ["js/cookieconsent.umd.js", "css/cookieconsent.css"]:
            with self.subTest(rel=rel):
                self.assertIn("CookieConsent 3.1.0", self.site[rel])
                self.assertIn("github.com/orestbida/cookieconsent", self.site[rel])
                self.assertIn("MIT License", self.site[rel])


class DomainTest(unittest.TestCase):
    """Where the site is published, and the one folder that decides it.

    Issue #40 moved the site from interesting.outright.io to its own apex domain,
    makeitmoreinteresting.com. The move touched no page, because /site addresses itself by no
    domain: every link in it is relative and sitemap.xml's <loc> values are relative too,
    deliberately, so the same source serves a fork, a local copy and the live site. These tests
    hold both halves of that -- /infra declares the domain in one place, /site pins itself to no
    origin -- so the next move is a change to locals.tf and the prose that quotes it, and nothing
    else.
    """

    DOMAIN = "makeitmoreinteresting.com"
    RETIRED = "interesting.outright.io"

    @classmethod
    def setUpClass(cls):
        cls.repo = Path(mi.__file__).resolve().parents[2]
        cls.infra = cls.repo / "infra"

    def infra_file(self, name):
        path = self.infra / name
        if not path.is_file():
            self.skipTest(f"no {name} at {path}")
        return path.read_text()

    def local_value(self, name):
        """The literal assigned to a `name = "..."` argument in infra/locals.tf."""
        match = re.search(rf'^\s*{name}\s*=\s*"([^"]*)"', self.infra_file("locals.tf"), re.M)
        self.assertIsNotNone(match, f"locals.tf declares no {name}")
        return match.group(1)

    def text_files(self, folder):
        for path in sorted(folder.rglob("*")):
            if path.is_file() and not path.is_symlink():
                try:
                    yield path, path.read_text()
                except UnicodeDecodeError:
                    continue

    def test_locals_is_the_one_place_the_domain_is_declared(self):
        self.assertEqual(self.local_value("domain"), self.DOMAIN)
        self.assertEqual(self.local_value("www_domain"), f"www.{self.DOMAIN}")
        # The bucket is named after the domain, the way every other studio property's is.
        self.assertEqual(self.local_value("bucket"), self.DOMAIN)

    def test_the_certificate_covers_every_hostname_the_distribution_answers_to(self):
        # CloudFront refuses an alias its viewer certificate does not cover, so the two lists are
        # built from the same local rather than written out twice.
        website = self.infra_file("website.tf")
        self.assertIn("subject_alternative_names = [local.www_domain]", website)
        self.assertRegex(website, r"aliases\s*=\s*local\.hostnames")
        hostnames = re.search(r"^\s*hostnames\s*=\s*\[([^\]]*)\]",
                              self.infra_file("locals.tf"), re.M)
        self.assertIsNotNone(hostnames, "locals.tf declares no hostnames")
        self.assertEqual([name.strip() for name in hostnames.group(1).split(",")],
                         ["local.domain", "local.www_domain"])

    def test_the_hosted_zone_is_owned_here_and_every_record_goes_into_it(self):
        # The old subdomain lived in a zone owned by another state and read through data.tf; an
        # apex domain of this property's own is owned by this property's own project.
        self.assertIn('resource "aws_route53_zone" "primary"', self.infra_file("dns.tf"))
        for name in ("data.tf", "dns.tf", "website.tf"):
            self.assertNotIn('data "aws_route53_zone"', self.infra_file(name),
                             f"{name} still reads a zone it should own")
        # A record's own zone, at the resource's indentation -- `terraform fmt` in CI keeps it at
        # two spaces, which is what tells it apart from the distribution's zone inside `alias`.
        zone_ids = re.findall(r"^  zone_id\s*=\s*(\S+)", self.infra_file("website.tf"), re.M)
        self.assertEqual(set(zone_ids), {"aws_route53_zone.primary.zone_id"})
        self.assertEqual(len(zone_ids), 2, "the validation records and the alias records")

    def test_the_bucket_the_state_key_and_the_deploy_user_all_carry_the_domain(self):
        # Renaming these three is what made the move a cutover rather than one apply (see the
        # order of operations in infra/README.md); nothing may keep the retired name.
        self.assertRegex(self.infra_file("main.tf"), rf'key\s*=\s*"{re.escape(self.DOMAIN)}"')
        user = self.DOMAIN.replace(".", "-") + "-deploy"
        self.assertIn(f'name = "{user}"', self.infra_file("iam-deploy.tf"))

    def test_the_retired_host_is_never_offered_as_the_live_site(self):
        # It may be named as history -- infra/README.md walks through the cutover -- but no file
        # may still link to it.
        for folder in (self.repo / "infra", self.repo / ".github", self.repo / "site"):
            if not folder.is_dir():
                continue
            for path, text in self.text_files(folder):
                self.assertNotIn(f"https://{self.RETIRED}", text, f"{path} links to the old host")
        readme = self.repo / "README.md"
        if readme.is_file():
            self.assertNotIn(self.RETIRED, readme.read_text())
            self.assertIn(f"**https://{self.DOMAIN}/**", readme.read_text(),
                          "the README's headline link is the live site")

    def test_the_site_itself_pins_itself_to_no_origin(self):
        # A page may say the domain's name in prose; what it may not do is address itself by it.
        # `//domain` catches https://, http:// and protocol-relative alike. The retired host is
        # refused outright, in prose or not: it does not resolve any more.
        site = self.repo / "site"
        if not site.is_dir():
            self.skipTest(f"no site directory at {site}")
        for path, text in self.text_files(site):
            self.assertNotIn(f"//{self.DOMAIN}", text,
                             f"{path} hard-codes its own origin; /site is served under any")
            self.assertNotIn(self.RETIRED, text, f"{path} names the retired host")

    def test_the_sitemap_keeps_relative_locations(self):
        sitemap_xml = self.repo / "site" / "sitemap.xml"
        if not sitemap_xml.is_file():
            self.skipTest(f"no sitemap at {sitemap_xml}")
        locs = re.findall(r"<loc>([^<]+)</loc>", sitemap_xml.read_text())
        self.assertTrue(locs, "the sitemap lists nothing")
        for loc in locs:
            self.assertNotRegex(loc.strip(), r"^[a-z]+://", "a <loc> pins the site to one origin")


class SmallModelTest(unittest.TestCase):
    """Issue #2: small models must never be picked at random."""

    SMALL = [
        # the two named in the issue, in id form and as people write them
        "claude-haiku-4.5", "claude-sonnet-5.5", "claude-sonnet-5", "Claude Haiku 4.5", "anthropic/claude-3-5-sonnet",
        # the same tiers at other providers
        "gpt-5-mini", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-6-luna", "gpt-5.6-luna", "gpt-5.6-terra",
        "openai/gpt-4o-mini", "o4-mini",
        "gemini-3.8-flash", "gemini-2.5-flash-lite", "gemma-3-27b-it",
        "grok-3-mini", "grok-code-fast-1", "claude-opus-4.8-fast",
        "mai-code-1.1-flash", "microsoft/Phi-4", "Phi-4-mini-instruct",
        "mistral-small-2503", "mistral-ai/mistral-medium-2505", "ministral-3b",
        "amazon.nova-micro-v1", "nova-lite", "llama-3.1-8b-instant", "some-new-tiny-model",
        # not flagships, but named by version alone: recognised by id
        "gpt-5.4", "openai/gpt-4.1", "GPT-4.1", "kimi-k2.7-code",
    ]
    LARGE = [
        "claude-fable-5.1", "claude-fable-5", "claude-opus-5.5", "claude-opus-5", "claude-opus-4.8",
        "gpt-6.1-sol", "gpt-6-sol", "gpt-6-astra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.3-codex",
        "kimi-k3", "mistral-large-2411", "gpt-5.4-pro", "gpt-5.40",
        # contain the letters of a marker without being that tier
        "gemini-3.1-pro", "gemini-3-pro", "minimax-m2", "nanobanana-pro", "flashpoint-xl",
    ]

    def test_small_and_mid_tier_models_are_recognised(self):
        for model in self.SMALL:
            with self.subTest(model=model):
                self.assertTrue(mi.is_small_model(model))

    def test_flagship_models_are_not_mistaken_for_small(self):
        for model in self.LARGE:
            with self.subTest(model=model):
                self.assertFalse(mi.is_small_model(model))

    def test_built_in_pool_contains_no_small_model(self):
        self.assertTrue(mi.MODELS)
        self.assertEqual([m for m in mi.MODELS if mi.is_small_model(m)], [])
        self.assertEqual(len(set(mi.MODELS)), len(mi.MODELS))
        for model in mi.MODELS:
            self.assertFalse(any(tier in model for tier in ("haiku", "sonnet")), model)

    # Every model GitHub Copilot CLI listed on 2026-10-02, by GitHub's pricing category. The Grok
    # ids are left out: xAI's top model is priced as Versatile, and the CLI cannot reach it anyway.
    CATALOG_LIGHTWEIGHT = ["gpt-6-luna", "gpt-5.6-luna", "gpt-5-mini", "gpt-5.4-mini", "gemini-3.5-flash",
                           "mai-code-1.1-flash"]
    CATALOG_VERSATILE = ["gpt-5.6-terra", "gpt-5.4", "claude-haiku-4.5", "claude-sonnet-5", "claude-sonnet-5.5",
                         "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash", "kimi-k2.7-code"]
    CATALOG_POWERFUL = ["gpt-5.3-codex", "gpt-6-sol", "gpt-6.1-sol", "gpt-5.6-sol", "gpt-5.5", "gpt-6-astra",
                        "claude-opus-5.5", "claude-opus-5", "claude-opus-4.8", "claude-opus-4.7",
                        "claude-fable-5", "claude-fable-5.1", "kimi-k3"]
    CATALOG_OTHER = ["claude-opus-4.8-fast", "gpt-4.1"]  # a double-price speed variant; a retired model

    def test_only_flagships_survive_when_the_whole_catalog_is_the_pool(self):
        catalog = self.CATALOG_LIGHTWEIGHT + self.CATALOG_VERSATILE + self.CATALOG_POWERFUL + self.CATALOG_OTHER
        pool, log = self.pool(",".join(catalog))
        self.assertEqual(sorted(pool), sorted(self.CATALOG_POWERFUL))
        for refused in self.CATALOG_LIGHTWEIGHT + self.CATALOG_VERSATILE + self.CATALOG_OTHER:
            self.assertIn(f"{refused} is not a flagship model", log)

    def test_built_in_pool_is_drawn_from_the_flagship_tier(self):
        self.assertTrue(set(mi.MODELS) <= set(self.CATALOG_POWERFUL), set(mi.MODELS) - set(self.CATALOG_POWERFUL))

    def pool(self, configured):
        with mock.patch.dict(os.environ, {"MODEL_POOL": configured}), mock.patch("builtins.print") as printed:
            return mi.model_pool(), " ".join(str(call.args[0]) for call in printed.call_args_list)

    def test_default_pool_is_the_built_in_list(self):
        for unset in ["", "  ", " , "]:
            self.assertEqual(self.pool(unset)[0], mi.MODELS)

    def test_configured_pool_replaces_the_list_but_small_models_are_still_refused(self):
        pool, log = self.pool("claude-opus-5.5, claude-haiku-4.5,gpt-5-mini  my-new-flagship\nclaude-opus-5.5,claude-sonnet-5")
        self.assertEqual(pool, ["claude-opus-5.5", "my-new-flagship"])
        for refused in ["claude-haiku-4.5", "gpt-5-mini", "claude-sonnet-5"]:
            self.assertIn(f"{refused} is not a flagship model", log)

    def test_random_pick_never_lands_on_a_small_model(self):
        everything = ",".join(self.SMALL + self.LARGE).replace(" ", "-")
        with mock.patch.dict(os.environ, {"MODEL_POOL": everything, "MODEL": ""}), mock.patch("builtins.print"):
            for _ in range(200):
                candidates = mi.pick_candidates()
                self.assertEqual(sorted(candidates), sorted(self.LARGE))
                self.assertFalse(any(mi.is_small_model(m) for m in candidates))

    def test_pool_of_only_small_models_stops_the_run(self):
        with mock.patch.dict(os.environ, {"MODEL_POOL": "claude-haiku-4.5,gpt-5-mini", "MODEL": ""}):
            with mock.patch("builtins.print"), self.assertRaises(SystemExit) as caught:
                mi.pick_candidates()
        self.assertIn("pool is empty", str(caught.exception))

    def test_model_requested_by_name_is_used_as_asked_with_a_warning(self):
        with mock.patch.dict(os.environ, {"MODEL": " claude-haiku-4.5 ", "MODEL_POOL": ""}):
            with mock.patch("builtins.print") as printed:
                self.assertEqual(mi.pick_candidates(), ["claude-haiku-4.5"])
        self.assertIn("is not a flagship model; using it because it was requested by name", printed.call_args.args[0])
        with mock.patch.dict(os.environ, {"MODEL": "claude-opus-5.5"}), mock.patch("builtins.print") as printed:
            self.assertEqual(mi.pick_candidates(), ["claude-opus-5.5"])
        printed.assert_not_called()


class FakeCopilot:
    """A stand-in `copilot` executable that records how it was called."""

    def __init__(self, test, body):
        tmp = tempfile.TemporaryDirectory()
        test.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name).resolve()
        self.log = self.dir / "calls.jsonl"
        script = self.dir / "fake_copilot.py"
        script.write_text(
            "import json, os, sys\n"
            f"LOG = {str(self.log)!r}\n"
            "PROMPT = sys.stdin.read()\n"
            "ARGS = sys.argv[1:]\n"
            "MODEL = ARGS[ARGS.index('--model') + 1]\n"
            # Only the variables the silo sets itself: nothing that could hold a token is logged.
            "WATCHED = ('NO_COLOR', 'COPILOT_AUTO_UPDATE', 'COPILOT_PROVIDER_MAX_OUTPUT_TOKENS')\n"
            "with open(LOG, 'a') as fh:\n"
            "    fh.write(json.dumps({'args': ARGS, 'prompt': PROMPT, 'cwd': os.getcwd(),\n"
            "                         'listing': os.listdir('.'),\n"
            "                         'env': {k: os.environ.get(k) for k in WATCHED}}) + '\\n')\n"
            "def say(text):\n"
            "    print(json.dumps({'type': 'assistant.message', 'data': {'content': text}}))\n"
            + textwrap.dedent(body)
        )
        # A shell wrapper rather than a "#!python" line: interpreter paths may contain spaces.
        exe = self.dir / "copilot"
        exe.write_text(f'#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(script))} "$@"\n')
        exe.chmod(exe.stat().st_mode | stat.S_IXUSR)
        patcher = mock.patch.object(mi, "COPILOT_BIN", str(exe))
        patcher.start()
        test.addCleanup(patcher.stop)

    def calls(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]


class CallModelTest(unittest.TestCase):
    def test_runs_copilot_locked_down_in_an_empty_directory(self):
        fake = FakeCopilot(self, "say('hello ' + MODEL)")
        with mock.patch.dict(os.environ, {"REASONING_EFFORT": ""}):
            self.assertEqual(mi.call_model("model-a", "the prompt"), "hello model-a")
        (call,) = fake.calls()
        self.assertEqual(call["prompt"], "the prompt")
        self.assertEqual(call["listing"], [])
        self.assertNotEqual(Path(call["cwd"]).resolve(), Path.cwd().resolve())
        self.assertFalse(Path(call["cwd"]).exists(), "the silo directory is removed afterwards")
        args = call["args"]
        self.assertEqual(args[:2], ["--model", "model-a"])
        self.assertEqual(args[2:4], ["--reasoning-effort", mi.DEFAULT_REASONING_EFFORT])
        self.assertEqual(args[4:], mi.COPILOT_FLAGS)

    def test_flags_keep_the_model_tool_less_and_the_output_parseable(self):
        flags = mi.COPILOT_FLAGS
        for flag in ["--available-tools=none", "--deny-tool=shell", "--deny-tool=write", "--deny-tool=url",
                     "--disable-builtin-mcps", "--no-custom-instructions", "--no-ask-user", "--no-remote",
                     "--disallow-temp-dir", "--no-auto-update",
                     "--secret-env-vars=COPILOT_GITHUB_TOKEN,GH_TOKEN,GITHUB_TOKEN"]:
            self.assertIn(flag, flags)
        self.assertEqual(flags[flags.index("--output-format") + 1], "json")
        self.assertEqual(flags[flags.index("--stream") + 1], "off")
        for flag in flags:
            self.assertFalse(flag.startswith(("--allow", "--yolo", "--add-dir", "--autopilot", "-p", "--prompt")), flag)

    def test_auth_and_policy_failures_are_fatal(self):
        messages = [
            "Error: Authentication failed (Request ID: X)",
            "Error: No authentication information found.",
            "Error: Access denied by policy settings (Request ID: X)",
        ]
        for message in messages:
            with self.subTest(message=message):
                FakeCopilot(self, f"sys.stderr.write({message!r}); sys.exit(1)")
                with self.assertRaises(mi.CopilotAuthError):
                    mi.call_model("model-a", "p")

    def test_unavailable_model_is_reported_as_such(self):
        messages = [
            'Error: Model "x" from --model flag is not available.',
            "Error: Run `copilot --model x` in interactive mode to enable this model",  # blocked by model policy
            "This model is disabled by your organization's policy.",
            'Execution failed: CAPIError: 400 model "x" is not accessible via the /chat/completions endpoint',
        ]
        for message in messages:
            with self.subTest(message=message):
                FakeCopilot(self, f"sys.stderr.write({message!r}); sys.exit(1)")
                with self.assertRaises(mi.ModelUnavailable):
                    mi.call_model("x", "p")

    def test_other_failures_only_fail_that_model(self):
        FakeCopilot(self, "sys.stderr.write('Error: something broke'); sys.exit(1)")
        with self.assertRaisesRegex(mi.ModelError, "status 1: Error: something broke") as caught:
            mi.call_model("x", "p")
        self.assertNotIsInstance(caught.exception, mi.ModelUnavailable)
        FakeCopilot(self, "pass")
        with self.assertRaisesRegex(mi.ModelError, "empty response"):
            mi.call_model("x", "p")

    def test_session_error_events_are_understood(self):
        def session_error(**data):
            return f"print(json.dumps({{'type': 'session.error', 'data': {data!r}}})); sys.exit(1)"

        FakeCopilot(self, session_error(errorType="rate_limit", statusCode=429, message="slow down"))
        with self.assertRaisesRegex(mi.ModelError, "rate_limit 429: slow down"):
            mi.call_model("x", "p")
        FakeCopilot(self, session_error(errorType="authentication", statusCode=401, message="bad credentials"))
        with self.assertRaises(mi.CopilotAuthError):
            mi.call_model("x", "p")
        # An error event is a failure even if the CLI exits 0 and also printed an answer.
        FakeCopilot(self, "print(json.dumps({'type': 'session.error', 'data': {'message': 'boom'}})); say('{}')")
        with self.assertRaisesRegex(mi.ModelError, "boom"):
            mi.call_model("x", "p")

    TOOL_EVENT = "print(json.dumps({'type': 'tool.execution_start', 'data': {'toolName': 'bash'}}), flush=True)"

    def test_tool_use_is_a_silo_breach(self):
        FakeCopilot(self, self.TOOL_EVENT + "; say('{}')")
        with self.assertRaises(mi.SiloBreach):
            mi.call_model("x", "p")

    def test_tool_use_is_a_silo_breach_even_when_the_call_then_fails(self):
        endings = {
            "exit 1": "sys.exit(1)",
            "unavailable": "sys.stderr.write('Error: Model \"x\" from --model flag is not available.'); sys.exit(1)",
            "auth": "sys.stderr.write('Error: Authentication failed'); sys.exit(1)",
            "session error": "print(json.dumps({'type': 'session.error', 'data': {'message': 'boom'}})); sys.exit(1)",
        }
        for name, ending in endings.items():
            with self.subTest(ending=name):
                FakeCopilot(self, self.TOOL_EVENT + "\n" + ending)
                with self.assertRaises(mi.SiloBreach):
                    mi.call_model("x", "p")

    def test_tool_use_is_a_silo_breach_even_when_the_call_then_hangs(self):
        FakeCopilot(self, self.TOOL_EVENT + "\nimport time; time.sleep(60)")
        started = time.monotonic()
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 1.5), self.assertRaises(mi.SiloBreach):
            mi.call_model("x", "p")
        self.assertLess(time.monotonic() - started, 20, "the hung CLI was waited for, not killed")

    def test_the_models_own_words_are_never_read_as_a_copilot_error(self):
        # The CLI dies without saying why, after printing an answer that happens to contain the
        # phrases Copilot uses for its own errors.
        for phrase in ["Authentication failed. Try again!", "This page is not available.", "Access denied by policy"]:
            with self.subTest(phrase=phrase):
                FakeCopilot(self, f"say({phrase!r}); sys.exit(1)")
                with self.assertRaises(mi.ModelError) as caught:
                    mi.call_model("x", "p")
                self.assertIs(type(caught.exception), mi.ModelError)

    def test_output_that_is_not_utf8_does_not_crash(self):
        FakeCopilot(self, "sys.stdout.buffer.write(b'\\xff\\xfe not utf-8\\n'); sys.stdout.flush(); say('ok')")
        self.assertEqual(mi.call_model("x", "p"), "ok")

    def test_timeout_only_fails_that_model_and_leaves_nothing_running(self):
        # The stand-in starts a child of its own, as the npm launcher of the real CLI does.
        fake = FakeCopilot(self, """
            import subprocess, time
            child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
            open(LOG + '.pids', 'w').write('%d %d' % (os.getpid(), child.pid))
            time.sleep(60)
        """)
        started = time.monotonic()
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 1.5), self.assertRaisesRegex(mi.ModelError, "no answer"):
            mi.call_model("x", "p")
        self.assertLess(time.monotonic() - started, 20, "the hung CLI was waited for, not killed")
        for pid in map(int, Path(str(fake.log) + ".pids").read_text().split()):
            for _ in range(50):  # the kill is asynchronous; give the kernel a moment
                if not process_is_running(pid):
                    break
                time.sleep(0.1)
            self.assertFalse(process_is_running(pid), f"process {pid} survived the timeout")

    def test_missing_cli_stops_the_run(self):
        with mock.patch.object(mi, "COPILOT_BIN", "/nonexistent/copilot"), self.assertRaises(SystemExit):
            mi.call_model("x", "p")

    def test_the_run_can_give_a_call_less_time_than_the_usual(self):
        # Near the run's deadline a call is given only what is left (see main), and a call that
        # runs out of it is reported as a timeout, which is the one failure not worth a repair.
        FakeCopilot(self, "import time; time.sleep(60)")
        started = time.monotonic()
        with self.assertRaisesRegex(mi.ModelTimeout, "no answer within 1.5s"):
            mi.call_model("x", "p", timeout=1.5)
        self.assertLess(time.monotonic() - started, 20)


# A plan that respects every axiom. Reachability (issue #21): the page it adds is linked from the
# home page and listed in the sitemap by the same answer, so nothing it leaves behind is orphaned.
# Responsive and accessible (issue #26), and carrying the analytics line (issue #24): the page it
# adds arrives as a whole page that satisfies both, which is what a run writing one has to do.
CLOCK_PAGE = page(title="clock", body="<p>tick</p>")
GOOD_PLAN = json.dumps({
    "summary": "Added a clock.\nSecond line is dropped.",
    "files": [
        {"path": "clock.html", "content": CLOCK_PAGE},
        {"path": "index.html", "content": home("clock.html", "error.html")},
        {"path": "sitemap.xml", "content": sitemap("index.html", "clock.html", "error.html")},
    ],
})


class MainTest(SiteDirTestCase):
    def setUp(self):
        super().setUp()
        # The gate runs this whole suite; DeployGateTest holds it to that, and here it lets every
        # answer through, as the identity build does.
        patcher = mock.patch.object(mi, "require_passing_tests")
        self.require_passing_tests = patcher.start()
        self.addCleanup(patcher.stop)

    def run_main(self, env=None):
        out = self.root / "github_output"
        full_env = {"GITHUB_OUTPUT": str(out), "MODEL": "", "MODEL_POOL": "", "RUN_MODE": ""}
        full_env.update(env or {})
        self.printed = []
        with mock.patch.dict(os.environ, full_env):
            with mock.patch("builtins.print", lambda *args, **kwargs: self.printed.append(" ".join(map(str, args)))):
                mi.main()
        return out.read_text() if out.exists() else ""

    def test_applies_first_usable_answer_and_reports_it(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        output = self.run_main({"RUN_MODE": "enhance_overall"})
        self.assertFalse([line for line in self.printed if "not available" in line])
        self.assertEqual((self.site / "clock.html").read_text(), CLOCK_PAGE)
        (call,) = fake.calls()
        model = call["args"][1]
        self.assertIn(model, mi.MODELS)
        self.assertEqual(read_outputs(output), {"model": model, "summary": "Added a clock.", "mode": "enhance_overall",
                                                "items": "", "headline": "Enhance the site"})
        self.assertIn("Mode:    enhance_overall (5 of 42 marbles)", self.printed)

    def test_the_whole_run_asks_for_one_output_budget(self):
        # The prompt's number and the CLI's number are the same number, resolved once for the run:
        # a prompt promising more room than the call asks for would invite exactly the cut-off
        # answer this is meant to prevent (issue #77).
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.run_main({"MAX_OUTPUT_TOKENS": "111000"})
        (call,) = fake.calls()
        self.assertEqual(call["env"]["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS"], "111000")
        self.assertIn("111,000 tokens", call["prompt"])

    def test_a_run_recovers_an_answer_that_ran_past_the_output_limit(self):
        # The answer the failing run lost: cut off mid-JSON and carried on in a second turn. It is
        # put back together and applied, by the one model asked, rather than thrown away.
        half = len(GOOD_PLAN) // 2
        fake = FakeCopilot(self, f"""
            print(json.dumps({{'type': 'assistant.turn_start', 'data': {{'turnId': '0'}}}}))
            say({GOOD_PLAN[:half]!r})
            print(json.dumps({{'type': 'assistant.turn_start', 'data': {{'turnId': '1'}}}}))
            say({GOOD_PLAN[half:]!r})
        """)
        output = self.run_main()
        self.assertEqual(len(fake.calls()), 1, "the recovered answer costs no further attempt")
        self.assertEqual((self.site / "clock.html").read_text(), CLOCK_PAGE)
        self.assertEqual(read_outputs(output)["summary"], "Added a clock.")
        self.assertTrue([line for line in self.printed if "ran past its output limit" in line])

    def test_the_mode_named_by_hand_shapes_the_prompt_the_outputs_and_the_log(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        output = self.run_main({"RUN_MODE": "consolidate_nav"})
        (call,) = fake.calls()
        self.assertIn("THIS RUN CONSOLIDATES THE NAVIGATION", call["prompt"])
        self.assertNotIn("ADD one world", call["prompt"])
        outputs = read_outputs(output)
        self.assertEqual((outputs["mode"], outputs["headline"]), ("consolidate_nav", "Consolidate the navigation"))
        mission = mi.mission_of(mi.Run("consolidate_nav"))
        self.assertTrue([line for line in self.printed if line.startswith(f"Mission: {mission} (consolidate_nav run)")])
        output = self.run_main({"RUN_MODE": "create_item"})
        self.assertIn("THIS RUN CREATES ONE NEW WORLD", fake.calls()[-1]["prompt"])
        self.assertEqual(read_outputs(output)["headline"], "Create a world")
        self.assertIn("Mode:    create_item (1 of 42 marbles)", self.printed)

    def test_the_bag_is_drawn_once_per_run_and_the_draw_shapes_everything(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        with mock.patch.object(mi, "chosen_mode", return_value="enhance_persona") as drawn:
            output = self.run_main()
        self.assertEqual(drawn.call_count, 1)
        self.assertIn("THIS RUN ENHANCES THE PERSONA", fake.calls()[0]["prompt"])
        self.assertEqual(read_outputs(output)["headline"], "Enhance the persona")

    def test_an_item_mode_draws_a_world_and_names_it_everywhere(self):
        # The world is drawn from the site's own list, named in the prompt, shown first, named in
        # the headline, the items output and the log -- and never in a commit message uncleaned.
        worlds = [{"file": "loam.html", "name": "loam #1", "mood": "rooted", "aspect": "4 / 5", "what": "Plant."},
                  {"file": "clock.html", "name": "the clock", "mood": "tender", "aspect": "1 / 1", "what": "Tick."}]
        (self.site / "_data").mkdir()
        (self.site / "_data" / "worlds.json").write_text(json.dumps({"worlds": worlds, "wayIn": [], "finePrint": []}))
        (self.site / "loam.html").write_text(page(title="loam", body="<p>loam</p>"))
        (self.site / "js" / "modules").mkdir(parents=True)
        (self.site / "js" / "modules" / "loam.js").write_text("export default { id: 'loam' };")
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        with mock.patch.object(mi, "chosen_mode", return_value="consolidate_item"), \
                mock.patch.object(mi, "draw_items", lambda found: found[:1]):
            output = self.run_main()
        prompt = fake.calls()[0]["prompt"]
        self.assertIn("THIS RUN CONSOLIDATES LOAM 1", prompt)
        self.assertIn('loam 1 ("loam.html", module "js/modules/loam.js"): Plant.', prompt)
        self.assertLess(prompt.index("=== loam.html ==="), prompt.index("=== js/modules/loam.js ==="))
        self.assertLess(prompt.index("=== js/modules/loam.js ==="), prompt.index("=== _data/worlds.json ==="))
        outputs = read_outputs(output)
        self.assertEqual((outputs["mode"], outputs["items"], outputs["headline"]),
                         ("consolidate_item", "loam 1", "Consolidate loam 1"))
        self.assertIn("Mode:    consolidate_item (4 of 42 marbles; drawn: loam 1)", self.printed)

    def test_what_an_answer_changed_outside_its_mode_is_named_in_the_refusal(self):
        # The answer the tests refuse touched index.html and sitemap.xml in a run that works on the
        # navigation's own files: the repair round says so, beside the failing tests.
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = [
            mi.RejectedChange("the tests fail: A", details="FAIL: test_a\nAssertionError: no"), None]
        self.run_main({"RUN_MODE": "enhance_nav"})
        second = fake.calls()[1]["prompt"]
        # The sitemap the plan writes is new to this fixture, so only the home page is outside.
        self.assertIn("The details:\nFAIL: test_a\nAssertionError: no\n\nOutside this run's own files, your answer "
                      "also changed: index.html.", second)
        self.assertIn("put those back as the site above shows them unless the change cannot work without them", second)
        # Nothing of the kind on a mode whose files are the framework, or when nothing strayed.
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = [mi.RejectedChange("the tests fail: A"), None]
        self.run_main({"RUN_MODE": "consolidate_overall"})
        self.assertNotIn("Outside this run's own files", fake.calls()[1]["prompt"])

    def test_falls_back_to_another_model(self):
        # The first model asked never gives a usable answer, in its first round or in the repair
        # rounds that follow; the second does. The rounds are a model's own, the attempts are the
        # run's, and the second model is told in a line what the first got wrong.
        fake = FakeCopilot(self, f"""
            first = json.loads(open(LOG).read().splitlines()[0])['args'][1]
            if MODEL == first:
                say('I would rather write prose than JSON.')
            else:
                say({GOOD_PLAN!r})
        """)
        self.run_main()
        calls = fake.calls()
        asked = [c["args"][1] for c in calls]
        self.assertEqual(len(calls), mi.REPAIR_ROUNDS + 2)
        self.assertEqual(asked[:-1], [asked[0]] * (mi.REPAIR_ROUNDS + 1), "the first model repairs its own answer")
        self.assertNotEqual(asked[-1], asked[0], "then another model is asked")
        self.assertTrue((self.site / "clock.html").is_file())
        self.assertNotIn("EARLIER THIS RUN", calls[0]["prompt"])
        self.assertIn("EARLIER THIS RUN. Another model was asked first and its answer was refused: "
                      "the answer was not one JSON object", calls[-1]["prompt"])
        self.assertNotIn("YOUR PREVIOUS ANSWER", calls[-1]["prompt"])

    def test_gives_up_after_max_attempts_without_touching_the_site(self):
        fake = FakeCopilot(self, "say('nope')")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS))
        self.assertEqual(len({c["args"][1] for c in fake.calls()}), mi.MAX_ATTEMPTS, "each attempt is a different model")
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

    def test_a_refused_answer_is_repaired_by_its_own_model(self):
        # What a refusal says is specific -- the test it failed, the edit that matched nowhere --
        # and the model that wrote the answer is the one that can put it right with the least
        # change. It is asked again with its answer and the refusal, up to REPAIR_ROUNDS times.
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = [mi.RejectedChange("the tests fail: A")] * mi.REPAIR_ROUNDS + [None]
        output = self.run_main()
        calls = fake.calls()
        self.assertEqual(len(calls), mi.REPAIR_ROUNDS + 1)
        self.assertEqual(len({c["args"][1] for c in calls}), 1, "the same model, every round")
        for number, call in enumerate(calls[1:], 1):
            with self.subTest(round=number):
                self.assertIn("YOUR PREVIOUS ANSWER WAS REFUSED", call["prompt"])
                self.assertIn("Why it was refused: the tests fail: A.", call["prompt"])
                self.assertIn("Your answer was:\n" + GOOD_PLAN, call["prompt"])
        self.assertNotIn("YOUR PREVIOUS ANSWER", calls[0]["prompt"])
        self.assertEqual([line for line in self.printed if line.startswith("Mission:")][-1].count("repair"), 1)
        self.assertIn(f"(repair {mi.REPAIR_ROUNDS} of {mi.REPAIR_ROUNDS})", "\n".join(self.printed))
        self.assertEqual(read_outputs(output)["model"], calls[0]["args"][1])
        self.assertTrue((self.site / "clock.html").is_file())

    def test_after_the_repair_rounds_the_next_model_is_asked_with_the_lesson(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = (
            [mi.RejectedChange("the tests fail: A")] * (mi.REPAIR_ROUNDS + 1) + [None])
        output = self.run_main()
        asked = [c["args"][1] for c in fake.calls()]
        self.assertEqual(len(asked), mi.REPAIR_ROUNDS + 2)
        self.assertEqual(len(set(asked[:-1])), 1)
        self.assertNotEqual(asked[-1], asked[0])
        prompts = [c["prompt"] for c in fake.calls()]
        self.assertTrue(all("YOUR PREVIOUS ANSWER WAS REFUSED" in prompt for prompt in prompts[1:-1]))
        self.assertIn("EARLIER THIS RUN. Another model was asked first and its answer was refused: "
                      "the tests fail: A.", prompts[-1])
        self.assertNotIn("YOUR PREVIOUS ANSWER", prompts[-1])
        self.assertEqual(read_outputs(output)["model"], asked[-1])

    def test_an_answer_too_long_to_show_back_is_described_instead(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = [mi.RejectedChange("the tests fail: A"), None]
        with mock.patch.object(mi, "PRIOR_ANSWER_LIMIT", 100):
            self.run_main()
        second = fake.calls()[1]["prompt"]
        self.assertIn("too long to show back to you", second)
        self.assertIn("it said: 'Added a clock. Second line is dropped.', touching clock.html, index.html, "
                      "sitemap.xml.", second)
        self.assertNotIn(CLOCK_PAGE, second[second.index("YOUR PREVIOUS ANSWER"):])

    def test_an_answer_that_is_not_json_is_shown_back_too(self):
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                say('Here is my plan, in prose.')
            else:
                say({GOOD_PLAN!r})
        """)
        self.run_main()
        first, second = fake.calls()
        self.assertEqual(first["args"][1], second["args"][1])
        self.assertIn("Why it was refused: the answer was not one JSON object (no JSON object in model response).",
                      second["prompt"])
        self.assertIn("Your answer was:\nHere is my plan, in prose.", second["prompt"])

    def test_a_cut_off_answer_is_asked_for_again_smaller_and_with_less_effort(self):
        # The pieces of a cut-off answer that cannot be rejoined: the same model is asked once
        # more, told the answer was lost and to make this one smaller, and the rest of the run
        # asks for one step less reasoning, which is the one dial there is on how long an answer
        # takes. On 2026-10-07 this was the way three runs in five were lost.
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                print(json.dumps({{'type': 'assistant.turn_start', 'data': {{'turnId': '0'}}}}))
                say('{{"summary": "cut off half way th')
                print(json.dumps({{'type': 'assistant.turn_start', 'data': {{'turnId': '1'}}}}))
                say('rough, and cut off aga')
            else:
                say({GOOD_PLAN!r})
        """)
        with mock.patch.dict(os.environ, {"REASONING_EFFORT": ""}):
            output = self.run_main()
        first, second = fake.calls()
        self.assertEqual(first["args"][1], second["args"][1], "the same model, asked again")
        self.assertEqual(first["args"][2:4], ["--reasoning-effort", "xhigh"])
        self.assertEqual(second["args"][2:4], ["--reasoning-effort", "high"])
        self.assertNotIn("YOUR PREVIOUS ANSWER", first["prompt"])
        self.assertIn("YOUR PREVIOUS ANSWER WAS REFUSED", second["prompt"])
        self.assertIn("What went wrong: the answer ran past the model's output limit.", second["prompt"])
        self.assertIn("Answer again, much smaller", second["prompt"])
        self.assertTrue([line for line in self.printed if "Reasoning effort xhigh -> high" in line])
        self.assertIn("\nEffort:  xhigh", "\n".join(self.printed))
        self.assertIn("\nEffort:  high", "\n".join(self.printed))
        self.assertEqual(read_outputs(output)["summary"], "Added a clock.")

    def test_a_model_that_runs_out_of_time_is_replaced_rather_than_asked_again(self):
        # A model still writing after its quarter of an hour is not one more round away: the next
        # model is asked, told what happened, and asked for one step less reasoning.
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                import time; time.sleep(60)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 1.5), mock.patch.dict(os.environ, {"REASONING_EFFORT": ""}):
            output = self.run_main()
        first, second = fake.calls()
        self.assertNotEqual(first["args"][1], second["args"][1])
        self.assertEqual(first["args"][2:4], ["--reasoning-effort", "xhigh"])
        self.assertEqual(second["args"][2:4], ["--reasoning-effort", "high"])
        self.assertIn("EARLIER THIS RUN. Another model was asked first and its answer was refused: "
                      "no answer within 1.5s.", second["prompt"])
        self.assertEqual(read_outputs(output)["model"], second["args"][1])

    def test_no_call_starts_once_the_run_is_out_of_time(self):
        # The run's own deadline: the hourly cadence holds whatever the models do, and a call that
        # could not finish in what is left is not started.
        fake = FakeCopilot(self, "import time; time.sleep(0.6); say('nope')")
        with mock.patch.object(mi, "RUN_BUDGET_SECONDS", 1.0), mock.patch.object(mi, "MIN_CALL_SECONDS", 0.5):
            with self.assertRaises(SystemExit) as caught:
                self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), 1, "a second call would have started with less than MIN_CALL_SECONDS left")
        self.assertTrue([line for line in self.printed if line.startswith("::warning::Out of time")])
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

    def test_a_call_near_the_deadline_gets_only_what_is_left(self):
        # Rather than the usual quarter of an hour: the deadline is the deadline.
        fake = FakeCopilot(self, "import time; time.sleep(60)")
        started = time.monotonic()
        with mock.patch.object(mi, "RUN_BUDGET_SECONDS", 1.5), mock.patch.object(mi, "MIN_CALL_SECONDS", 0.1):
            with self.assertRaises(SystemExit):
                self.run_main()
        self.assertLess(time.monotonic() - started, 20)
        self.assertEqual(len(fake.calls()), 1)
        self.assertTrue([line for line in self.printed if "failed: no answer within" in line])

    def test_unavailable_models_are_skipped_without_using_an_attempt(self):
        # Every model but one is "retired"; the survivor must be reached however the pool is shuffled.
        survivor = mi.MODELS[-1]
        fake = FakeCopilot(self, f"""
            if MODEL != {survivor!r}:
                sys.stderr.write('Error: Model "%s" from --model flag is not available.' % MODEL)
                sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi.random, "sample", lambda pool, k: list(pool)):
            output = self.run_main()
        self.assertEqual(len(fake.calls()), len(mi.MODELS))
        notice = [line for line in self.printed if line.startswith("::notice::")][-1]
        self.assertIn(f"{len(mi.MODELS) - 1} of the {len(mi.MODELS)} models tried this run are not available", notice)
        self.assertIn(mi.MODELS[0], notice)
        self.assertEqual(read_outputs(output)["model"], survivor)
        self.assertTrue((self.site / "clock.html").is_file())

    def test_notice_counts_only_the_models_that_were_tried(self):
        # The second model in line is the first that works: one was found unavailable, eleven or
        # so were never asked, and the notice must not pretend to know about those.
        first, second = mi.MODELS[0], mi.MODELS[1]
        FakeCopilot(self, f"""
            if MODEL == {first!r}:
                sys.stderr.write('Error: Model "%s" from --model flag is not available.' % MODEL)
                sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi.random, "sample", lambda pool, k: list(pool)):
            output = self.run_main()
        self.assertEqual(read_outputs(output)["model"], second)
        notice = [line for line in self.printed if line.startswith("::notice::")][-1]
        self.assertIn("1 of the 2 models tried this run are not available", notice)
        self.assertIn(f"The pool has {len(mi.MODELS)}", notice)

    def test_silo_breach_stops_the_run_and_applies_nothing(self):
        fake = FakeCopilot(self, f"""
            print(json.dumps({{'type': 'tool.execution_start', 'data': {{'toolName': 'bash'}}}}))
            say({GOOD_PLAN!r})
        """)
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("Stopping without applying anything", str(caught.exception))
        self.assertEqual(len(fake.calls()), 1)
        self.assertFalse((self.site / "clock.html").exists())

    def test_files_left_out_of_the_prompt_are_protected_end_to_end(self):
        (self.site / "zz-huge.js").write_text("y" * (mi.PROMPT_BUDGET_CHARS + 1))
        blind = json.dumps({"summary": "x", "files": [{"path": "zz-huge.js", "content": "rewritten blind"}]})
        FakeCopilot(self, f"say({blind!r})")
        with self.assertRaises(SystemExit):
            self.run_main()
        self.assertEqual(len((self.site / "zz-huge.js").read_text()), mi.PROMPT_BUDGET_CHARS + 1)

    def test_a_failed_write_stops_the_run(self):
        FakeCopilot(self, f"say({GOOD_PLAN!r})")
        with mock.patch.object(mi.Path, "write_text", side_effect=OSError("disk full")):
            with self.assertRaises(SystemExit) as caught:
                self.run_main()
        self.assertIn("Could not apply the change", str(caught.exception))

    def test_small_models_in_a_configured_pool_are_never_asked(self):
        fake = FakeCopilot(self, "say('nope')")
        with self.assertRaises(SystemExit):
            self.run_main({"MODEL_POOL": "claude-haiku-4.5,big-a,gpt-5-mini,big-b,claude-sonnet-5,big-c,big-d"})
        asked = [c["args"][1] for c in fake.calls()]
        self.assertEqual(len(asked), mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS))
        self.assertTrue(set(asked) <= {"big-a", "big-b", "big-c", "big-d"}, asked)

    def test_requested_model_is_the_only_one_tried(self):
        fake = FakeCopilot(self, "say('nope')")
        with self.assertRaises(SystemExit):
            self.run_main({"MODEL": " my-model "})
        self.assertEqual([c["args"][1] for c in fake.calls()], ["my-model"] * (mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS)))

    def test_a_lone_available_model_is_asked_again_after_a_bad_answer(self):
        # The situation on an account that is offered a single model: everything else is skipped,
        # and the one model that answers gets the remaining attempts. It is drawn last here so
        # that every other model is found unavailable first; drawn first, it would repair its own
        # answer before any other model was asked at all, which is also right.
        survivor = mi.MODELS[-1]
        fake = FakeCopilot(self, f"""
            if MODEL != {survivor!r}:
                sys.stderr.write('Error: Model "%s" from --model flag is not available.' % MODEL)
                sys.exit(1)
            mine = [line for line in open(LOG).read().splitlines() if json.loads(line)['args'][1] == MODEL]
            say('not json' if len(mine) < 2 else {GOOD_PLAN!r})
        """)
        with mock.patch.object(mi.random, "sample", lambda pool, k: list(pool)):
            output = self.run_main()
        asked = [c["args"][1] for c in fake.calls()]
        self.assertEqual(asked.count(survivor), 2)
        notice = [line for line in self.printed if line.startswith("::notice::")][-1]
        self.assertIn(f"{len(mi.MODELS) - 1} of the {len(mi.MODELS)} models tried this run are not available", notice)
        self.assertEqual(len(asked), len(mi.MODELS) + 1, "unavailable models are not asked twice")
        self.assertEqual(read_outputs(output)["model"], survivor)

    def test_gives_up_when_no_model_is_available(self):
        fake = FakeCopilot(self, "sys.stderr.write('Error: Model \"x\" from --model flag is not available.'); sys.exit(1)")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), len(mi.MODELS))
        count = len(mi.MODELS)
        notice = [line for line in self.printed if line.startswith("::notice::")][-1]
        self.assertIn(f"{count} of the {count} models tried this run are not available", notice)
        self.assertIn(f"The pool has {count}.", notice)
        skipped = [line for line in self.printed if " is not available" in line and not line.startswith("::")]
        self.assertEqual(len(skipped), count)
        self.assertTrue(all("trying another model" in line for line in skipped[:-1]))
        self.assertNotIn("trying another model", skipped[-1], "nothing was left to try")

    def test_a_model_named_by_hand_that_is_unavailable_is_reported_plainly(self):
        fake = FakeCopilot(self, "sys.stderr.write('Error: Model \"x\" from --model flag is not available.'); sys.exit(1)")
        with self.assertRaises(SystemExit):
            self.run_main({"MODEL": "claude-fable-5.1"})
        self.assertEqual(len(fake.calls()), 1)
        log = "\n".join(self.printed)
        self.assertNotIn("trying another model", log)
        self.assertNotIn("The pool has", log)
        self.assertIn("1 of the 1 models tried this run are not available", log)

    def test_a_lone_model_is_asked_again_after_a_cli_failure(self):
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                sys.stderr.write('Error: rate limit exceeded')
                sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi, "pause_before_retry") as slept:
            output = self.run_main({"MODEL": "only-model"})
        self.assertEqual([c["args"][1] for c in fake.calls()], ["only-model", "only-model"])
        self.assertEqual(read_outputs(output)["model"], "only-model")
        # The CLI failed, not the model: the same question is asked again, with nothing added --
        # and a rate limit is not helped by asking at once, so not before a pause.
        self.assertNotIn("YOUR PREVIOUS ANSWER", fake.calls()[1]["prompt"])
        self.assertNotIn("EARLIER THIS RUN", fake.calls()[1]["prompt"])
        slept.assert_called_once_with(mi.RETRY_PAUSE_SECONDS)
        self.assertTrue([line for line in self.printed if "passing failure; waiting 30s" in line])

    def test_a_cli_failure_that_will_not_pass_is_asked_again_at_once(self):
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                sys.stderr.write('Error: something else entirely')
                sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi, "pause_before_retry") as slept:
            self.run_main({"MODEL": "only-model"})
        self.assertEqual(len(fake.calls()), 2)
        slept.assert_not_called()

    def test_the_pause_never_eats_the_time_a_call_needs(self):
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 2:
                sys.stderr.write('Error: 503 Service Unavailable')
                sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi, "RUN_BUDGET_SECONDS", mi.MIN_CALL_SECONDS + 10), \
                mock.patch.object(mi, "pause_before_retry") as slept:
            self.run_main({"MODEL": "only-model"})
        self.assertEqual(len(fake.calls()), 2)
        (pause,) = slept.call_args.args
        self.assertLess(pause, 10.5)
        self.assertGreater(pause, 0)
        for message in ["rate limit exceeded", "429 Too Many Requests", "502 Bad Gateway", "ECONNRESET",
                        "fetch failed", "model is overloaded, try again later", "network error"]:
            with self.subTest(message=message):
                self.assertTrue(mi.TRANSIENT_ERROR.search(message))
        for message in ["invalid JSON", "the model refused", "status 400"]:
            with self.subTest(message=message):
                self.assertFalse(mi.TRANSIENT_ERROR.search(message))

    def test_a_fault_in_the_checking_costs_a_round_and_not_the_run(self):
        # This script's own checks raised, on an answer in hand: the same model is asked once more,
        # and the fault is in the log in full rather than being the end of the run.
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        real = mi.validate_plan
        with mock.patch.object(mi, "validate_plan", side_effect=[KeyError("boom"), real(json.loads(GOOD_PLAN))]):
            output = self.run_main({"MODEL": "only-model"})
        self.assertEqual(len(fake.calls()), 2)
        self.assertEqual(read_outputs(output)["summary"], "Added a clock.")
        self.assertTrue([line for line in self.printed if "this script's own checking raised KeyError: 'boom'" in line])
        self.assertNotIn("YOUR PREVIOUS ANSWER", fake.calls()[1]["prompt"])
        self.assertTrue((self.site / "clock.html").is_file())

    def test_a_fault_in_the_checking_is_bounded_like_every_other_path(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        with mock.patch.object(mi, "validate_plan", side_effect=KeyError("boom")):
            with self.assertRaises(SystemExit) as caught:
                self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS))
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

    def test_a_cli_failure_is_no_lesson_for_the_next_model(self):
        # What the next model is told is what the last one got wrong about the answer; a CLI that
        # died is nothing the model did, so the next model is asked the plain question.
        fake = FakeCopilot(self, f"""
            first = json.loads(open(LOG).read().splitlines()[0])['args'][1]
            if MODEL == first:
                sys.stderr.write('Error: rate limit exceeded'); sys.exit(1)
            say({GOOD_PLAN!r})
        """)
        with mock.patch.object(mi, "pause_before_retry"):
            self.run_main()
        calls = fake.calls()
        self.assertEqual(len(calls), mi.REPAIR_ROUNDS + 2)
        self.assertNotEqual(calls[-1]["args"][1], calls[0]["args"][1])
        for call in calls:
            self.assertNotIn("EARLIER THIS RUN", call["prompt"])
            self.assertNotIn("YOUR PREVIOUS ANSWER", call["prompt"])

    def test_auth_failure_stops_immediately_with_setup_help(self):
        fake = FakeCopilot(self, "sys.stderr.write('Error: Access denied by policy settings'); sys.exit(1)")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("COPILOT_GITHUB_TOKEN", str(caught.exception))
        self.assertEqual(len(fake.calls()), 1, "no point trying other models")

    def test_an_answer_the_tests_refuse_is_not_written_and_its_model_is_asked_to_repair_it(self):
        # The gate comes after the axioms and before anything is written: an answer that holds to
        # all nine but fails the tests every deploy waits on is refused like any other, and the
        # model that wrote it is shown the answer and the failures and asked for the plan again,
        # rather than the run pushing a commit that blocks the deploy or starting over.
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        refusal = "the tests every deploy waits on fail with this change: RealSiteTest.test_x (AssertionError: no)"
        written = []

        def gate(ops):
            written.append((self.site / "clock.html").exists())
            if len(written) == 1:
                raise mi.RejectedChange(refusal, details="FAIL: test_x (RealSiteTest.test_x)\nAssertionError: no")

        self.require_passing_tests.side_effect = gate
        output = self.run_main()
        self.assertEqual(written, [False, False], "the gate ran after the change was written")
        calls = fake.calls()
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["args"][1], calls[1]["args"][1], "the model that wrote the answer repairs it")
        self.assertIn(f"::warning::{calls[0]['args'][1]} failed: {refusal}", self.printed)
        second = calls[1]["prompt"]
        self.assertIn("YOUR PREVIOUS ANSWER WAS REFUSED", second)
        self.assertIn(f"Why it was refused: {refusal}.", second)
        self.assertIn("The details:\nFAIL: test_x (RealSiteTest.test_x)\nAssertionError: no", second)
        self.assertIn("Your answer was:\n" + GOOD_PLAN, second)
        self.assertLess(second.index("=== index.html ==="), second.index("YOUR PREVIOUS ANSWER"))
        self.assertLess(second.index("YOUR PREVIOUS ANSWER"), second.index("This run's mission:"))
        self.assertEqual(read_outputs(output)["model"], calls[1]["args"][1])
        (ops,) = self.require_passing_tests.call_args.args
        self.assertIn(("write", self.site / "clock.html", CLOCK_PAGE), ops)
        self.assertEqual((self.site / "clock.html").read_text(), CLOCK_PAGE)

    def test_a_run_whose_every_answer_the_tests_refuse_writes_nothing(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        self.require_passing_tests.side_effect = mi.RejectedChange("the tests every deploy waits on fail")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS))
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

    def test_rejected_plan_is_not_applied_even_in_part(self):
        evil = json.dumps({"summary": "x", "files": [{"path": "fine.html", "content": "x"},
                                                     {"path": "../pwned.html", "content": "x"}],
                           "delete": ["error.html"]})
        fake = FakeCopilot(self, f"say({evil!r})")
        with self.assertRaises(SystemExit):
            self.run_main()
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS * (1 + mi.REPAIR_ROUNDS), "the model was really asked")
        self.assertFalse((self.root / "pwned.html").exists())
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])


class DeployGateTest(unittest.TestCase):
    """No answer is written that fails the tests every deploy waits on.

    The gate is run for real here, on a repository of its own: a site and a suite of four tests
    about it, standing in for this one, whose suite would take the gate a whole run of this file.
    """

    REPO = Path(mi.__file__).resolve().parents[2]  # the real one, for the workflows

    FAKE_SUITE = '''
        import os
        import time
        import unittest
        from pathlib import Path

        ROOT = Path(__file__).resolve().parents[2]


        class FakeSiteTest(unittest.TestCase):
            def test_the_home_page_is_whole(self):
                page = (ROOT / "site" / "index.html").read_text()
                if "slow" in page:
                    time.sleep(60)
                self.assertNotIn("broken", page, page)

            def test_the_retired_page_is_gone(self):
                self.assertFalse((ROOT / "site" / "retired.html").exists())

            def test_the_suite_runs_on_the_tree_as_committed(self):
                self.assertFalse((ROOT / ".git").exists())
                self.assertTrue((ROOT / "node_modules" / "eleventy").is_dir())

            def test_nothing_of_the_run_reaches_the_suite(self):
                self.assertEqual(os.environ.get("CI"), "from-the-runner")
                for name in ["COPILOT_GITHUB_TOKEN", "GITHUB_TOKEN", "GITHUB_OUTPUT", "MODEL"]:
                    self.assertNotIn(name, os.environ)
    '''

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name).resolve() / "repository"
        self.site = self.root / "site"
        scripts = self.root / ".github" / "scripts"
        scripts.mkdir(parents=True)
        (scripts / "test_fake_site.py").write_text(textwrap.dedent(self.FAKE_SUITE))
        self.site.mkdir()
        (self.site / "index.html").write_text("<h1>home</h1>")
        (self.site / "retired.html").write_text("<h1>retired</h1>")
        (self.root / ".git").mkdir()
        (self.root / ".git" / "HEAD").write_text("ref: refs/heads/main\n")
        (self.root / "node_modules" / "eleventy").mkdir(parents=True)
        for name, value in [("REPO_ROOT", self.root), ("SITE_DIR", self.site)]:
            patcher = mock.patch.object(mi, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        # What the workflow's step holds while the script runs, none of which the suite may see.
        env = mock.patch.dict(os.environ, {"COPILOT_GITHUB_TOKEN": "secret", "GITHUB_TOKEN": "secret",
                                           "GITHUB_OUTPUT": str(self.root / "output"), "MODEL": "model-a",
                                           "CI": "from-the-runner"})
        env.start()
        self.addCleanup(env.stop)
        os.environ.pop(mi.INSIDE_THE_GATE, None)  # this file may itself be the suite a gate is running
        self.printed = []
        printer = mock.patch("builtins.print", lambda *args, **kwargs: self.printed.append(" ".join(map(str, args))))
        printer.start()
        self.addCleanup(printer.stop)

    def untouched(self):
        self.assertEqual((self.site / "index.html").read_text(), "<h1>home</h1>")
        self.assertTrue((self.site / "retired.html").is_file())

    def test_a_change_that_passes_the_suite_is_let_through_without_being_written(self):
        mi.require_passing_tests([("write", self.site / "index.html", "<h1>home, again</h1>"),
                        ("delete", self.site / "retired.html", None)])
        self.untouched()
        self.assertEqual(self.printed, [])

    def test_a_change_that_fails_the_suite_is_refused_naming_every_test_it_fails(self):
        with self.assertRaises(mi.RejectedChange) as caught:
            mi.require_passing_tests([("write", self.site / "index.html", "<h1>broken</h1>")])
        refusal = str(caught.exception)
        self.assertIn("(test.yml) fail with this change: FakeSiteTest.test_the_home_page_is_whole, "
                      "FakeSiteTest.test_the_retired_page_is_gone "
                      "(AssertionError: 'broken' unexpectedly found", refusal)
        self.assertNotIn("test_nothing_of_the_run_reaches_the_suite", refusal)
        self.assertNotIn("test_the_suite_runs_on_the_tree_as_committed", refusal)
        # What the model is shown when it is asked to repair the answer: every failure, as its
        # name and its message, and nothing of the traceback.
        details = caught.exception.details
        self.assertIn("FAIL: test_the_home_page_is_whole (test_fake_site.FakeSiteTest.test_the_home_page_is_whole)\n"
                      "AssertionError: 'broken' unexpectedly found in '<h1>broken</h1>'", details)
        self.assertIn("FAIL: test_the_retired_page_is_gone (test_fake_site.FakeSiteTest.test_the_retired_page_is_gone)\n"
                      "AssertionError: True is not false", details)
        self.assertNotIn("Traceback", details)
        self.assertNotIn("Ran 4 tests", details)
        self.untouched()

    def test_the_log_shows_the_failures_and_obeys_none_of_what_they_quote(self):
        # The model writes what a failing assertion quotes, so a line of it can look like a
        # workflow command; the runner is told to ignore commands until the report is over.
        with self.assertRaises(mi.RejectedChange):
            mi.require_passing_tests([("write", self.site / "index.html", "broken\n::error::forged by the page")])
        (log,) = self.printed
        lines = log.splitlines()
        self.assertEqual(lines[0], "::group::The tests this change fails")
        self.assertTrue(lines[1].startswith("::stop-commands::"))
        token = lines[1][len("::stop-commands::"):]
        self.assertGreaterEqual(len(token), 32)
        self.assertEqual(lines[-2:], [f"::{token}::", "::endgroup::"])
        forged = lines.index("::error::forged by the page")
        self.assertTrue(1 < forged < len(lines) - 2)
        self.assertIn("FAIL: test_the_home_page_is_whole", log)

    def test_a_suite_that_does_not_finish_in_time_refuses_the_change(self):
        with mock.patch.object(mi, "TESTS_TIMEOUT_SECONDS", 3):
            with self.assertRaises(mi.RejectedChange) as caught:
                mi.require_passing_tests([("write", self.site / "index.html", "slow")])
        self.assertIn("did not finish within 3s", str(caught.exception))
        self.untouched()

    def test_the_suite_the_gate_runs_does_not_run_it_again(self):
        # A test that reaches main() inside the gate's own suite would otherwise start that suite
        # again inside itself, and again inside that.
        with mock.patch.dict(os.environ, {mi.INSIDE_THE_GATE: "1"}):
            with mock.patch.object(mi.subprocess, "Popen", side_effect=AssertionError("the suite was started")):
                mi.require_passing_tests([("write", self.site / "index.html", "<h1>broken</h1>")])

    def test_failures_are_named_by_class_and_test_on_every_python(self):
        report = textwrap.dedent("""\
            test_a (suite.SomeTest.test_a) ... FAIL
            ======================================================================
            FAIL: test_a (suite.SomeTest.test_a) (world='x')
            What the test checks, from its docstring.
            ----------------------------------------------------------------------
            Traceback (most recent call last):
              File "suite.py", line 3, in test_a
                self.assertEqual(1, 2)
            AssertionError: 1 != 2

            ======================================================================
            FAIL: test_a (suite.SomeTest.test_a) (world='y')
            ======================================================================
            ERROR: test_b (suite.OtherTest)
            ======================================================================
            ERROR: setUpClass (suite.RealSiteTest)
            ----------------------------------------------------------------------
            Ran 3 tests in 0.1s

            FAILED (failures=2, errors=2)
        """)
        self.assertEqual(mi.failing_tests(report),
                         ["SomeTest.test_a", "OtherTest.test_b", "RealSiteTest.setUpClass"])
        self.assertEqual(mi.first_failure(report), "AssertionError: 1 != 2")
        self.assertEqual(mi.failure_digest(report), textwrap.dedent("""\
            FAIL: test_a (suite.SomeTest.test_a) (world='x')
            What the test checks, from its docstring.
            AssertionError: 1 != 2

            FAIL: test_a (suite.SomeTest.test_a) (world='y')

            ERROR: test_b (suite.OtherTest)

            ERROR: setUpClass (suite.RealSiteTest)"""))
        self.assertEqual(mi.failure_digest(report, limit=20), "FAIL: test_a (suite.")
        self.assertEqual(mi.first_failure("Traceback ...\nSyntaxError: bad\n"), "SyntaxError: bad")

    def test_the_gate_runs_test_yml_s_own_command(self):
        test = (self.REPO / ".github" / "workflows" / "test.yml").read_text()
        self.assertIn("run: python3 " + " ".join(mi.TEST_COMMAND) + "\n", test)
        self.assertEqual(mi.TEST_COMMAND[mi.TEST_COMMAND.index("-s") + 1], mi.TESTS_DIR)
        self.assertEqual(Path(mi.__file__).resolve().parent, self.REPO / mi.TESTS_DIR)

    def test_a_rebased_change_is_tested_again_before_it_is_pushed(self):
        # The script tested the change on the main it started from. If main has moved by the time
        # of the push, the rebased commit is a tree nobody has tested, and the workflow runs the
        # same command on it inside the push loop -- with no token in reach.
        workflow = (self.REPO / ".github" / "workflows" / "make-interesting.yml").read_text()
        step = workflow[workflow.index("- name: Commit and push"):]
        loop = step[step.index("for attempt in"):step.index("\n          done\n")]
        rebase = loop.index("git pull --rebase")
        retest = loop.index("python3 " + " ".join(mi.TEST_COMMAND) + "; then")
        self.assertLess(rebase, retest)
        self.assertIn("break", loop[retest:], "a change that fails once rebased is still pushed")
        given = re.search(r"env -i ((?:\w+=\S+ )+)python3", loop).group(1)
        self.assertLessEqual(set(re.findall(r"(\w+)=", given)), set(mi.TEST_ENVIRONMENT))


class ScriptSmokeTest(unittest.TestCase):
    def test_script_compiles_and_reports_missing_site(self):
        script = Path(mi.__file__)
        with tempfile.TemporaryDirectory() as tmp:
            proc = subprocess.run([sys.executable, str(script)], capture_output=True, text=True,
                                  env=dict(os.environ, SITE_DIR=str(Path(tmp) / "missing")))
        self.assertEqual(proc.returncode, 1)
        self.assertIn("site directory not found", proc.stderr)


if __name__ == "__main__":
    unittest.main()
