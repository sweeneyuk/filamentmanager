"""Screenshot every route. Usage: python3 dev/screenshots.py OUT_DIR [widths...] [--scenario name]
Needs the mock server on 3001 and Vite on 3000 (npm run mock; npx vite)."""
import json, sys, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROUTES = {"status": "/", "spools": "/inventory", "history": "/archive", "scrap": "/scrap-saver",
          "analytics": "/analytics", "calculator": "/calculator", "jobs": "/jobs",
          "profile": "/profile", "settings": "/settings"}

args = sys.argv[1:]
scenario = "default"
if "--scenario" in args:
    i = args.index("--scenario"); scenario = args[i + 1]; del args[i:i + 2]
if "--routes" in args:
    i = args.index("--routes"); keep = args[i + 1].split(","); del args[i:i + 2]
    ROUTES = {k: v for k, v in ROUTES.items() if k in keep}
out = Path(args[0]); out.mkdir(parents=True, exist_ok=True)
widths = [int(w) for w in args[1:]] or [1440, 390]
req = urllib.request.Request("http://localhost:3001/__scenario", data=json.dumps({"name": scenario}).encode(),
                             method="POST", headers={"Content-Type": "application/json"})
urllib.request.urlopen(req)
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in widths:
        ctx = b.new_context(viewport={"width": w, "height": 900 if w > 500 else 844})
        ctx.add_init_script("localStorage.setItem('token','test')")
        pg = ctx.new_page()
        for name, path in ROUTES.items():
            pg.goto("http://localhost:3000" + path)
            pg.wait_for_timeout(900)
            pg.screenshot(path=str(out / f"{name}-{scenario}-{w}.png"), full_page=True)
        ctx.close()
    b.close()
print("saved to", out)
