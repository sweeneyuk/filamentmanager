"""Settings and printers (Task 14)."""
import pytest
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll

TABS = {
    "Integrations": ["ha_url", "ha_token", "ha_printer_energy_entity", "energy_rate_source", "manual_energy_rate", "gemini_api_key"],
    "Stock and preferences": ["low_stock_threshold", "bambu_store_region", "calc_wear_rate", "calc_energy_rate",
                              "calc_labor_rate", "calc_markup", "calc_avg_wattage"],
    "Security and sign-in": ["oidc_issuer", "oidc_client_id", "oidc_client_secret"],
    "Backups": ["auto_backup_enabled"],
}


def tab(page, name):
    page.get_by_role("tab", name=name).click()
    return page.get_by_role("tabpanel", name=name)


@pytest.mark.parametrize("name,fields", TABS.items())
def test_fields_exist(open_app, name, fields):
    page = open_app("/settings")
    panel = tab(page, name)
    for field in fields:
        expect(panel.locator(f"[name={field}]").first).to_be_attached()


def test_manual_rate_field(open_app):
    page = open_app("/settings")
    panel = tab(page, "Integrations")
    panel.get_by_label("Manual entry").check()
    expect(panel.locator("[name=manual_energy_rate]")).to_be_visible()
    expect(panel.get_by_label("Manual electricity rate (£/kWh)")).to_be_visible()
    panel.get_by_label("Home Assistant entity").check()
    expect(panel.locator("[name=ha_rate_entity]")).to_be_visible()
    expect(panel.locator("[name=manual_energy_rate]")).to_have_count(0)


def test_backup_options_show_when_enabled(open_app):
    page = open_app("/settings")
    panel = tab(page, "Backups")
    expect(panel.locator("[name=auto_backup_interval_days]")).to_have_count(0)
    panel.get_by_label("Enable auto backups").check()
    expect(panel.locator("[name=auto_backup_interval_days]")).to_be_visible()
    expect(panel.locator("[name=auto_backup_retention]")).to_have_value("5")


def test_save_stock(open_app, mock):
    page = open_app("/settings")
    panel = tab(page, "Stock and preferences")
    panel.locator("[name=low_stock_threshold]").fill("150")
    panel.get_by_role("button", name="Save").click()
    expect(page.get_by_role("status")).to_contain_text("Settings saved")
    body = mock.requests("POST", "/api/settings")[0]["body"]
    assert body["low_stock_threshold"] == "150"
    assert body["currency"] == "GBP"  # whole object posted


def test_ha_test(open_app, mock):
    page = open_app("/settings")
    tab(page, "Integrations").get_by_role("button", name="Test Home Assistant connection").click()
    expect(page.get_by_role("status")).to_contain_text("Connected")
    assert len(mock.requests("POST", "/api/test/ha")) == 1


def test_add_printer(open_app, mock):
    page = open_app("/settings")
    panel = page.get_by_role("tabpanel", name="Printers")
    expect(panel).to_contain_text("X2D")
    panel.get_by_role("button", name="Add printer").click()
    dialog = page.get_by_role("dialog", name="Add printer")
    dialog.get_by_label("Printer name").fill("A1")
    dialog.get_by_label("IP address").fill("10.0.0.5")
    dialog.get_by_label("Serial number").fill("SN9")
    expect(dialog.get_by_label("Access code")).to_have_attribute("required", "")
    dialog.get_by_label("Access code").fill("1234")
    dialog.get_by_role("button", name="Add printer").click()
    expect(dialog).to_be_hidden()
    assert mock.requests("POST", "/api/printers")[0]["body"] == {"name": "A1", "ip": "10.0.0.5", "serial": "SN9", "access_code": "1234"}


def test_edit_printer_blank_code(open_app, mock):
    page = open_app("/settings")
    page.get_by_role("button", name="Edit X2D").click()
    dialog = page.get_by_role("dialog", name="Edit printer")
    expect(dialog.get_by_label("Access code")).to_have_value("")
    dialog.get_by_role("button", name="Update printer").click()
    expect(dialog).to_be_hidden()
    body = mock.requests("PUT", "/api/printers/1")[0]["body"]
    assert body["access_code"] == "" and body["name"] == "X2D"


def test_delete_printer_confirms(open_app, mock):
    page = open_app("/settings")
    page.get_by_role("button", name="Delete X2D").click()
    dialog = page.get_by_role("dialog", name="Delete printer")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(dialog).to_be_hidden()
    page.wait_for_timeout(200)
    assert [r["path"] for r in mock.requests("DELETE")] == ["/api/printers/1"]


def test_manual_backup(open_app, mock):
    page = open_app("/settings")
    panel = tab(page, "Backups")
    expect(panel).to_contain_text("backup-2026-11-25.zip")
    panel.get_by_role("button", name="Create manual backup").click()
    expect(page.get_by_role("status")).to_contain_text("Backup created: backup.zip")


def test_restore_rejects_txt(open_app, mock, tmp_path):
    page = open_app("/settings")
    panel = tab(page, "Backups")
    expect(panel).to_contain_text("completely overwrite")
    f = tmp_path / "notes.txt"
    f.write_text("x")
    with page.expect_file_chooser() as fc:
        panel.get_by_role("button", name="Upload and restore backup").click()
    fc.value.set_files(str(f))
    expect(page.get_by_role("dialog", name="Error")).to_contain_text("Only .zip")
    assert mock.requests("POST", "/api/backups/restore") == []


def test_logout(open_app):
    page = open_app("/settings")
    tab(page, "Security and sign-in").get_by_role("button", name="Sign out local admin").click()
    expect(page.get_by_role("navigation", name="Main")).to_have_count(0)


def test_phone_tabs_scroll(open_app):
    page = open_app("/settings", width=390, height=844)
    expect(page.get_by_role("tab", name="Backups")).to_be_attached()
    assert_no_sideways_scroll(page)


def test_fail(open_app):
    page = open_app("/settings", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()
