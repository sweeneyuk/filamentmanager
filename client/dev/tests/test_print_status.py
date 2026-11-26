"""Print status: header, current print and readings (Task 5)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def tile(page, label):
    return page.locator(".ui-stat").filter(has=page.get_by_text(label, exact=True))


def test_current_print(open_app):
    page = open_app("/")
    expect(page.get_by_role("heading", level=1)).to_have_text("X2D")
    hero = page.get_by_role("region", name="Current print")
    expect(hero).to_contain_text("64%")
    expect(hero).to_contain_text("Layer 142 of 222")
    expect(hero).to_contain_text("2h 5m")
    expect(hero).to_contain_text("31.4 g")
    expect(hero).to_contain_text("Used of 49.1 g")
    expect(hero).to_contain_text("Bambu Lab PLA, dark red, from AMS 2 Pro slot 4")
    expect(hero).to_contain_text("Articulated_dragon")
    expect(page.locator("header")).to_contain_text("Printing")


def test_temperatures(open_app):
    page = open_app("/")
    expect(tile(page, "Left nozzle")).to_contain_text("35")
    expect(tile(page, "Right nozzle")).to_contain_text("215")
    expect(tile(page, "Right nozzle")).to_contain_text("of 220")
    expect(tile(page, "Bed")).to_contain_text("55")
    expect(tile(page, "Chamber")).to_contain_text("38")
    expect(page.get_by_text("Part fan 100%")).to_be_visible()
    expect(page.get_by_text("light on", exact=False)).to_be_visible()


def test_runout(open_app):
    page = open_app("/", scenario="runout")
    expect(page.locator("header .ui-pill")).to_have_text("Paused")
    expect(page.get_by_text("Filament runout", exact=False).first).to_be_visible()
    expect(page.get_by_text("Auto-refill takeover", exact=False)).to_be_visible()


def test_events_open_dialogs(open_app, mock):
    page = open_app("/")
    expect(page.get_by_text("64%")).to_be_visible()
    mock.emit("spool_runout", {"printer_id": 1, "tray_id": "0-3", "progress": 64})
    expect(page.get_by_role("dialog", name="Filament Runout")).to_be_visible()
    page.keyboard.press("Escape")
    mock.emit("spool_takeover", {"printer_id": 1, "from_tray": "0-0", "to_tray": "0-3", "progress": 50})
    expect(page.get_by_role("dialog", name="Spool Takeover")).to_be_visible()


def test_live_update(open_app, mock):
    page = open_app("/")
    expect(page.get_by_text("64%")).to_be_visible()
    state = {"status": "RUNNING", "stage": "Printing", "name": "Dragon", "progress": 80, "remainingTime": 30,
             "layerNum": 200, "totalLayerNum": 222}
    mock.emit("print_state_update", {"printer_id": 1, "state": state})
    expect(page.get_by_text("80%")).to_be_visible()


def test_idle(open_app):
    page = open_app("/", scenario="idle")
    expect(page.locator("header .ui-pill")).to_have_text("Idle")
    expect(page.get_by_text("Benchy")).to_be_visible()
    expect(page.get_by_role("img", name="percent complete")).to_have_count(0)
    expect(tile(page, "Bed")).to_contain_text("24")


def test_two_printers(open_app):
    page = open_app("/", scenario="two-printers")
    expect(page.get_by_role("heading", level=1)).to_have_text("Print status")
    expect(page.get_by_role("heading", name="X2D", level=2)).to_be_visible()
    expect(page.get_by_role("heading", name="P1S", level=2)).to_be_visible()


def test_no_state(open_app):
    page = open_app("/", scenario="no-state")
    expect(page.get_by_text("Waiting for printer")).to_be_visible()


def test_empty(open_app):
    page = open_app("/", scenario="empty")
    main = page.locator("main")
    expect(main.get_by_text("No printers configured")).to_be_visible()
    expect(main.get_by_role("link", name="Settings")).to_have_attribute("href", "/settings")


def test_fail(open_app):
    page = open_app("/", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_sparse_data(open_app):
    page = open_app("/", scenario="sparse")
    expect(page.get_by_text("Calculating…")).to_be_visible()
    body = page.locator("body").inner_text()
    assert "NaN" not in body
    assert "undefined" not in body


def test_no_sideways_scroll(open_app):
    page = open_app("/", width=390, height=844)
    expect(page.get_by_text("64%")).to_be_visible()
    assert_no_sideways_scroll(page)


def test_finished_without_name(open_app):
    page = open_app("/", scenario="finished")
    expect(page.locator("header .ui-pill")).to_have_text("Finished")
    expect(page.get_by_text("Bed", exact=True)).to_be_visible()
    expect(page.get_by_text("No print yet")).to_have_count(0)
    expect(page.get_by_text("Last print")).to_have_count(0)
