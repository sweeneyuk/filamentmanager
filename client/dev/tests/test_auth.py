"""Profile and sign-in (Task 15)."""
from playwright.sync_api import expect

from conftest import assert_no_sideways_scroll


def test_sign_in(open_app, mock):
    page = open_app("/", token=None)
    expect(page.get_by_role("heading", name="Filament Manager")).to_be_visible()
    expect(page.get_by_text("Sign in to access your dashboard")).to_be_visible()
    page.get_by_label("Username").fill("tester")
    page.get_by_label("Password").fill("secret")
    page.get_by_role("button", name="Login", exact=True).click()
    expect(page.get_by_role("navigation", name="Main")).to_be_visible()
    assert mock.requests("POST", "/api/auth/login")[0]["body"] == {"username": "tester", "password": "secret"}


def test_sso_hides_form_until_local(open_app):
    page = open_app("/", scenario="sso", token=None)
    expect(page.get_by_role("button", name="Login with Authentik (SSO)")).to_be_visible()
    expect(page.get_by_label("Username")).to_have_count(0)
    page.get_by_role("button", name="Admin local login").click()
    expect(page.get_by_label("Username")).to_be_visible()


def test_local_query(open_app):
    page = open_app("/?local=true", scenario="sso", token=None)
    expect(page.get_by_label("Username")).to_be_visible()


def test_error_query(open_app):
    page = open_app("/?error=Denied", token=None)
    expect(page.get_by_role("alert")).to_have_text("Denied")


def test_first_run_setup(open_app, mock):
    page = open_app("/", scenario="setup", token=None)
    expect(page.get_by_text("Create your initial admin account")).to_be_visible()
    page.get_by_label("Username").fill("admin")
    page.get_by_label("Password").fill("pw")
    page.get_by_role("button", name="Complete setup").click()
    expect(page.get_by_role("navigation", name="Main")).to_be_visible()
    assert mock.requests("POST", "/api/auth/setup")[0]["body"] == {"username": "admin", "password": "pw"}


def test_profile_and_sign_out(open_app):
    page = open_app("/profile")
    main = page.locator("main")
    expect(main.get_by_role("heading", name="tester")).to_be_visible()
    expect(main).to_contain_text("only end your local Filament Manager session")
    main.get_by_role("button", name="Sign out").click()
    expect(page.get_by_label("Username")).to_be_visible()


def test_phone(open_app):
    page = open_app("/", token=None, width=390, height=844)
    expect(page.get_by_label("Username")).to_be_visible()
    assert_no_sideways_scroll(page)
