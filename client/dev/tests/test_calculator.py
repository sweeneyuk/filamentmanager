"""Calculator (Task 12), including the saved quote spool cost fix."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def parse_file(page, tmp_path):
    f = tmp_path / "plate.gcode.3mf"
    f.write_bytes(b"PK\x03\x04")
    page.locator("input[type=file]").set_input_files(str(f))
    page.get_by_role("button", name="Analyse file").click()
    expect(page.get_by_role("region", name="Print requirements")).to_be_visible()


def pick(page, slot, spool_id):
    page.get_by_role("button", name=f"Choose spool for slot {slot}").click()
    dialog = page.get_by_role("dialog", name=f"Spool for slot {slot}")
    dialog.get_by_role("button", name=f"Spool {spool_id}").click()
    expect(dialog).to_be_hidden()


def test_quote(open_app, mock, tmp_path):
    page = open_app("/calculator")
    parse_file(page, tmp_path)
    assert len(mock.requests("POST", "/api/calculator/parse")) == 1
    pick(page, 1, 1)
    pick(page, 2, 2)
    summary = page.get_by_role("region", name="Quote")
    expect(summary).to_contain_text("£2.20")
    expect(summary).to_contain_text("£9.41")


def test_save_quote_costs(open_app, mock, tmp_path):
    page = open_app("/calculator")
    parse_file(page, tmp_path)
    pick(page, 1, 1)
    pick(page, 2, 2)
    page.get_by_role("button", name="Save quote").click()
    dialog = page.get_by_role("dialog", name="Save quote")
    save = dialog.get_by_role("button", name="Save quote")
    expect(save).to_be_disabled()
    dialog.get_by_label("Project name").fill("Test")
    expect(save).to_be_enabled()
    save.click()
    expect(dialog).to_be_hidden()
    body = mock.requests("POST", "/api/jobs")[0]["body"]
    assert body["project_name"] == "Test"
    assert body["spool_data"][0]["cost"] == 1
    assert abs(body["spool_data"][1]["cost"] - 1.2) < 1e-9
    assert abs(body["final_price"] - 9.4125) < 1e-9


def test_keyboard_file_choice(open_app, mock, tmp_path):
    page = open_app("/calculator")
    f = tmp_path / "plate.gcode.3mf"
    f.write_bytes(b"PK")
    choose = page.get_by_role("button", name="Choose a .3mf file")
    expect(choose).to_be_visible()
    page.wait_for_load_state("networkidle")
    choose.focus()
    expect(choose).to_be_focused()
    with page.expect_file_chooser() as fc:
        page.keyboard.press("Enter")
    fc.value.set_files(str(f))
    page.get_by_role("button", name="Analyse file").focus()
    page.keyboard.press("Enter")
    expect(page.get_by_role("region", name="Print requirements")).to_be_visible()


def test_quantity_and_labour(open_app, tmp_path):
    page = open_app("/calculator")
    parse_file(page, tmp_path)
    expect(page.get_by_label("Labour (minutes per item)")).to_have_value("15")
    page.get_by_label("Quantity").fill("0")
    page.get_by_label("Quantity").blur()
    expect(page.get_by_label("Quantity")).to_have_value("1")


def test_fail(open_app):
    page = open_app("/calculator", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_phone(open_app, tmp_path):
    page = open_app("/calculator", width=390, height=844)
    parse_file(page, tmp_path)
    assert_no_sideways_scroll(page)
