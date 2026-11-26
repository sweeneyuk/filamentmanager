"""Jobs and quotes (Task 13)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def cards(page):
    return page.get_by_role("article")


def test_list(open_app):
    page = open_app("/jobs")
    expect(cards(page)).to_have_count(2)
    desk = page.get_by_role("article", name="Desk tidy")
    expect(desk).to_contain_text("Alice")
    expect(desk).to_contain_text("Quote")
    expect(desk).to_contain_text("£9.42")
    expect(desk).to_contain_text("£6.28")
    expect(desk).to_contain_text("Blue please")


def test_search_and_status(open_app):
    page = open_app("/jobs")
    page.get_by_role("searchbox", name="Search projects or customers").fill("bob")
    expect(cards(page)).to_have_count(1)
    expect(page.get_by_role("article", name="Lamp shade")).to_be_visible()
    page.get_by_role("searchbox", name="Search projects or customers").fill("")
    page.get_by_role("combobox", name="Status").select_option("Quote")
    expect(cards(page)).to_have_count(1)
    expect(page.get_by_role("article", name="Desk tidy")).to_be_visible()
    options = page.get_by_role("combobox", name="Status").locator("option").all_inner_texts()
    assert options == ["All statuses", "Quote", "Accepted", "Printing", "Completed", "Cancelled"]


def test_edit(open_app, mock):
    page = open_app("/jobs")
    page.get_by_role("button", name="Edit Desk tidy").click()
    dialog = page.get_by_role("dialog", name="Edit job")
    dialog.get_by_label("Project name").fill("Desk tidy v2")
    dialog.get_by_label("Status").select_option("Accepted")
    dialog.get_by_role("button", name="Save").click()
    expect(dialog).to_be_hidden()
    body = mock.requests("PUT", "/api/jobs/1")[0]["body"]
    assert body == {"project_name": "Desk tidy v2", "customer_name": "Alice", "notes": "Blue please", "status": "Accepted"}
    expect(page.get_by_role("article", name="Desk tidy v2")).to_contain_text("Accepted")


def test_delete_confirms_without_browser_dialog(open_app, mock):
    page = open_app("/jobs")
    native = []
    page.on("dialog", lambda d: (native.append(d.message), d.dismiss()))
    page.get_by_role("button", name="Delete Desk tidy").click()
    dialog = page.get_by_role("dialog", name="Delete job")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(page.get_by_role("article", name="Desk tidy")).to_have_count(0)
    assert [r["path"] for r in mock.requests("DELETE")] == ["/api/jobs/1"]
    assert native == []


def test_currency_setting(open_app):
    page = open_app("/jobs", scenario="usd")
    expect(page.get_by_role("article", name="Desk tidy")).to_contain_text("US$9.42")


def test_empty(open_app):
    page = open_app("/jobs", scenario="empty")
    expect(page.get_by_text("No saved quotes yet")).to_be_visible()


def test_fail(open_app):
    page = open_app("/jobs", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_phone(open_app):
    page = open_app("/jobs", width=390, height=844)
    expect(cards(page).first).to_be_visible()
    assert_no_sideways_scroll(page)
