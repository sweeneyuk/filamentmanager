"""Spools list (Task 7)."""
import json
import re

from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll

SELECT = re.compile(r"^Select spool \d+$")


def shown_ids(page):
    boxes = page.get_by_role("checkbox", name=SELECT)
    expect(boxes.first).to_be_visible()
    return [int(re.search(r"\d+", b.get_attribute("aria-label")).group()) for b in boxes.all()]


def test_filters(open_app):
    page = open_app("/inventory")
    assert sorted(shown_ids(page)) == [1, 2, 3, 4, 6]
    page.get_by_role("tab", name="Archived").click()
    expect(page.get_by_role("checkbox", name=SELECT)).to_have_count(1)
    assert shown_ids(page) == [5]
    page.get_by_role("tab", name="Low stock").click()
    expect(page.get_by_role("checkbox", name=SELECT)).to_have_count(3)
    assert sorted(shown_ids(page)) == [3, 4, 6]


def test_sort_persists(open_app):
    page = open_app("/inventory")
    page.get_by_role("button", name="Remaining").click()
    expect(page.get_by_role("columnheader", name="Remaining")).to_have_attribute("aria-sort", "ascending")
    assert shown_ids(page) == [4, 3, 6, 2, 1]
    page.reload()
    expect(page.get_by_role("columnheader", name="Remaining")).to_have_attribute("aria-sort", "ascending")
    assert shown_ids(page) == [4, 3, 6, 2, 1]


def test_bad_storage(open_app):
    page = open_app("/inventory", storage={"fm_sort_config": "{oops", "fm_view_mode": "x"})
    expect(page.get_by_role("table")).to_be_visible()
    assert shown_ids(page) == [6, 4, 3, 2, 1]


def test_colour_name_and_location(open_app):
    page = open_app("/inventory")
    row6 = page.get_by_role("row").filter(has=page.get_by_role("checkbox", name="Select spool 6"))
    expect(row6).to_contain_text("Teal")
    row1 = page.get_by_role("row").filter(has=page.get_by_role("checkbox", name="Select spool 1"))
    expect(row1).to_contain_text("X2D - AMS 2 Pro - Slot 4")
    expect(row1).to_contain_text("£20.00")


def test_row_menu_deduct(open_app, mock):
    page = open_app("/inventory")
    page.get_by_role("button", name="More actions for spool 1").click()
    page.get_by_role("menuitem", name="Deduct").click()
    prompt = page.get_by_role("dialog", name="Deduct Filament")
    prompt.get_by_role("textbox").fill("5")
    prompt.get_by_role("button", name="Confirm").click()
    expect(page.get_by_role("status")).to_contain_text("Deducted 5g")
    assert [r["body"] for r in mock.requests("POST", "/api/spools/1/deduct")] == [{"amount": 5}]


def test_delete_confirms(open_app, mock):
    page = open_app("/inventory")
    page.get_by_role("button", name="More actions for spool 1").click()
    page.get_by_role("menuitem", name="Delete").click()
    dialog = page.get_by_role("dialog", name="Delete Spool")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(dialog).to_be_hidden()
    page.wait_for_timeout(300)
    assert [r["path"] for r in mock.requests("DELETE")] == ["/api/spools/1"]


def test_archive_from_menu(open_app, mock):
    page = open_app("/inventory")
    page.get_by_role("button", name="More actions for spool 1").click()
    page.get_by_role("menuitem", name="Archive").click()
    page.wait_for_timeout(300)
    assert [r["body"] for r in mock.requests("PUT", "/api/spools/1/archive")] == [{"archived": True}]


def test_bulk_location(open_app, mock):
    page = open_app("/inventory")
    page.get_by_role("checkbox", name="Select spool 1").check()
    page.get_by_role("checkbox", name="Select spool 2").check()
    bar = page.get_by_role("region", name="Selected spools")
    expect(bar).to_contain_text("2 spools selected")
    bar.get_by_role("button", name="Set location").click()
    prompt = page.get_by_role("dialog", name="Update Location")
    prompt.get_by_role("textbox").fill("Shelf B")
    prompt.get_by_role("button", name="Confirm").click()
    expect(bar).to_be_hidden()
    puts = mock.requests("PUT")
    assert sorted(r["path"] for r in puts) == ["/api/spools/1", "/api/spools/2"]
    assert all(r["body"]["location"] == "Shelf B" for r in puts)


def test_select_all(open_app):
    page = open_app("/inventory")
    page.get_by_role("checkbox", name="Select all spools").check()
    expect(page.get_by_role("region", name="Selected spools")).to_contain_text("5 spools selected")


def test_import_export_menu(open_app, mock, tmp_path):
    page = open_app("/inventory")
    page.get_by_role("button", name="Import and export").click()
    expect(page.get_by_role("menuitem", name="Export CSV")).to_be_visible()
    csv = tmp_path / "spools.csv"
    csv.write_text("id,brand\n")
    with page.expect_file_chooser() as fc:
        page.get_by_role("menuitem", name="Import CSV").click()
    fc.value.set_files(str(csv))
    expect(page.get_by_role("status")).to_contain_text("CSV imported")
    assert len(mock.requests("POST", "/api/import/csv")) == 1
    page.get_by_role("button", name="Import and export").click()
    with page.expect_request("**/api/export/csv"):
        page.get_by_role("menuitem", name="Export CSV").click()


def test_stats_toggle(open_app):
    page = open_app("/inventory")
    stats = page.get_by_role("region", name="Stock summary")
    expect(stats).to_be_hidden()
    page.get_by_role("button", name="Show stats").click()
    expect(stats).to_be_visible()
    expect(stats).to_contain_text("Total inventory")
    expect(stats).to_contain_text("Low stock")
    page.get_by_role("button", name="Hide stats").click()
    expect(stats).to_be_hidden()


def test_grid_actions_visible(open_app):
    page = open_app("/inventory")
    page.get_by_role("button", name="Grid view").click()
    expect(page.get_by_role("table")).to_have_count(0)
    expect(page.get_by_role("button", name="Edit spool 1", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="More actions for spool 1")).to_be_visible()
    assert page.evaluate("localStorage.getItem('fm_view_mode')") == "grid"


def test_restock_shown_when_low(open_app):
    page = open_app("/inventory")
    expect(page.get_by_role("link", name="Restock spool 1")).to_have_count(0)


def test_phone_cards(open_app):
    page = open_app("/inventory", width=390, height=844)
    expect(page.get_by_role("checkbox", name="Select spool 1")).to_be_visible()
    expect(page.get_by_role("table")).to_have_count(0)
    expect(page.get_by_role("combobox", name="Sort by")).to_be_visible()
    expect(page.get_by_role("button", name="Edit spool 1", exact=True)).to_be_visible()
    assert_no_sideways_scroll(page)


def test_empty(open_app):
    page = open_app("/inventory", scenario="empty")
    expect(page.get_by_text("No spools found for this filter.")).to_be_visible()


def test_fail(open_app):
    page = open_app("/inventory", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_socket_delete(open_app, mock):
    page = open_app("/inventory")
    expect(page.get_by_role("checkbox", name="Select spool 1")).to_be_visible()
    mock.emit("spool_deleted", {"id": 1})
    expect(page.get_by_role("checkbox", name="Select spool 1")).to_have_count(0)
