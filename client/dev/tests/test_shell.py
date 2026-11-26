"""App shell, navigation and assistant (Task 4)."""
import pytest
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll

NAV = [("Print status", "/"), ("Spools", "/inventory"), ("Print history", "/archive"),
       ("Scrap saver", "/scrap-saver"), ("Analytics", "/analytics"), ("Calculator", "/calculator"),
       ("Jobs and quotes", "/jobs"), ("Settings", "/settings"), ("tester", "/profile")]

ROUTES = ["/", "/inventory", "/archive", "/scrap-saver", "/analytics", "/calculator", "/jobs", "/profile", "/settings"]
# Screens rebuilt in later tasks still scroll sideways on a phone; each task removes its mark.
OLD_SCREENS = set()


def test_side_menu(open_app):
    page = open_app("/")
    nav = page.get_by_role("navigation", name="Main")
    links = nav.get_by_role("link")
    expect(links).to_have_count(len(NAV))
    for i, (name, href) in enumerate(NAV):
        expect(links.nth(i)).to_have_accessible_name(name)
        expect(links.nth(i)).to_have_attribute("href", href)
    nav.get_by_role("link", name="tester").click()
    expect(page).to_have_url("http://localhost:3000/profile")


def test_icon_rail(open_app):
    page = open_app("/", width=900)
    nav = page.get_by_role("navigation", name="Main")
    expect(nav.get_by_role("link", name="Spools")).to_be_visible()
    expect(nav.get_by_role("link", name="Jobs and quotes")).to_be_visible()
    assert nav.bounding_box()["width"] < 100


def test_bottom_bar(open_app):
    page = open_app("/", width=390, height=844)
    nav = page.get_by_role("navigation", name="Main")
    for name in ["Status", "Spools", "History"]:
        expect(nav.get_by_role("link", name=name, exact=True)).to_be_visible()
    nav.get_by_role("button", name="More").click()
    page.get_by_role("dialog", name="More").get_by_role("link", name="Calculator").click()
    expect(page).to_have_url("http://localhost:3000/calculator")
    expect(page.get_by_role("dialog", name="More")).to_be_hidden()


def test_one_title_per_page(open_app):
    page = open_app("/inventory")
    expect(page.locator("main h1")).to_have_count(1)
    expect(page.get_by_role("heading", level=1)).to_have_text("Spools")


def test_assistant_keeps_conversation(open_app):
    page = open_app("/")
    page.get_by_role("button", name="Ask the assistant").click()
    panel = page.get_by_role("dialog", name="Assistant")
    expect(panel).to_contain_text("Ask me anything")
    panel.get_by_role("textbox").fill("hi")
    panel.get_by_role("button", name="Send").click()
    expect(panel).to_contain_text("Mock reply")
    panel.get_by_role("button", name="Close").click()
    expect(panel).to_be_hidden()
    page.get_by_role("navigation", name="Main").get_by_role("link", name="Spools").click()
    page.get_by_role("button", name="Ask the assistant").click()
    expect(page.get_by_role("dialog", name="Assistant")).to_contain_text("Mock reply")


@pytest.mark.parametrize("path", ROUTES)
def test_no_sideways_scroll(open_app, request, path):
    if path in OLD_SCREENS:
        request.applymarker(pytest.mark.xfail(reason="screen not rebuilt yet", strict=False))
    page = open_app(path, width=390, height=844)
    expect(page.locator("main")).to_be_visible()
    page.wait_for_timeout(500)
    assert_no_sideways_scroll(page)
