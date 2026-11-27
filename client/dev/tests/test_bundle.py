"""Production build size (deferred minor from the Orbit review)."""
import subprocess
from pathlib import Path

CLIENT = Path(__file__).resolve().parents[2]
LIMIT = 500 * 1024


def test_no_script_over_500_kb(tmp_path):
    out = tmp_path / "dist"
    subprocess.run(["npx", "vite", "build", "--outDir", str(out), "--emptyOutDir"], cwd=CLIENT, check=True,
                   capture_output=True)
    big = {p.name: p.stat().st_size for p in (out / "assets").glob("*.js") if p.stat().st_size > LIMIT}
    assert big == {}, f"scripts over 500 kB: {big}"
