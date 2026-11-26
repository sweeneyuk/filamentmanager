"""Analytics (Task 11)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def tile(page, label):
    return page.locator(".ui-stat").filter(has=page.get_by_text(label, exact=True))


def test_tiles(open_app):
    page = open_app("/analytics")
    expect(tile(page, "Total prints")).to_contain_text("2")
    expect(tile(page, "Filament used")).to_contain_text("0.04 kg")
    expect(tile(page, "Total cost")).to_contain_text("£1.36")
    expect(tile(page, "Total cost")).to_contain_text("Filament: £1.32")
    expect(tile(page, "Energy cost")).to_contain_text("£0.04")


def test_bars_and_failures(open_app):
    page = open_app("/analytics")
    materials = page.get_by_role("region", name="Filament by material")
    expect(materials.get_by_role("listitem").filter(has_text="PLA")).to_contain_text("30.0 g")
    expect(materials.get_by_role("listitem").filter(has_text="PETG")).to_contain_text("12.0 g")
    failures = page.get_by_role("region", name="Failure types")
    expect(failures).to_contain_text("SPAGHETTI")
    expect(page.get_by_role("region", name="Success rate")).to_contain_text("50%")
    problems = page.get_by_role("region", name="Problem filament")
    expect(problems).to_contain_text("Bambu Lab PETG")
    expect(problems).to_contain_text("100% (1 of 1)")


def test_refetch_on_archive_event(open_app, mock):
    page = open_app("/analytics")
    expect(tile(page, "Total prints")).to_contain_text("2")
    with page.expect_response("**/api/analytics"):
        mock.emit("archive_deleted", {"id": 2})


def test_empty(open_app):
    page = open_app("/analytics", scenario="empty")
    expect(page.get_by_text("No finished prints yet")).to_be_visible()


def test_fail(open_app):
    page = open_app("/analytics", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_phone(open_app):
    page = open_app("/analytics", width=390, height=844)
    expect(tile(page, "Total prints")).to_be_visible()
    assert_no_sideways_scroll(page)
