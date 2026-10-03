#!/usr/bin/env python3
"""Tests for make_interesting.py. Standard library only; no model is ever called.

Run with:  python3 -m unittest discover -s .github/scripts -v
"""

import json
import os
import shlex
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


def sitemap(*pages):
    """A sitemaps.org urlset listing `pages`, written the way /site writes one: relative <loc>s."""
    locs = "".join(f"  <url><loc>{page}</loc></url>\n" for page in pages)
    return ("<?xml version='1.0' encoding='UTF-8'?>\n"
            "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>\n" + locs + "</urlset>\n")


def home(*links):
    """A home page whose navigation links to `links`."""
    return "<h1>interesting</h1>\n<nav>" + "".join(f"<a href='{to}'>{to}</a>" for to in links) + "</nav>"


class SiteDirTestCase(unittest.TestCase):
    """Points the script at a throwaway /site so no test touches the real one."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name).resolve()
        self.site = self.root / "site"
        self.site.mkdir()
        (self.site / "index.html").write_text("<h1>interesting</h1>")
        (self.site / "error.html").write_text("<h1>not found</h1>")
        patcher = mock.patch.object(mi, "SITE_DIR", self.site)
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
        self.assertIn("content omitted for size): huge.js", prompt)
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


class WholeSiteReviewTest(unittest.TestCase):
    """Issue #16: every run begins by weighing the site as a whole, and federating what is already
    there is a successful run in its own right, not a lesser outcome than adding a page."""

    def prompt(self, omitted=()):
        return mi.build_prompt([("index.html", "<h1>hi</h1>")], omitted)

    def test_the_mission_string_itself_carries_the_holistic_aim(self):
        # Issue #16, question 4: the mission string itself should change, not only the surrounding
        # guidance. It still opens with the original phrase so every other use reads naturally.
        self.assertTrue(mi.MISSION.startswith("make the website more interesting"))
        self.assertNotEqual(mi.MISSION, "make the website more interesting")
        self.assertIn("coherent whole", mi.MISSION)

    def test_every_run_is_asked_to_weigh_the_site_as_a_whole_first(self):
        prompt = self.prompt()
        self.assertIn("Begin every run", prompt)
        self.assertIn("look at the site as a whole", prompt)
        self.assertLess(prompt.index("site as a whole"), prompt.index("ADD something"),
                        "the review has to come before the choice of change")

    def test_federation_is_offered_as_concretely_as_adding(self):
        prompt = self.prompt().lower()
        self.assertIn("add something", prompt)
        self.assertIn("federate", prompt)
        for move in ["shared files", "css/site.css", "js/site.js", "header and navigation",
                     "visual language", "merge pages that overlap", "retire"]:
            with self.subTest(move=move):
                self.assertIn(move, prompt)

    def test_a_run_that_only_federates_is_called_a_success(self):
        # validate_plan() has always accepted a plan that only deletes; now the prompt invites one.
        prompt = self.prompt()
        self.assertIn("complete and successful run", prompt)
        self.assertIn("only deleting", prompt)
        self.assertIn("only deletes is accepted", prompt)
        self.assertIn("do not add for the sake of adding", prompt)

    def test_a_federation_may_not_leave_the_site_half_done(self):
        prompt = self.prompt()
        self.assertIn("Leave the site working at the end of the run", prompt)
        self.assertIn("update every page that refers to it in the same run", prompt)
        self.assertIn("coherent stages", prompt)  # a federation too big for one answer

    def test_the_silo_rules_survive_the_new_guidance(self):
        prompt = self.prompt(["hidden.html"])
        for rule in ["Only static files", "relative to the site root",
                     "index.html, error.html and sitemap.xml must always exist",
                     f"at most {mi.MAX_FILE_BYTES // 1000} KB", "COMPLETE new content",
                     f"At most {mi.MAX_CHANGES} files per run", "may not change or delete them"]:
            with self.subTest(rule=rule):
                self.assertIn(rule, prompt)

    # A run can only federate what it was shown, so the budget has to carry the whole site with
    # room for it to keep growing. This stand-in is half again as big as the site was when the
    # whole-site review was introduced (nine files, 232 KB, the largest 42 KB).
    GROWN_SITE = ([("index.html", "i" * 50_000), ("error.html", "e" * 50_000)]
                  + [(f"page-{i:02d}.html", "x" * 22_000) for i in range(12)])

    def test_a_site_half_again_as_big_as_this_one_is_still_shown_whole(self):
        shown, omitted = mi.split_for_prompt(list(self.GROWN_SITE))
        self.assertEqual(omitted, [], "the prompt cannot carry the whole site, so a run cannot federate it")
        self.assertEqual(len(shown), len(self.GROWN_SITE))

    def test_one_run_may_rewrite_a_whole_site_and_add_the_files_it_shares(self):
        # Lifting the repeated parts into "css/site.css" and "js/site.js" and relinking every page
        # of a site that size takes len + 2 changes; the limit must not forbid it.
        self.assertGreaterEqual(mi.MAX_CHANGES, len(self.GROWN_SITE) + 2)


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
        orphan = {"files": [{"path": "new.html", "content": "<p>new</p>"}]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not reachable.*not listed"):
            mi.validate_plan(orphan)
        linked_only = {"files": [{"path": "new.html", "content": "<p>new</p>"},
                                 {"path": "index.html", "content": home("toy.html", "error.html", "new.html")}]}
        with self.assertRaisesRegex(mi.RejectedChange, r"new\.html is not listed in sitemap\.xml"):
            mi.validate_plan(linked_only)
        listed_only = {"files": [{"path": "new.html", "content": "<p>new</p>"},
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


class RealSiteTest(unittest.TestCase):
    """The site in this repository obeys the reachability axiom.

    validate_plan only refuses what a run breaks, so the invariant has to start out true: this is
    what makes it hold from the next deploy onward and not only for pages a later run adds. It
    runs on every pull request and on main before each deploy, so a hand-written commit that
    orphans a page is caught there too.
    """

    def setUp(self):
        site = Path(mi.__file__).resolve().parents[2] / "site"
        if not site.is_dir():
            self.skipTest(f"no site directory at {site}")
        patcher = mock.patch.object(mi, "SITE_DIR", site)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.site = dict(mi.read_site())

    def test_every_page_is_reachable_from_the_root_and_listed_in_the_sitemap(self):
        self.assertEqual(mi.unreachable_pages(self.site), {})
        self.assertGreater(len(mi.html_pages(self.site)), 1, "the check is worth nothing on one page")

    def test_the_site_has_a_sitemap_of_both_kinds(self):
        # Open question 2 of the issue: both. sitemap.xml for anything reading the site
        # mechanically, and a page a visitor can read, reachable from the home page.
        self.assertIn("sitemap.xml", self.site)
        self.assertIn("sitemap.html", mi.links_from("index.html", self.site))


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
            "with open(LOG, 'a') as fh:\n"
            "    fh.write(json.dumps({'args': ARGS, 'prompt': PROMPT, 'cwd': os.getcwd(),\n"
            "                         'listing': os.listdir('.')}) + '\\n')\n"
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
        self.assertEqual(mi.call_model("model-a", "the prompt"), "hello model-a")
        (call,) = fake.calls()
        self.assertEqual(call["prompt"], "the prompt")
        self.assertEqual(call["listing"], [])
        self.assertNotEqual(Path(call["cwd"]).resolve(), Path.cwd().resolve())
        self.assertFalse(Path(call["cwd"]).exists(), "the silo directory is removed afterwards")
        args = call["args"]
        self.assertEqual(args[:2], ["--model", "model-a"])
        self.assertEqual(args[2:], mi.COPILOT_FLAGS)

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


# A plan that respects the reachability axiom (issue #21): the page it adds is linked from the home
# page and listed in the sitemap by the same answer, so nothing it leaves behind is orphaned.
GOOD_PLAN = json.dumps({
    "summary": "Added a clock.\nSecond line is dropped.",
    "files": [
        {"path": "clock.html", "content": "<p>tick</p>"},
        {"path": "index.html", "content": home("clock.html", "error.html")},
        {"path": "sitemap.xml", "content": sitemap("index.html", "clock.html", "error.html")},
    ],
})


class MainTest(SiteDirTestCase):
    def run_main(self, env=None):
        out = self.root / "github_output"
        full_env = {"GITHUB_OUTPUT": str(out), "MODEL": "", "MODEL_POOL": ""}
        full_env.update(env or {})
        self.printed = []
        with mock.patch.dict(os.environ, full_env):
            with mock.patch("builtins.print", lambda *args, **kwargs: self.printed.append(" ".join(map(str, args)))):
                mi.main()
        return out.read_text() if out.exists() else ""

    def test_applies_first_usable_answer_and_reports_it(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        output = self.run_main()
        self.assertFalse([line for line in self.printed if "not available" in line])
        self.assertEqual((self.site / "clock.html").read_text(), "<p>tick</p>")
        (call,) = fake.calls()
        model = call["args"][1]
        self.assertIn(model, mi.MODELS)
        self.assertEqual(read_outputs(output), {"model": model, "summary": "Added a clock."})

    def test_falls_back_to_another_model(self):
        fake = FakeCopilot(self, f"""
            if len(open(LOG).read().splitlines()) < 3:  # the first two models asked
                say('I would rather write prose than JSON.')
            else:
                say({GOOD_PLAN!r})
        """)
        self.run_main()
        calls = fake.calls()
        self.assertEqual(len(calls), mi.MAX_ATTEMPTS)
        self.assertEqual(len({c["args"][1] for c in calls}), mi.MAX_ATTEMPTS, "each attempt uses a different model")
        self.assertTrue((self.site / "clock.html").is_file())

    def test_gives_up_after_max_attempts_without_touching_the_site(self):
        fake = FakeCopilot(self, "say('nope')")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("No model produced a usable change", str(caught.exception))
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS)
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])

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
        self.assertEqual(len(asked), mi.MAX_ATTEMPTS)
        self.assertTrue(set(asked) <= {"big-a", "big-b", "big-c", "big-d"}, asked)

    def test_requested_model_is_the_only_one_tried(self):
        fake = FakeCopilot(self, "say('nope')")
        with self.assertRaises(SystemExit):
            self.run_main({"MODEL": " my-model "})
        self.assertEqual([c["args"][1] for c in fake.calls()], ["my-model"] * mi.MAX_ATTEMPTS)

    def test_a_lone_available_model_is_asked_again_after_a_bad_answer(self):
        # The situation on an account that is offered a single model: everything else is skipped,
        # and the one model that answers gets the remaining attempts.
        survivor = mi.MODELS[0]
        fake = FakeCopilot(self, f"""
            if MODEL != {survivor!r}:
                sys.stderr.write('Error: Model "%s" from --model flag is not available.' % MODEL)
                sys.exit(1)
            mine = [line for line in open(LOG).read().splitlines() if json.loads(line)['args'][1] == MODEL]
            say('not json' if len(mine) < 2 else {GOOD_PLAN!r})
        """)
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
        output = self.run_main({"MODEL": "only-model"})
        self.assertEqual([c["args"][1] for c in fake.calls()], ["only-model", "only-model"])
        self.assertEqual(read_outputs(output)["model"], "only-model")

    def test_auth_failure_stops_immediately_with_setup_help(self):
        fake = FakeCopilot(self, "sys.stderr.write('Error: Access denied by policy settings'); sys.exit(1)")
        with self.assertRaises(SystemExit) as caught:
            self.run_main()
        self.assertIn("COPILOT_GITHUB_TOKEN", str(caught.exception))
        self.assertEqual(len(fake.calls()), 1, "no point trying other models")

    def test_rejected_plan_is_not_applied_even_in_part(self):
        evil = json.dumps({"summary": "x", "files": [{"path": "fine.html", "content": "x"},
                                                     {"path": "../pwned.html", "content": "x"}],
                           "delete": ["error.html"]})
        fake = FakeCopilot(self, f"say({evil!r})")
        with self.assertRaises(SystemExit):
            self.run_main()
        self.assertEqual(len(fake.calls()), mi.MAX_ATTEMPTS, "the model was really asked")
        self.assertFalse((self.root / "pwned.html").exists())
        self.assertEqual(sorted(p.name for p in self.site.iterdir()), ["error.html", "index.html"])


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
