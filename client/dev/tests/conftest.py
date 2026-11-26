"""Browser test harness: starts the mock API (port 3001) and Vite (port 3000),
and gives tests `open_app` and `mock` fixtures. Never touches a real printer."""
import json
import os
import shutil
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect, sync_playwright

CLIENT = Path(__file__).resolve().parents[2]
MOCK_URL = "http://localhost:3001"
APP_URL = "http://localhost:3000"

expect.set_options(timeout=5000)


def _wait_for(url, proc, name, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"{name} exited with code {proc.returncode}")
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except urllib.error.HTTPError:
            return  # it answered
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"{name} did not start at {url}")


def _call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(MOCK_URL + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read() or b"null")


@pytest.fixture(scope="session")
def servers():
    log_dir = CLIENT / "dev" / "logs"
    log_dir.mkdir(exist_ok=True)
    procs = []
    try:
        mock = subprocess.Popen(["node", "dev/mock-server.mjs"], cwd=CLIENT,
                                stdout=open(log_dir / "mock.log", "w"), stderr=subprocess.STDOUT,
                                start_new_session=True)
        procs.append(mock)
        _wait_for(MOCK_URL + "/api/auth/setup-check", mock, "mock server")
        npx = shutil.which("npx") or "npx"
        vite = subprocess.Popen([npx, "vite", "--port", "3000", "--strictPort"], cwd=CLIENT,
                                stdout=open(log_dir / "vite.log", "w"), stderr=subprocess.STDOUT,
                                start_new_session=True, env={**os.environ, "BROWSER": "none"})
        procs.append(vite)
        _wait_for(APP_URL + "/", vite, "vite")
        yield
    finally:
        for p in procs:
            try:
                os.killpg(p.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def page(browser, servers):
    context = browser.new_context()
    pg = context.new_page()
    pg.set_default_timeout(5000)
    yield pg
    context.close()


class Mock:
    def scenario(self, name):
        _call("POST", "/__scenario", {"name": name})

    def requests(self, method=None, path=None):
        found = _call("GET", "/__requests")
        return [r for r in found
                if (method is None or r["method"] == method) and (path is None or r["path"] == path)]

    def emit(self, event, data):
        _call("POST", "/__emit", {"event": event, "data": data})

    def delay(self, ms):
        _call("POST", "/__delay", {"ms": ms})


@pytest.fixture
def mock(servers):
    m = Mock()
    m.scenario("default")
    return m


@pytest.fixture
def page_errors():
    return []


@pytest.fixture(autouse=True)
def _fail_on_page_errors(page_errors):
    yield
    if page_errors:
        pytest.fail("Uncaught page errors:\n" + "\n".join(page_errors))


@pytest.fixture
def open_app(page: Page, mock, page_errors):
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    def _open(path="/", scenario="default", width=1440, height=900, storage=None, token="test"):
        mock.scenario(scenario)
        page.set_viewport_size({"width": width, "height": height})
        items = dict(storage or {})
        if token is not None:
            items["token"] = token
        page.add_init_script(
            "(() => { const items = %s; if (!sessionStorage.getItem('__seeded')) {"
            " localStorage.clear(); for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);"
            " sessionStorage.setItem('__seeded', '1'); } })()" % json.dumps(items))
        page.goto(APP_URL + path)
        return page

    return _open


def assert_no_sideways_scroll(page: Page):
    width = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert width <= 0, f"page scrolls sideways by {width}px"
