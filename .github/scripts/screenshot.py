#!/usr/bin/env python3
"""Save a screenshot of the site.

Serves a folder (the repository's /site) on a local port, opens its home page in
headless Chrome and writes what a visitor sees first to a JPEG file.

    python3 .github/scripts/screenshot.py site screenshots/20261005-0428Z.jpg

Standard library only, and no browser download: it drives the Chrome that is
already installed (on a GitHub-hosted runner, or on a laptop) through Chrome's
DevTools pipe. The page is the AI-written site, so Chrome keeps its sandbox on
and is given a throwaway profile; it is never started with --no-sandbox.
"""

import argparse
import base64
import fcntl
import functools
import http.server
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

WIDTH, HEIGHT = 1280, 800  # a laptop-sized window; the screenshot is this viewport, not the whole page
JPEG_QUALITY = 80
LOAD_TIMEOUT_SECONDS = 30  # how long the page gets to finish loading
SETTLE_SECONDS = 2  # then a moment for scripts and animations to draw their first frames
REPLY_TIMEOUT_SECONDS = 30  # how long Chrome gets to answer any one command

CHROME_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"]
CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
]
CHROME_FLAGS = [
    "--headless=new",
    "--remote-debugging-pipe",  # DevTools over file descriptors 3 and 4: no port for anything else to connect to
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--mute-audio",
    "--hide-scrollbars",
]


class ScreenshotError(Exception):
    pass


def find_chrome():
    """The Chrome to drive: $CHROME_BIN if set, else the first one found in the usual places."""
    configured = os.environ.get("CHROME_BIN")
    if configured:
        return configured
    for name in CHROME_NAMES:
        found = shutil.which(name)
        if found:
            return found
    for path in CHROME_PATHS:
        if os.access(path, os.X_OK):
            return path
    raise ScreenshotError("Chrome was not found; set CHROME_BIN to its path")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):  # keep the request log out of the workflow log
        pass


def serve(folder):
    """Serve `folder` on a free local port, in a background thread. Returns the server."""
    handler = functools.partial(QuietHandler, directory=str(folder))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def high_fd(fd):
    """A copy of `fd` numbered 10 or above, so that it can never be 3 or 4 itself."""
    copy = fcntl.fcntl(fd, fcntl.F_DUPFD, 10)
    os.close(fd)
    return copy


class Chrome:
    """A headless Chrome, spoken to over its DevTools pipe (JSON messages, each ended by a NUL)."""

    def __init__(self, binary, profile_dir, width=WIDTH, height=HEIGHT):
        to_chrome, self._send_fd = os.pipe()
        self._receive_fd, from_chrome = os.pipe()
        to_chrome, from_chrome = high_fd(to_chrome), high_fd(from_chrome)
        try:
            # Chrome reads commands on descriptor 3 and writes replies on 4. The shell does the
            # renumbering, which keeps this free of code that runs between fork and exec.
            self.process = subprocess.Popen(
                ["/bin/sh", "-c", f'exec "$0" "$@" 3<&{to_chrome} 4>&{from_chrome}', binary,
                 *CHROME_FLAGS, f"--user-data-dir={profile_dir}", f"--window-size={width},{height}", "about:blank"],
                pass_fds=(to_chrome, from_chrome),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
        finally:
            os.close(to_chrome)
            os.close(from_chrome)
        self._messages = queue.Queue()
        self._next_id = 0
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        buffer = b""
        while True:
            try:
                chunk = os.read(self._receive_fd, 1 << 16)
            except OSError:
                chunk = b""
            if not chunk:
                self._messages.put(None)  # Chrome closed the pipe
                return
            buffer += chunk
            *complete, buffer = buffer.split(b"\0")
            for raw in complete:
                try:
                    self._messages.put(json.loads(raw))
                except ValueError:
                    pass

    def _send(self, method, params, session):
        self._next_id += 1
        message = {"id": self._next_id, "method": method, "params": params or {}}
        if session:
            message["sessionId"] = session
        os.write(self._send_fd, json.dumps(message).encode() + b"\0")
        return self._next_id

    def _next_message(self, deadline, waiting_for):
        try:
            message = self._messages.get(timeout=max(0.0, deadline - time.monotonic()))
        except queue.Empty:
            raise ScreenshotError(f"Chrome did not answer in time ({waiting_for})") from None
        if message is None:
            detail = ""
            if self.process.poll() is not None and self.process.stderr:
                detail = ": " + self.process.stderr.read().decode(errors="replace").strip()[-500:]
            raise ScreenshotError(f"Chrome exited ({waiting_for}){detail}")
        # A page that opens alert(), confirm() or prompt() would wait for an answer forever.
        if message.get("method") == "Page.javascriptDialogOpening":
            self._send("Page.handleJavaScriptDialog", {"accept": True}, message.get("sessionId"))
        return message

    def call(self, method, params=None, session=None):
        """Send one command and return its result."""
        wanted = self._send(method, params, session)
        deadline = time.monotonic() + REPLY_TIMEOUT_SECONDS
        while True:
            message = self._next_message(deadline, method)
            if message.get("id") == wanted:
                if "error" in message:
                    raise ScreenshotError(f"{method} failed: {message['error'].get('message')}")
                return message.get("result", {})

    def wait_for(self, event, session, timeout):
        """Wait for one event; returns False if it did not arrive in time."""
        deadline = time.monotonic() + timeout
        while True:
            try:
                message = self._next_message(deadline, event)
            except ScreenshotError as error:
                if "did not answer in time" in str(error):
                    return False
                raise
            if message.get("method") == event and message.get("sessionId") == session:
                return True

    def idle(self, seconds):
        """Let the page run for a while, still answering any dialog it opens."""
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            try:
                self._next_message(deadline, "settling")
            except ScreenshotError as error:
                if "did not answer in time" not in str(error):
                    raise

    def close(self):
        try:
            self._send("Browser.close", {}, None)
            self.process.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass
        if self.process.poll() is None:
            try:
                os.killpg(self.process.pid, 9)
            except ProcessLookupError:
                pass
            self.process.wait()
        for fd in (self._send_fd, self._receive_fd):
            try:
                os.close(fd)
            except OSError:
                pass
        if self.process.stderr:
            self.process.stderr.close()


def capture(url, binary, width=WIDTH, height=HEIGHT, quality=JPEG_QUALITY):
    """Open `url` in headless Chrome and return the first screenful as JPEG bytes."""
    with tempfile.TemporaryDirectory(prefix="screenshot-chrome-") as profile_dir:
        chrome = Chrome(binary, profile_dir, width, height)
        try:
            target = chrome.call("Target.createTarget", {"url": "about:blank"})["targetId"]
            session = chrome.call("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
            chrome.call("Page.enable", session=session)
            chrome.call("Emulation.setDeviceMetricsOverride",
                        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False}, session)
            navigation = chrome.call("Page.navigate", {"url": url}, session)
            if navigation.get("errorText"):
                raise ScreenshotError(f"could not open {url}: {navigation['errorText']}")
            if not chrome.wait_for("Page.loadEventFired", session, LOAD_TIMEOUT_SECONDS):
                print(f"The page was still loading after {LOAD_TIMEOUT_SECONDS}s; taking the screenshot anyway.")
            chrome.idle(SETTLE_SECONDS)
            shot = chrome.call("Page.captureScreenshot", {"format": "jpeg", "quality": quality}, session)
            return base64.b64decode(shot["data"])
        finally:
            chrome.close()


def screenshot(site_dir, output, binary=None, **options):
    """Serve `site_dir`, screenshot its home page and write the JPEG to `output`."""
    site_dir, output = Path(site_dir), Path(output)
    if not (site_dir / "index.html").is_file():
        raise ScreenshotError(f"{site_dir}/index.html not found")
    server = serve(site_dir)
    try:
        image = capture(f"http://127.0.0.1:{server.server_address[1]}/index.html", binary or find_chrome(), **options)
    finally:
        server.shutdown()
        server.server_close()
    if not image.startswith(b"\xff\xd8"):
        raise ScreenshotError("Chrome did not return a JPEG image")
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(output.name + ".partial")
    partial.write_bytes(image)
    partial.replace(output)  # all or nothing: never leave half a file behind
    return len(image)


def main():
    parser = argparse.ArgumentParser(description="Save a screenshot of a static site's home page.")
    parser.add_argument("site", help="folder that holds index.html")
    parser.add_argument("output", help="JPEG file to write")
    args = parser.parse_args()
    try:
        size = screenshot(args.site, args.output)
    except ScreenshotError as error:
        sys.exit(f"No screenshot: {error}")
    print(f"Saved {args.output} ({size:,} bytes, {WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
