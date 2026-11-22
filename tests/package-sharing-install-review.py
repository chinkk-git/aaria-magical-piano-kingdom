#!/usr/bin/env python3
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json, os
root=Path.cwd()
evidence=Path(os.environ.get("EVIDENCE_DIR",root/"PR66_BROWSER_EVIDENCE"))
out=root/"AARIA_PIANO_PR66_SHARING_INSTALL_REVIEW.zip"
source_sha=os.environ.get("APP_SOURCE_SHA","unknown")
run_id=os.environ.get("GITHUB_RUN_ID","unknown")
repo=os.environ.get("GITHUB_REPOSITORY","chinkk-git/aaria-magical-piano-kingdom")
workflow_url=("https://github.com/"+repo+"/actions/runs/"+run_id) if run_id!="unknown" else "not run under GitHub Actions"
result=json.loads((evidence/"BROWSER-TEST-RESULTS.json").read_text())
readme=f"""# Aaria Piano Kingdom — PR #66 sharing and install review

PR: https://github.com/{repo}/pull/66
Commit tested: {source_sha}
Browser: Playwright 1.62.1 / Chromium {result["chromium"]}
Test origin: {result["baseUrl"]} (local static server)
Production URLs intended for release:
- https://chinkk-git.github.io/aaria-magical-piano-kingdom/
- https://chinkk-git.github.io/aaria-magical-piano-kingdom/?welcome=1

Device viewports and user-agent profiles:
- Android portrait 390×844 and landscape 844×390.
- iPhone portrait 390×844.
- iPad portrait 820×1180 and landscape 1180×820.
- Desktop Chromium 1440×900.

These are genuine screenshots from headless Chromium with viewport and user-agent emulation. They are not captures from physical mobile devices, native Safari, or WhatsApp.
The native install prompt callback was exercised with a synthetic beforeinstallprompt event. This verifies wiring only; no native OS prompt or installation is claimed.
The standalone-installed state was emulated through display-mode; no physical installed PWA was used.
WhatsApp preview rendering is not verified; this archive contains no WhatsApp capture.
The branch was not deployed, so public HTTP status/headers for its image URL were not tested.

## Screenshot inventory
"""+"\n".join("- "+p.name+" — actual Chromium capture." for p in sorted(evidence.glob("*.png")))+"""

The approved social thumbnail is an original image asset, not a browser screenshot.
"""
ci=f"""# CI report

Commit tested: {source_sha}
Focused browser/evidence workflow: {workflow_url} — PASS if this report was produced by the completed workflow.
The Pages packaging and metadata test run separately in the Pages workflow and are linked on PR #66 Checks.
Other applicable PWA, Release 2, Magic Star, Royal Hall, and Song Settings workflow results are linked on PR #66 Checks.
No merge or production deployment occurred.
WhatsApp preview: NOT VERIFIED.
Physical mobile devices: NOT TESTED; viewport/user-agent emulation only.
"""
(evidence/"README.md").write_text(readme,encoding="utf-8")
(evidence/"CI_REPORT.md").write_text(ci,encoding="utf-8")
expected=["01-android-portrait-welcome.png","02-android-landscape-welcome.png","03-android-install-choice-fallback.png","04-android-whatsapp-browser-fallback.png","05-iphone-welcome.png","06-iphone-add-to-home-screen.png","07-ipad-portrait-welcome.png","08-ipad-install-guidance.png","09-ipad-landscape-welcome.png","10-desktop-welcome.png","11-desktop-install-guidance.png","12-open-in-browser-existing-app.png","13-installed-standalone-bypass.png","14-normal-app-url.png","15-approved-social-thumbnail.jpg"]
missing=[name for name in expected if not (evidence/name).is_file()]
if missing: raise SystemExit("Missing evidence: "+", ".join(missing))
with ZipFile(out,"w",ZIP_DEFLATED,compresslevel=8) as archive:
    files=[evidence/"README.md",evidence/"CI_REPORT.md",evidence/"BROWSER-TEST-RESULTS.json",evidence/"BROWSER-VERSION.txt"]+sorted(evidence.glob("*.png"))+[evidence/"15-approved-social-thumbnail.jpg"]
    for file in files: archive.write(file,file.relative_to(evidence))
with ZipFile(out) as archive:
    bad=archive.testzip()
    if bad: raise SystemExit("Corrupt ZIP member: "+bad)
print(out.resolve(),out.stat().st_size)
