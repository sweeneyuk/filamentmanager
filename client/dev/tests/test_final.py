"""Whole-app checks (Task 16): sideways scroll, target size, accessible names, reduced motion."""
import pytest
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll

ROUTES = ["/", "/inventory", "/archive", "/scrap-saver", "/analytics", "/calculator", "/jobs", "/profile", "/settings"]
WIDTHS = [1440, 900, 390]

AUDIT = """(root) => {
  const scope = root ? document.querySelector(root) : document;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nameOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
    const text = (el.textContent || '').trim();
    if (text) return text;
    return (el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
  };
  const problems = [];
  const els = scope.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea');
  for (const el of els) {
    if (el.hidden || el.closest('[hidden], dialog:not([open]), [popover]:not(:popover-open)')) continue;
    if (!root && el.closest('dialog[open], [popover]:popover-open')) continue;
    if (el.type === 'file') continue;
    if (el.closest('p, .ui-field__hint')) continue;  // links inside running text
    let box = el;
    if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) box = el.closest('label');
    if (!visible(box)) continue;
    const r = box.getBoundingClientRect();
    const desc = `${el.tagName.toLowerCase()}[${nameOf(el).slice(0, 40) || '?'}]`;
    if (r.width < 43.5 || r.height < 43.5) problems.push(`${desc} is ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!nameOf(el)) problems.push(`${desc} has no accessible name`);
  }
  return problems;
}"""


@pytest.mark.parametrize("width", WIDTHS)
@pytest.mark.parametrize("path", ROUTES)
def test_targets_names_and_scroll(open_app, path, width):
    page = open_app(path, width=width, height=900 if width > 500 else 844)
    expect(page.locator("main h1")).to_be_visible()
    page.wait_for_timeout(400)
    assert_no_sideways_scroll(page)
    problems = page.evaluate(AUDIT, None)
    assert problems == [], "\n".join(problems)


def test_reduced_motion(open_app, page):
    page.emulate_media(reduced_motion="reduce")
    p = open_app("/")
    p.get_by_role("button", name="Ask the assistant").click()
    panel = p.get_by_role("dialog", name="Assistant")
    expect(panel).to_be_visible()
    duration = panel.evaluate("el => getComputedStyle(el).transitionDuration")
    assert set(d.strip() for d in duration.split(",")) == {"0s"}


def _open_spool_form(page):
    page.goto("http://localhost:3000/inventory")
    page.locator("header").get_by_role("button", name="Add spool").click()


def _open_edit_spool(page):
    page.goto("http://localhost:3000/inventory")
    page.get_by_role("button", name="Edit spool 1", exact=True).click()


def _open_spool_menu(page):
    page.goto("http://localhost:3000/inventory")
    page.get_by_role("button", name="More actions for spool 1").click()


def _open_slot_panel(page):
    page.goto("http://localhost:3000/")
    page.get_by_role("button", name="Slot 4, PLA, 691 grams left, feeding", exact=True).click()


def _open_assistant(page):
    page.goto("http://localhost:3000/")
    page.get_by_role("button", name="Ask the assistant").click()


def _open_more_sheet(page):
    page.goto("http://localhost:3000/")
    page.get_by_role("navigation", name="Main").get_by_role("button", name="More").click()


def _open_history_details(page):
    page.goto("http://localhost:3000/archive")
    page.get_by_role("button", name="Open Benchy").click()


def _open_history_menu(page):
    page.goto("http://localhost:3000/archive")
    page.get_by_role("button", name="More actions for Benchy").click()


def _open_timelapse(page):
    page.goto("http://localhost:3000/archive")
    page.get_by_role("button", name="Play timelapse").first.click()


def _open_confirm(page):
    page.goto("http://localhost:3000/jobs")
    page.get_by_role("button", name="Delete Desk tidy").click()


def _open_prompt(page):
    page.goto("http://localhost:3000/")
    page.get_by_role("button", name="Rename AMS 2 Pro").click()


def _open_job_dialog(page):
    page.goto("http://localhost:3000/jobs")
    page.get_by_role("button", name="Edit Desk tidy").click()


def _open_scrap_dialog(page):
    page.goto("http://localhost:3000/scrap-saver")
    page.get_by_role("button", name="Add model").click()


def _open_printer_dialog(page):
    page.goto("http://localhost:3000/settings")
    page.get_by_role("button", name="Add printer").click()


def _open_calculator_dialogs(page):
    page.goto("http://localhost:3000/calculator")
    page.locator("input[type=file]").set_input_files({"name": "plate.gcode.3mf", "mimeType": "application/octet-stream", "buffer": b"PK"})
    page.get_by_role("button", name="Analyse file").click()
    page.get_by_role("button", name="Choose spool for slot 1").click()


def _open_save_quote(page):
    _open_calculator_dialogs(page)
    page.get_by_role("dialog", name="Spool for slot 1").get_by_role("button", name="Spool 1").click()
    page.get_by_role("button", name="Save quote").click()


OPENERS = {
    "spool form": _open_spool_form, "edit spool": _open_edit_spool, "spool menu": _open_spool_menu,
    "slot panel": _open_slot_panel, "assistant": _open_assistant, "more sheet": _open_more_sheet,
    "history details": _open_history_details, "history menu": _open_history_menu, "timelapse": _open_timelapse,
    "confirm": _open_confirm, "prompt": _open_prompt, "job dialog": _open_job_dialog,
    "scrap dialog": _open_scrap_dialog, "printer dialog": _open_printer_dialog,
    "spool picker": _open_calculator_dialogs, "save quote": _open_save_quote,
}
OPEN = "dialog[open], [popover]:popover-open:not(.ui-toasts)"


@pytest.mark.parametrize("width", [1440, 390])
@pytest.mark.parametrize("name", OPENERS)
def test_controls_inside_dialogs(open_app, name, width):
    page = open_app("/", width=width, height=900 if width > 500 else 844)
    if name == "more sheet" and width > 500:
        pytest.skip("the More sheet only exists on a phone")
    OPENERS[name](page)
    expect(page.locator(OPEN).last).to_be_visible()
    page.wait_for_timeout(400)
    page.evaluate("() => { document.querySelectorAll('dialog[open], [popover]:popover-open:not(.ui-toasts)').forEach((d, i, all) => { if (i === all.length - 1) d.setAttribute('data-audit', '1'); }); }")
    problems = page.evaluate(AUDIT, "[data-audit]")
    assert problems == [], "\n".join(problems)
