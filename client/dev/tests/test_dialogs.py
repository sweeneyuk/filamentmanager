"""Shared dialogs and toasts (Task 3), exercised through the Spools screen."""
from playwright.sync_api import expect


def _open_add_spool(page):
    page.get_by_role("button", name="Add spool").click()


def _deduct(page, spool_id):
    # Old screen: row button titled "Manual Deduct". Task 7 moves it into the row menu.
    row = page.locator("tbody tr").filter(has=page.get_by_role("cell", name=str(spool_id), exact=True))
    row.get_by_role("button", name="Manual Deduct").click()


def test_followup_prompt_stays_open(open_app, mock):
    page = open_app("/inventory")
    _open_add_spool(page)
    page.get_by_text("+ Add New").first.click()
    prompt = page.get_by_role("dialog", name="Add Brand")
    prompt.get_by_role("textbox").fill("Acme")
    prompt.get_by_role("button", name="Confirm").click()
    weight = page.get_by_role("dialog", name="Brand Weight")
    expect(weight).to_be_visible()
    weight.get_by_role("button", name="Confirm").click()
    expect(weight).to_be_hidden()
    posts = mock.requests("POST", "/api/brands")
    assert len(posts) == 1
    assert posts[0]["body"]["name"] == "Acme"


def test_error_from_prompt_is_shown(open_app):
    page = open_app("/inventory")
    _deduct(page, 1)
    prompt = page.get_by_role("dialog", name="Deduct Filament")
    prompt.get_by_role("textbox").fill("-5")
    prompt.get_by_role("button", name="Confirm").click()
    error = page.get_by_role("dialog", name="Invalid Amount")
    expect(error).to_be_visible()
    page.keyboard.press("Escape")
    expect(error).to_be_hidden()


def test_success_is_toast(open_app, mock):
    page = open_app("/inventory")
    _deduct(page, 1)
    prompt = page.get_by_role("dialog", name="Deduct Filament")
    prompt.get_by_role("textbox").fill("5")
    prompt.get_by_role("button", name="Confirm").click()
    expect(page.get_by_role("status")).to_contain_text("Deducted 5g")
    expect(page.get_by_role("dialog")).to_have_count(0)
    assert mock.requests("POST", "/api/spools/1/deduct")[0]["body"] == {"amount": 5}
