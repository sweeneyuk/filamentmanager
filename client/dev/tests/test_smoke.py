import pytest
from playwright.sync_api import expect

ROUTES = ["/", "/inventory", "/archive", "/scrap-saver", "/analytics",
          "/calculator", "/jobs", "/profile", "/settings"]


@pytest.mark.parametrize("path", ROUTES)
def test_route_renders(open_app, path):
    page = open_app(path)
    expect(page.locator("main")).to_be_visible()
