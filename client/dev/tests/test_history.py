"""Print history (Task 9)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def card(page, name):
    return page.get_by_role("article", name=name)


def test_cards(open_app):
    page = open_app("/archive")
    benchy = card(page, "Benchy")
    expect(benchy).to_contain_text("Finished")
    expect(benchy).to_contain_text("1h 2m")
    expect(benchy).to_contain_text("30.0 g")
    expect(benchy).to_contain_text("£0.63")
    expect(benchy.get_by_role("button", name="Play timelapse")).to_be_visible()
    bracket = card(page, "Bracket")
    expect(bracket).to_contain_text("Failed")
    expect(bracket).to_contain_text("No image")


def test_open_details(open_app):
    page = open_app("/archive")
    card(page, "Benchy").get_by_role("button", name="Open Benchy").click()
    panel = page.get_by_role("dialog", name="Benchy")
    expect(panel).to_contain_text("Looks good")
    expect(panel).to_contain_text("AI analysis")
    expect(panel).to_contain_text("£0.63")
    expect(panel).to_contain_text("0.120 kWh")
    img = panel.get_by_role("img", name="Photo of Benchy")
    assert "token=test" in img.get_attribute("src")
    video = panel.locator("video")
    assert "token=test" in video.get_attribute("src")


def test_select_does_not_open(open_app):
    page = open_app("/archive")
    page.get_by_role("checkbox", name="Select Benchy").check()
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.get_by_role("region", name="Selected prints")).to_contain_text("1 selected")


def test_bulk_delete(open_app, mock):
    page = open_app("/archive")
    page.get_by_role("checkbox", name="Select Benchy").check()
    bar = page.get_by_role("region", name="Selected prints")
    bar.get_by_role("button", name="Select all").click()
    expect(bar).to_contain_text("2 selected")
    bar.get_by_role("button", name="Delete selected").click()
    dialog = page.get_by_role("dialog", name="Delete Selected Archives?")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(bar).to_be_hidden()
    assert sorted(r["path"] for r in mock.requests("DELETE")) == ["/api/archives/1", "/api/archives/2"]


def test_menu_items(open_app):
    page = open_app("/archive")
    page.get_by_role("button", name="More actions for Bracket").click()
    menu = page.get_by_role("menu")
    for name in ["Fetch live camera", "Extract from timelapse", "Upload photo", "Upload video", "Delete"]:
        expect(menu.get_by_role("menuitem", name=name, exact=True)).to_be_visible()
    expect(menu.get_by_role("menuitem", name="Delete photo")).to_have_count(0)
    expect(menu.get_by_role("menuitem", name="Delete video")).to_have_count(0)
    page.keyboard.press("Escape")
    page.get_by_role("button", name="More actions for Benchy").click()
    expect(page.get_by_role("menuitem", name="Delete photo")).to_be_visible()
    expect(page.get_by_role("menuitem", name="Delete video")).to_be_visible()


def test_regenerate(open_app, mock):
    page = open_app("/archive")
    page.get_by_role("button", name="More actions for Benchy").click()
    page.get_by_role("menuitem", name="Fetch live camera").click()
    expect(page.get_by_role("status")).to_contain_text("Image regenerated")
    assert [r["body"] for r in mock.requests("POST", "/api/archives/1/regenerate-image")] == [{"source": "live"}]


def test_upload(open_app, mock, tmp_path):
    page = open_app("/archive")
    photo = tmp_path / "photo.png"
    photo.write_bytes(b"\x89PNG\r\n")
    page.get_by_role("button", name="More actions for Benchy").click()
    with page.expect_file_chooser() as fc:
        page.get_by_role("menuitem", name="Upload photo").click()
    fc.value.set_files(str(photo))
    expect(page.get_by_role("status")).to_contain_text("uploaded")
    posts = mock.requests("POST", "/api/archives/1/media")
    assert len(posts) == 1


def test_delete_one_confirms(open_app, mock):
    page = open_app("/archive")
    page.get_by_role("button", name="More actions for Bracket").click()
    page.get_by_role("menuitem", name="Delete", exact=True).click()
    dialog = page.get_by_role("dialog", name="Delete Archive?")
    expect(dialog).to_be_visible()
    assert mock.requests("DELETE") == []
    dialog.get_by_role("button", name="Confirm").click()
    expect(dialog).to_be_hidden()
    page.wait_for_timeout(200)
    assert [r["path"] for r in mock.requests("DELETE")] == ["/api/archives/2"]


def test_socket_update_in_open_panel(open_app, mock):
    page = open_app("/archive")
    card(page, "Bracket").get_by_role("button", name="Open Bracket").click()
    panel = page.get_by_role("dialog", name="Bracket")
    expect(panel).to_contain_text("Detached from bed")
    mock.emit("archive_updated", {"id": 2, "print_name": "Bracket", "status": "FAILED", "duration_seconds": 900,
                                   "total_cost": 0.73, "created_at": "2026-11-24 12:00:00", "spools_used": [],
                                   "ai_analysis": '{"status":"WARPED","reason":"Corner lifted"}'})
    expect(panel).to_contain_text("Corner lifted")


def test_timelapse_viewer(open_app):
    page = open_app("/archive")
    card(page, "Benchy").get_by_role("button", name="Play timelapse").click()
    viewer = page.get_by_role("dialog", name="Timelapse of Benchy")
    expect(viewer.get_by_role("link", name="Download")).to_be_visible()
    page.keyboard.press("Escape")
    expect(viewer).to_be_hidden()


def test_empty(open_app):
    page = open_app("/archive", scenario="empty")
    expect(page.get_by_text("No prints archived yet")).to_be_visible()


def test_fail(open_app):
    page = open_app("/archive", scenario="fail")
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_phone(open_app):
    page = open_app("/archive", width=390, height=844)
    expect(card(page, "Benchy")).to_be_visible()
    assert_no_sideways_scroll(page)
