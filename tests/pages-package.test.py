#!/usr/bin/env python3
import json
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from verify_pages_package import verify  # noqa: E402


REQUIRED = (
    "v2.1-ui.js", "v2.1-ui.css", "pwa-update.js", "shared-song-loader.js", "shared-song-library.json",
    "omr-worker.js", "assets/v2.1-magic-wheel/corrected/panel_measure.svg",
    "assets/v2.1-magic-wheel/corrected/panel_loop.svg",
    "assets/v2.1-magic-wheel/corrected/panel_jump.svg",
    "assets/v2.1-magic-wheel/corrected/panel_practice.svg",
    "assets/v2.1-ui/make-music-3d-with-text.png",
    "assets/v2.1-ui/disco-star-3d.png",
    "assets/v2.1-magic-wheel/half_wheel_none.svg",
    "assets/v2.1-magic-wheel/half_wheel_measure.svg",
    "assets/v2.1-magic-wheel/half_wheel_loop.svg",
    "assets/v2.1-magic-wheel/half_wheel_jump.svg",
    "assets/v2.1-magic-wheel/half_wheel_practice.svg",
)


class PagesPackageGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.site = Path(self.temp.name)
        for rel in REQUIRED:
            path = self.site / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("runtime asset")
        (self.site / "style.css").write_text("body{background:url('./assets/pixel.png')}")
        (self.site / "assets/pixel.png").write_bytes(b"pixel")
        songs = ["Dalmatian Cradle Song", "DDLJ", "Golden", "Faith of Ophelia",
                 "Flowers - Miley Sirus", "Beautiful things -  Benson Boone"]
        (self.site / "shared-song-library.json").write_text(json.dumps({"songs": [{"title": s} for s in songs]}))
        (self.site / "pwa-update.js").write_text("const APP_BUILD='aaria-piano-v2.1.10'")
        omr_payload = b"omr-worker"
        (self.site / "omr-worker.js").write_bytes(omr_payload)
        (self.site / "release2-install-manifest.json").write_text(json.dumps({"files": [{
            "path": "./omr-worker.js", "bytes": len(omr_payload), "sha256": hashlib.sha256(omr_payload).hexdigest()
        }]}))
        (self.site / "index.html").write_text(
            '<link rel="stylesheet" href="./style.css?v=1">'
            '<link rel="stylesheet" href="./v2.1-ui.css?v=aaria-piano-v2.1.10">'
            '<script src="./v2.1-ui.js?v=aaria-piano-v2.1.10"></script>'
            '<script src="./pwa-update.js"></script><img src="./assets/pixel.png">')
        precache = ["./", "./index.html", "./v2.1-ui.js", "./v2.1-ui.css",
                    "./shared-song-loader.js", "./shared-song-library.json", "./omr-worker.js",
                    "./style.css", "./assets/pixel.png"] + ["./" + item for item in REQUIRED if item.startswith("assets/")]
        (self.site / "sw.js").write_text("const CACHE='aaria-piano-v2.1.10';const ASSETS=" + json.dumps(precache) + ";")

    def tearDown(self):
        self.temp.cleanup()

    def test_complete_artifact_passes_under_pages_prefix(self):
        self.assertEqual([], verify(self.site))

    def test_missing_runtime_file_fails_gate(self):
        (self.site / "v2.1-ui.js").unlink()
        failures = verify(self.site)
        self.assertTrue(any("v2.1-ui.js" in failure for failure in failures))

    def test_missing_service_worker_preload_fails_gate(self):
        (self.site / "assets/v2.1-magic-wheel/corrected/panel_loop.svg").unlink()
        failures = verify(self.site)
        self.assertTrue(any("panel_loop.svg" in failure for failure in failures))

    def test_missing_shared_song_fails_gate(self):
        (self.site / "shared-song-library.json").write_text('{"songs":[]}')
        failures = verify(self.site)
        self.assertTrue(any("Dalmatian Cradle Song" in failure for failure in failures))


if __name__ == "__main__":
    unittest.main()
