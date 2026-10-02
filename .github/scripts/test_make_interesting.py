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


    def test_files_the_model_was_not_shown_cannot_be_touched(self):
        (self.site / "big.js").write_text("y")
        for plan in [{"files": [{"path": "big.js", "content": "new"}]}, {"delete": ["site/big.js"]}]:
            with self.subTest(plan=plan), self.assertRaisesRegex(mi.RejectedChange, "not shown"):
                mi.validate_plan(plan, unseen=["big.js"])
        self.assertEqual(len(mi.validate_plan({"files": [{"path": "new.js", "content": "x"}]}, unseen=["big.js"])), 1)

    def test_a_file_can_always_be_shown_to_the_next_model(self):
        self.assertLess(mi.MAX_FILE_BYTES, mi.PROMPT_BUDGET_CHARS)


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

    def test_files_over_budget_are_listed_by_name_only(self):
        (self.site / "huge.js").write_text("y" * (mi.PROMPT_BUDGET_CHARS + 1))
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual(omitted, ["huge.js"])
        prompt = mi.build_prompt(shown, omitted)
        self.assertNotIn("yyyy", prompt)
        self.assertIn("content omitted for size): huge.js", prompt)
        self.assertIn("may not change or delete them", prompt)

    def test_every_file_gets_its_turn_in_the_prompt(self):
        # Three files that each fill most of the budget: only one fits per run. Whichever is left
        # out cannot be changed that run, so the choice must rotate rather than follow the alphabet.
        for name in ["a.js", "b.js", "c.js"]:
            (self.site / name).write_text(name[0] * (mi.PROMPT_BUDGET_CHARS - 1000))
        seen = set()
        for _ in range(60):
            shown, omitted = mi.split_for_prompt(mi.read_site())
            names = [rel for rel, _ in shown]
            self.assertEqual(names[:2], ["index.html", "error.html"])
            self.assertEqual(len(names), 3)
            self.assertEqual(sorted(names + omitted), ["a.js", "b.js", "c.js", "error.html", "index.html"])
            seen.update(names[2:])
        self.assertEqual(seen, {"a.js", "b.js", "c.js"})

    def test_home_page_is_the_last_file_to_be_left_out(self):
        (self.site / "a.js").write_text("a" * (mi.PROMPT_BUDGET_CHARS - 10))  # sorts first, fits only alone
        (self.site / "b.css").write_text("b" * 200)
        shown, omitted = mi.split_for_prompt(mi.read_site())
        self.assertEqual([rel for rel, _ in shown][:2], ["index.html", "error.html"])
        self.assertEqual(omitted, ["a.js"])
        self.assertIn("b.css", [rel for rel, _ in shown])

    def test_only_static_non_symlink_files_are_read(self):
        (self.site / "notes.bin").write_bytes(b"\x00\x01")
        (self.site / "link.html").symlink_to(self.site / "index.html")
        self.assertEqual([rel for rel, _ in mi.read_site()], ["error.html", "index.html"])


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
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 1.5), self.assertRaises(mi.SiloBreach):
            mi.call_model("x", "p")

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
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 1.5), self.assertRaisesRegex(mi.ModelError, "no answer"):
            mi.call_model("x", "p")
        for pid in map(int, Path(str(fake.log) + ".pids").read_text().split()):
            for _ in range(50):  # the kill is asynchronous; give the kernel a moment
                if not process_is_running(pid):
                    break
                time.sleep(0.1)
            self.assertFalse(process_is_running(pid), f"process {pid} survived the timeout")

    def test_missing_cli_stops_the_run(self):
        with mock.patch.object(mi, "COPILOT_BIN", "/nonexistent/copilot"), self.assertRaises(SystemExit):
            mi.call_model("x", "p")


GOOD_PLAN = json.dumps({
    "summary": "Added a clock.\nSecond line is dropped.",
    "files": [{"path": "clock.html", "content": "<p>tick</p>"}],
})


class MainTest(SiteDirTestCase):
    def run_main(self, env=None):
        out = self.root / "github_output"
        full_env = {"GITHUB_OUTPUT": str(out), "MODEL": "", "MODEL_POOL": ""}
        full_env.update(env or {})
        with mock.patch.dict(os.environ, full_env), mock.patch("builtins.print"):
            mi.main()
        return out.read_text() if out.exists() else ""

    def test_applies_first_usable_answer_and_reports_it(self):
        fake = FakeCopilot(self, f"say({GOOD_PLAN!r})")
        output = self.run_main()
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
        self.assertEqual(read_outputs(output)["model"], survivor)
        self.assertTrue((self.site / "clock.html").is_file())

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
        self.assertEqual([c["args"][1] for c in fake.calls()], ["my-model"])

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
