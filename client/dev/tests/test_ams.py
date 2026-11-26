"""Print status: AMS units, slot buttons and the slot panel (Task 6)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def slot(page, name):
    return page.get_by_role("button", name=name, exact=True)


def test_slots(open_app):
    page = open_app("/")
    expect(slot(page, "Slot 4, PLA, 691 grams left, feeding")).to_be_visible()
    expect(slot(page, "Slot 3, not assigned")).to_be_visible()
    expect(slot(page, "Slot 1, PLA, 400 grams left")).to_be_visible()
    expect(page.get_by_role("button", name="Slot 2, PLA, 50 grams left, low stock")).to_be_visible()
    expect(slot(page, "Slot 1, empty")).to_be_visible()  # unit 128 always has a card
    expect(page.get_by_text("Low stock", exact=True)).to_be_visible()
    expect(page.get_by_text("20-30% humidity")).to_be_visible()


def test_change_spool(open_app, mock):
    page = open_app("/")
    slot(page, "Slot 4, PLA, 691 grams left, feeding").click()
    panel = page.get_by_role("dialog", name="AMS 2 Pro, slot 4")
    expect(panel).to_be_visible()
    expect(panel).to_contain_text("Dark Red")
    panel.get_by_role("button", name="Spool 2").click()
    expect(panel).to_be_hidden()
    posts = mock.requests("POST", "/api/ams/assignments")
    assert [p["body"] for p in posts] == [{"printer_id": 1, "tray_id": "0-3", "spool_id": 2}]


def test_clear_slot(open_app, mock):
    page = open_app("/")
    slot(page, "Slot 4, PLA, 691 grams left, feeding").click()
    panel = page.get_by_role("dialog", name="AMS 2 Pro, slot 4")
    panel.get_by_role("button", name="Clear slot").click()
    expect(panel).to_be_hidden()
    posts = mock.requests("POST", "/api/ams/assignments")
    assert [p["body"] for p in posts] == [{"printer_id": 1, "tray_id": "0-3", "spool_id": ""}]


def test_missing_spool_can_be_cleared(open_app, mock):
    page = open_app("/")
    slot(page, "Slot 3, not assigned").click()
    panel = page.get_by_role("dialog", name="AMS 2 Pro, slot 3")
    expect(panel).to_contain_text("Not assigned")
    panel.get_by_role("button", name="Clear slot").click()
    expect(panel).to_be_hidden()
    posts = mock.requests("POST", "/api/ams/assignments")
    assert [p["body"] for p in posts] == [{"printer_id": 1, "tray_id": "0-2", "spool_id": ""}]


def test_empty_holders(open_app, mock):
    page = open_app("/")
    expect(page.get_by_text("2 external spool holders are empty.")).to_be_visible()
    buttons = page.get_by_role("button", name="Assign external spool")
    expect(buttons).to_have_count(2)
    buttons.first.click()
    panel = page.get_by_role("dialog")
    panel.get_by_role("button", name="Spool 1").click()
    expect(panel).to_be_hidden()
    posts = mock.requests("POST", "/api/ams/assignments")
    assert [p["body"] for p in posts] == [{"printer_id": 1, "tray_id": "254-0", "spool_id": 1}]


def test_rename(open_app, mock):
    page = open_app("/")
    page.get_by_role("button", name="Rename AMS 2 Pro").click()
    prompt = page.get_by_role("dialog", name="Rename AMS 1")
    prompt.get_by_role("textbox").fill("Dry box")
    prompt.get_by_role("button", name="Confirm").click()
    expect(prompt).to_be_hidden()
    posts = mock.requests("POST", "/api/settings")
    assert [p["body"] for p in posts] == [{"ams_name_1_0": "Dry box"}]


def test_black_spool_outlined(open_app):
    page = open_app("/")
    ring = slot(page, "Slot 1, PLA, 400 grams left").locator(".ui-ring")
    shadow = ring.evaluate("el => getComputedStyle(el).boxShadow")
    assert "0.28" in shadow


def test_keyboard(open_app):
    page = open_app("/")
    button = slot(page, "Slot 4, PLA, 691 grams left, feeding")
    button.focus()
    page.keyboard.press("Enter")
    panel = page.get_by_role("dialog", name="AMS 2 Pro, slot 4")
    expect(panel).to_be_visible()
    page.keyboard.press("Escape")
    expect(panel).to_be_hidden()
    expect(button).to_be_focused()


def test_no_ams_data_message(open_app):
    page = open_app("/", scenario="two-printers")
    expect(page.get_by_text("No AMS data received yet", exact=False)).to_be_visible()


def test_phone(open_app):
    page = open_app("/", width=390, height=844)
    expect(slot(page, "Slot 4, PLA, 691 grams left, feeding")).to_be_visible()
    assert_no_sideways_scroll(page)


def test_finished_print_has_no_feeding_marks(open_app):
    page = open_app("/", scenario="finished")
    expect(page.locator("header .ui-pill")).to_have_text("Finished")
    expect(slot(page, "Slot 4, PLA, 691 grams left")).to_be_visible()
    expect(page.locator(".ps-slot.is-feeding, .ps-slot.is-in-use")).to_have_count(0)
