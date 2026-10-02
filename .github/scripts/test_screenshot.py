#!/usr/bin/env python3
"""Tests for screenshot.py. Standard library only.

The tests that take a real screenshot need Chrome. On a GitHub-hosted runner it is always there,
so a missing Chrome fails the run; on a machine without it those tests are skipped.

Run with:  python3 -m unittest discover -s .github/scripts -v
"""

import http.server
import os
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import screenshot as shot  # noqa: E402


def jpeg_size(data):
    """(width, height) of a JPEG, read from its start-of-frame segment."""
    assert data[:2] == b"\xff\xd8", "not a JPEG"
    position = 2
    while position < len(data):
        marker, length = data[position + 1], struct.unpack(">H", data[position + 2:position + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack(">HH", data[position + 5:position + 9])
            return width, height
        position += 2 + length
    raise AssertionError("no start-of-frame segment")


def chrome_or_skip(test):
    try:
        return shot.find_chrome()
    except shot.ScreenshotError:
        if os.environ.get("GITHUB_ACTIONS") == "true":
            test.fail("Chrome is missing from the runner, so no run could save a screenshot")
        test.skipTest("Chrome is not installed here")


class RecordingSite:
    """A local site that records which paths were requested, and can make one of them hang."""

    def __init__(self, test, pages):
        self.requested = []
        site = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                site.requested.append(self.path)
                if self.path == "/hang":
                    time.sleep(20)
                body = pages.get(self.path)
                self.send_response(200 if body is not None else 404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                try:
                    self.wfile.write((body or "not found").encode())
                except OSError:
                    pass

            def log_message(self, format, *args):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        test.addCleanup(self.server.server_close)
        test.addCleanup(self.server.shutdown)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"


class RealChromeTest(unittest.TestCase):
    def setUp(self):
        self.chrome = chrome_or_skip(self)

    def test_captures_the_page_after_its_scripts_have_run(self):
        site = RecordingSite(self, {
            "/index.html": "<body style='background:#c00'><h1>hello</h1>"
                           "<script>fetch('/script-ran')</script></body>",
            "/script-ran": "ok",
        })
        image = shot.capture(site.url + "/index.html", self.chrome)
        self.assertEqual(jpeg_size(image), (shot.WIDTH, shot.HEIGHT))
        self.assertGreater(len(image), 1000)
        self.assertIn("/index.html", site.requested)
        self.assertIn("/script-ran", site.requested, "the page's JavaScript ran before the capture")

    def test_a_dialog_does_not_hang_the_capture(self):
        site = RecordingSite(self, {
            "/index.html": "<body><script>alert('hello'); confirm('sure?'); fetch('/after-dialogs')</script></body>",
            "/after-dialogs": "ok",
        })
        started = time.monotonic()
        image = shot.capture(site.url + "/index.html", self.chrome)
        self.assertLess(time.monotonic() - started, 25)
        self.assertEqual(jpeg_size(image), (shot.WIDTH, shot.HEIGHT))
        self.assertIn("/after-dialogs", site.requested, "both dialogs were answered")

    def test_a_page_that_never_finishes_loading_is_captured_anyway(self):
        site = RecordingSite(self, {"/index.html": "<body><h1>slow</h1><img src='/hang'></body>"})
        with mock.patch.object(shot, "LOAD_TIMEOUT_SECONDS", 2), mock.patch.object(shot, "SETTLE_SECONDS", 0.5):
            with mock.patch("builtins.print"):
                image = shot.capture(site.url + "/index.html", self.chrome)
        self.assertEqual(jpeg_size(image), (shot.WIDTH, shot.HEIGHT))

    def test_an_unreachable_page_is_an_error(self):
        with self.assertRaisesRegex(shot.ScreenshotError, "could not open"):
            shot.capture("http://127.0.0.1:9/index.html", self.chrome)

    def test_screenshot_serves_the_folder_and_writes_the_file_whole(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp) / "site"
            site.mkdir()
            (site / "index.html").write_text("<body style='background:#06c'><h1>interesting</h1></body>")
            output = Path(tmp) / "screenshots" / "20261005-0428Z.jpg"
            size = shot.screenshot(site, output, binary=self.chrome)
            self.assertEqual(output.stat().st_size, size)
            self.assertEqual(jpeg_size(output.read_bytes()), (shot.WIDTH, shot.HEIGHT))
            self.assertEqual([p.name for p in output.parent.iterdir()], ["20261005-0428Z.jpg"])

    def test_nothing_is_left_running(self):
        site = RecordingSite(self, {"/index.html": "<body>bye</body>"})
        with mock.patch.object(shot, "SETTLE_SECONDS", 0.2):
            shot.capture(site.url + "/index.html", self.chrome)
        leftovers = subprocess.run(["pgrep", "-f", "screenshot-chrome-"], capture_output=True, text=True).stdout.split()
        for _ in range(50):  # Chrome's helper processes take a moment to go
            if not leftovers:
                break
            time.sleep(0.1)
            leftovers = subprocess.run(["pgrep", "-f", "screenshot-chrome-"], capture_output=True, text=True).stdout.split()
        self.assertEqual(leftovers, [])


class WithoutChromeTest(unittest.TestCase):
    def test_missing_home_page_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(shot.ScreenshotError, "index.html not found"):
                shot.screenshot(tmp, Path(tmp) / "out.jpg", binary="/bin/false")
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_a_browser_that_dies_is_an_error_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp) / "site"
            site.mkdir()
            (site / "index.html").write_text("<body>hi</body>")
            output = Path(tmp) / "out.jpg"
            with self.assertRaisesRegex(shot.ScreenshotError, "Chrome exited"):
                shot.screenshot(site, output, binary="/bin/false")
            self.assertFalse(output.exists())
            self.assertEqual([p.name for p in Path(tmp).iterdir()], ["site"])

    def test_a_browser_that_never_answers_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            sleeper = Path(tmp) / "sleeper"
            sleeper.write_text("#!/bin/sh\nexec sleep 30\n")
            sleeper.chmod(0o755)
            started = time.monotonic()
            with mock.patch.object(shot, "REPLY_TIMEOUT_SECONDS", 1):
                with self.assertRaisesRegex(shot.ScreenshotError, "did not answer in time"):
                    shot.capture("http://127.0.0.1:9/", str(sleeper))
            self.assertLess(time.monotonic() - started, 15, "the silent browser was killed, not waited for")

    def test_browser_is_handed_the_devtools_pipe_on_descriptors_3_and_4(self):
        # A stand-in browser that answers one command over the pipe, as Chrome would. It is a
        # /bin/sh script on purpose: the launcher must not depend on what the shell can redirect.
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "fake-chrome"
            fake.write_text(
                "#!/bin/sh\n"
                "# reply to whatever arrives on 3 with an error on 4, then wait\n"
                "head -c 20 <&3 >/dev/null\n"
                "printf '{\"id\":1,\"error\":{\"message\":\"I am not Chrome\"}}\\0' >&4\n"
                "sleep 5\n"
            )
            fake.chmod(0o755)
            with self.assertRaisesRegex(shot.ScreenshotError, "Target.createTarget failed: I am not Chrome"):
                shot.capture("http://127.0.0.1:9/", str(fake))

    def test_chrome_bin_overrides_the_search(self):
        with mock.patch.dict(os.environ, {"CHROME_BIN": "/opt/my/chrome"}):
            self.assertEqual(shot.find_chrome(), "/opt/my/chrome")

    def test_no_chrome_anywhere_is_an_error(self):
        with mock.patch.dict(os.environ, {"CHROME_BIN": ""}), mock.patch.object(shot.shutil, "which", return_value=None):
            with mock.patch.object(shot, "CHROME_PATHS", ["/nonexistent/chrome"]):
                with self.assertRaisesRegex(shot.ScreenshotError, "Chrome was not found"):
                    shot.find_chrome()

    def test_chrome_keeps_its_sandbox(self):
        self.assertNotIn("--no-sandbox", shot.CHROME_FLAGS)
        self.assertIn("--remote-debugging-pipe", shot.CHROME_FLAGS)
        self.assertFalse([flag for flag in shot.CHROME_FLAGS if flag.startswith("--remote-debugging-port")])

    def test_command_line_reports_failure_without_a_traceback(self):
        script = Path(shot.__file__)
        with tempfile.TemporaryDirectory() as tmp:
            proc = subprocess.run([sys.executable, str(script), tmp, str(Path(tmp) / "out.jpg")],
                                  capture_output=True, text=True)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("No screenshot:", proc.stderr)
        self.assertNotIn("Traceback", proc.stderr)


if __name__ == "__main__":
    unittest.main()
