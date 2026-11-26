"""Spool form (Task 8), including the fix for input being wiped."""
from playwright.sync_api import expect


def open_add(page):
    page.locator("header").get_by_role("button", name="Add spool").click()
    form = page.get_by_role("dialog", name="Add spool")
    expect(form).to_be_visible()
    return form


def answer(page, title, text=None):
    prompt = page.get_by_role("dialog", name=title)
    if text is not None:
        prompt.get_by_role("textbox").fill(text)
    prompt.get_by_role("button", name="Confirm").click()


def test_add_brand_keeps_input(open_app, mock):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_label("Subtype").fill("Matte")
    form.get_by_label("Cost").fill("18")
    form.get_by_role("button", name="Add brand").click()
    answer(page, "Add Brand", "Acme")
    answer(page, "Brand Weight")
    form = page.get_by_role("dialog", name="Add spool")
    expect(form.get_by_label("Brand")).to_have_value("99")
    expect(form.get_by_label("Subtype")).to_have_value("Matte")
    expect(form.get_by_label("Cost")).to_have_value("18")
    form.get_by_role("button", name="Add spool").click()
    expect(form).to_be_hidden()
    posts = mock.requests("POST", "/api/spools")
    assert len(posts) == 1
    assert int(posts[0]["body"]["brand_id"]) == 99
    assert posts[0]["body"]["subtype"] == "Matte"


def test_add_material_keeps_input(open_app, mock):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_label("Subtype").fill("Matte")
    form.get_by_role("button", name="Add material").click()
    answer(page, "Add Material", "ASA")
    form = page.get_by_role("dialog", name="Add spool")
    expect(form.get_by_label("Material")).to_have_value("98")
    expect(form.get_by_label("Subtype")).to_have_value("Matte")
    form.get_by_label("Cost").fill("20")
    form.get_by_role("button", name="Add spool").click()
    expect(form).to_be_hidden()
    assert int(mock.requests("POST", "/api/spools")[0]["body"]["material_id"]) == 98


def test_live_update_keeps_input(open_app, mock):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_label("Subtype").fill("Silk")
    with page.expect_response("**/api/brands"):
        mock.emit("spool_added", {"id": 7})
    page.wait_for_timeout(300)
    expect(form.get_by_label("Subtype")).to_have_value("Silk")


def test_defaults_for_new_spool(open_app):
    page = open_app("/inventory")
    form = open_add(page)
    expect(form.get_by_label("Brand")).to_have_value("1")
    expect(form.get_by_label("Material")).to_have_value("1")
    expect(form.get_by_label("Label weight (g)")).to_have_value("1000")
    expect(form.get_by_label("Empty weight (g)")).to_have_value("250")
    expect(form.get_by_text("Reusable spool")).to_be_visible()


def test_edit_saves(open_app, mock):
    page = open_app("/inventory")
    page.get_by_role("button", name="Edit spool 1", exact=True).click()
    form = page.get_by_role("dialog", name="Edit spool")
    expect(form.get_by_label("Colour name")).to_have_value("Dark Red")
    form.get_by_label("Subtype").fill("Silk")
    form.get_by_role("button", name="Save changes").click()
    expect(form).to_be_hidden()
    puts = mock.requests("PUT", "/api/spools/1")
    assert len(puts) == 1
    assert puts[0]["body"]["subtype"] == "Silk"
    assert "rfid" in puts[0]["body"]


def test_reopen_is_fresh(open_app):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_label("Subtype").fill("Matte")
    form.get_by_role("button", name="Cancel").click()
    expect(form).to_be_hidden()
    form = open_add(page)
    expect(form.get_by_label("Subtype")).to_have_value("")


def test_double_submit(open_app, mock):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_label("Cost").fill("20")
    mock.delay(800)
    form.get_by_role("button", name="Add spool").dblclick()
    expect(form).to_be_hidden(timeout=5000)
    mock.delay(0)
    assert len(mock.requests("POST", "/api/spools")) == 1


def test_auto_detect_needs_colour_name(open_app):
    page = open_app("/inventory")
    form = open_add(page)
    form.get_by_role("button", name="Auto-detect").click()
    expect(page.get_by_role("dialog", name="Missing Info")).to_be_visible()


def test_phone_full_screen(open_app):
    page = open_app("/inventory", width=390, height=844)
    form = open_add(page)
    assert form.evaluate("el => el.offsetWidth") == 390  # layout width, unaffected by the opening scale
