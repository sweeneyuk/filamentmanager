"""Whole-app checks (Task 16): sideways scroll, target size, accessible names, reduced motion."""
import pytest
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll

ROUTES = ["/", "/inventory", "/archive", "/scrap-saver", "/analytics", "/calculator", "/jobs", "/profile", "/settings"]
WIDTHS = [1440, 900, 390]

AUDIT = """() => {
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
  const els = document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea');
  for (const el of els) {
    if (el.hidden || el.closest('[hidden], dialog:not([open]), [popover]:not(:popover-open)')) continue;
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
    problems = page.evaluate(AUDIT)
    assert problems == [], "\n".join(problems)


def test_reduced_motion(open_app, page):
    page.emulate_media(reduced_motion="reduce")
    p = open_app("/")
    p.get_by_role("button", name="Ask the assistant").click()
    panel = p.get_by_role("dialog", name="Assistant")
    expect(panel).to_be_visible()
    duration = panel.evaluate("el => getComputedStyle(el).transitionDuration")
    assert set(d.strip() for d in duration.split(",")) == {"0s"}
