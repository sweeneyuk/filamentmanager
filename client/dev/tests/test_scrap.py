"""Scrap saver (Task 10)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def spool_buttons(page):
    return page.get_by_role("region", name="Near-empty spools").get_by_role("button")


def model(page, name):
    return page.get_by_role("listitem").filter(has=page.get_by_role("heading", name=name))


def test_lists_only_scrap_spools(open_app):
    page = open_app("/scrap-saver")
    buttons = spool_buttons(page)
    expect(buttons).to_have_count(2)
    expect(buttons.nth(0)).to_contain_text("White")
    expect(page.get_by_role("button", name="Teal", exact=False)).to_contain_text("60.0 g")


def test_selecting_marks_models_that_do_not_fit(open_app):
    page = open_app("/scrap-saver")
    teal = page.get_by_role("button", name="Teal", exact=False)
    teal.click()
    expect(teal).to_have_attribute("aria-pressed", "true")
    expect(model(page, "Coaster")).to_have_attribute("data-fits", "false")
    expect(model(page, "Coaster")).to_contain_text("Not enough filament")
    expect(model(page, "Keychain")).to_have_attribute("data-fits", "true")
    teal.click()
    expect(teal).to_have_attribute("aria-pressed", "false")
    expect(model(page, "Coaster")).to_have_attribute("data-fits", "true")


def test_add_model(open_app, mock):
    page = open_app("/scrap-saver")
    page.get_by_role("button", name="Add model").click()
    dialog = page.get_by_role("dialog", name="Add model")
    dialog.get_by_label("Name").fill("Clip")
    dialog.get_by_label("Weight (g)").fill("12.5")
    dialog.get_by_label("URL").fill("https://example.com/clip")
    dialog.get_by_label("Description").fill("Cable clip")
    dialog.get_by_role("button", name="Add model").click()
    expect(dialog).to_be_hidden()
    body = mock.requests("POST", "/api/scrapsaver/models")[0]["body"]
    assert body == {"name": "Clip", "weight_g": "12.5", "url": "https://example.com/clip", "description": "Cable clip"}


def test_delete_asks_first(open_app, mock):
    page = open_app("/scrap-saver")
    model(page, "Keychain").get_by_role("button", name="Delete Keychain").click()
    dialog = page.get_by_role("dialog", name="Delete model")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(dialog).to_be_hidden()
    page.wait_for_timeout(200)
    assert [r["path"] for r in mock.requests("DELETE")] == ["/api/scrapsaver/models/1"]


def test_external_link(open_app):
    page = open_app("/scrap-saver")
    expect(page.get_by_role("link", name="Open Keychain")).to_have_attribute("href", "https://example.com/keychain")


def test_empty(open_app):
    page = open_app("/scrap-saver", scenario="empty")
    expect(page.get_by_text("No spools under 100 g")).to_be_visible()
    expect(page.get_by_text("Your scrap book is empty")).to_be_visible()


def test_fail(open_app):
    page = open_app("/scrap-saver", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_phone(open_app):
    page = open_app("/scrap-saver", width=390, height=844)
    expect(page.get_by_role("button", name="Teal", exact=False)).to_be_visible()
    assert_no_sideways_scroll(page)
