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
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_interesting as mi  # noqa: E402


def event(kind, **data):
    return json.dumps({"type": kind, "data": data})


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

    def test_rejects_paths_that_leave_site_or_are_not_static(self):
        bad = [
            "", "   ", None, 7,
            "/etc/passwd", "../README.md", "a/../../x.html", "C:\\x.html", "a\\b.html",
            ".github/workflows/x.yml", ".hidden.html", "a/.git/config.txt", "x\x00.html",
            "run.sh", "page.php", "noextension", "site",
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

    def test_forgives_code_quoting_slips(self):
        # \' and \d are not JSON escapes; models emit them when quoting JavaScript.
        self.assertEqual(mi.loads_lenient('{"a": "it\\\'s \\d+"}'), {"a": "it\\'s \\d+"})
        # A properly escaped backslash must not be doubled again.
        self.assertEqual(mi.loads_lenient('{"a": "x\\\\\'y"}'), {"a": "x\\'y"})
        # ...also when the same string needs repair: escaped backslash, slip, valid escapes.
        self.assertEqual(mi.loads_lenient('{"a": "x\\\\ \\d \\" \\n \\u00e9"}'), {"a": 'x\\ \\d " \n \u00e9'})
        # Raw newlines inside a string are accepted.
        self.assertEqual(mi.loads_lenient('{"a": "line1\nline2"}'), {"a": "line1\nline2"})
        # Valid escapes keep their meaning.
        self.assertEqual(mi.loads_lenient('{"a": "q\\"q \\u00e9 \\n"}'), {"a": 'q"q \u00e9 \n'})

    def test_still_rejects_hopeless_json(self):
        with self.assertRaises(ValueError):
            mi.loads_lenient('{"a": ')


def events(*lines):
    return mi.parse_events("\n".join(lines))


class ExtractAnswerTest(unittest.TestCase):
    def test_parse_events_ignores_everything_that_is_not_an_event_object(self):
        parsed = mi.parse_events("\n".join(["not json at all", "[1]", '"x"', "", event("session.info", message="hi")]))
        self.assertEqual(parsed, [{"type": "session.info", "data": {"message": "hi"}}])

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
        bad = [
            {},
            {"files": [], "delete": []},
            {"files": "index.html"},
            {"files": [{"path": "index.html"}]},
            {"files": [{"path": "index.html", "content": 5}]},
            {"files": ["index.html"]},
            {"files": [{"path": "../x.html", "content": "x"}]},
            {"files": [{"path": "big.html", "content": big}]},
            {"files": [{"path": "index.html", "content": "  "}]},
            {"delete": ["index.html"]},
            {"delete": ["site/error.html"]},
            {"files": [{"path": "fine.html", "content": "x"}, {"path": "../x.html", "content": "x"}]},
            {"files": [{"path": f"p{i}.html", "content": "x"} for i in range(mi.MAX_CHANGES + 1)]},
        ]
        for plan in bad:
            with self.subTest(plan=str(plan)[:80]), self.assertRaises(mi.RejectedChange):
                mi.validate_plan(plan)


class BuildPromptTest(SiteDirTestCase):
    def test_prompt_contains_mission_site_files_and_format(self):
        prompt = mi.build_prompt(mi.read_site())
        self.assertIn(mi.MISSION, prompt)
        self.assertIn("=== index.html ===\n<h1>interesting</h1>", prompt)
        self.assertIn("=== error.html ===", prompt)
        self.assertIn('"files"', prompt)

    def test_files_over_budget_are_listed_by_name_only(self):
        (self.site / "huge.js").write_text("y" * (mi.PROMPT_BUDGET_CHARS + 1))
        prompt = mi.build_prompt(mi.read_site())
        self.assertNotIn("yyyy", prompt)
        self.assertIn("content omitted for size): huge.js", prompt)

    def test_only_static_non_symlink_files_are_read(self):
        (self.site / "notes.bin").write_bytes(b"\x00\x01")
        (self.site / "link.html").symlink_to(self.site / "index.html")
        self.assertEqual([rel for rel, _ in mi.read_site()], ["error.html", "index.html"])


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
            'Model "x" requires enablement before use.',
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

    def test_tool_use_is_a_silo_breach(self):
        FakeCopilot(self, "print(json.dumps({'type': 'tool.execution_start', 'data': {'toolName': 'bash'}})); say('{}')")
        with self.assertRaises(mi.SiloBreach):
            mi.call_model("x", "p")

    def test_output_that_is_not_utf8_does_not_crash(self):
        FakeCopilot(self, "sys.stdout.buffer.write(b'\\xff\\xfe not utf-8\\n'); sys.stdout.flush(); say('ok')")
        self.assertEqual(mi.call_model("x", "p"), "ok")

    def test_timeout_only_fails_that_model(self):
        FakeCopilot(self, "import time; time.sleep(30)")
        with mock.patch.object(mi, "MODEL_TIMEOUT_SECONDS", 0.2), self.assertRaisesRegex(mi.ModelError, "no answer"):
            mi.call_model("x", "p")

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
        full_env = {"GITHUB_OUTPUT": str(out), "MODEL": ""}
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
        self.assertEqual(output, f"model<<__EOF__\n{model}\n__EOF__\nsummary<<__EOF__\nAdded a clock.\n__EOF__\n")

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
        self.assertIn(f"model<<__EOF__\n{survivor}\n", output)
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
