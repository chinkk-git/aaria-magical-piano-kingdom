#!/usr/bin/env python3
import json, os, shutil, struct, zipfile
from pathlib import Path

root = Path.cwd()
out = root / "final-owner-review"
archive = root / "AARIA_V2_1_RELEASE2_COMPLETE_FINAL_ACCEPTANCE.zip"
sha = os.environ.get("APP_SOURCE_SHA", "unknown")
runs = json.loads(os.environ.get("SOURCE_RUNS", "{}"))
v21_id = os.environ.get("V21_RUN_ID", "")
v21_url = os.environ.get("V21_RUN_URL", "")
v21_conclusion = os.environ.get("V21_CONCLUSION", "unknown")
shutil.rmtree(out, ignore_errors=True)
archive.unlink(missing_ok=True)
(out / "screenshots").mkdir(parents=True)
(out / "recordings").mkdir()
(out / "diagnostics").mkdir()

sources = root / "evidence-source"
for source in sources.glob("*"):
    processed = set()
    while True:
        zips = [p for p in source.rglob("*.zip") if p not in processed]
        if not zips:
            break
        for item in zips:
            processed.add(item)
            dest = item.parent / (item.stem + "__unpacked")
            dest.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(item) as zf:
                    for info in zf.infolist():
                        target = (dest / info.filename).resolve()
                        if dest.resolve() not in target.parents and target != dest.resolve():
                            raise ValueError("Unsafe ZIP entry: " + info.filename)
                    zf.extractall(dest)
            except Exception as exc:
                (out / "diagnostics" / (item.stem + "-unpack-error.txt")).write_text(str(exc) + "\n")

def files(base, suffixes):
    if not base.exists():
        return []
    return sorted(p for p in base.rglob("*") if p.is_file() and p.suffix.lower() in suffixes)

v21 = sources / "v21"
r2 = sources / "r2"
v21_images = files(v21, {".png", ".jpg", ".jpeg"})
r2_images = files(r2, {".png", ".jpg", ".jpeg"})
used, records = set(), []

def add(source, category, label):
    if not source or source in used or not source.exists():
        return False
    used.add(source)
    target_dir = out / "screenshots" / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source.name
    if target.exists():
        target = target_dir / (source.parent.name + "__" + source.name)
    shutil.copy2(source, target)
    width = height = None
    if source.suffix.lower() == ".png":
        data = source.read_bytes()[:24]
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            width, height = struct.unpack(">II", data[16:24])
    records.append({"file": str(target.relative_to(out)), "label": label, "width": width, "height": height,
                    "source": str(source.relative_to(root)), "physical_device": False})
    return True

def find_v21(*terms):
    return next((p for p in v21_images if all(t.lower() in p.name.lower() for t in terms)), None)

# Running-app full-screen captures across phone, iPad, and desktop dimensions.
for device, device_label in [
    ("motorola-edge-50-fusion-portrait-emulated", "phone portrait emulation"),
    ("motorola-edge-50-fusion-landscape-emulated", "phone landscape emulation"),
    ("ipad-portrait-834x1194-emulated", "iPad portrait emulation"),
    ("ipad-landscape-1194x834-emulated", "iPad landscape emulation"),
]:
    for layout, menu_prefix in [("hero", "hero-"), ("classic", "")]:
        for group, suffix in [("Music", "02-music-expanded.png"), ("Navigation", "03-navigation-expanded.png")]:
            add(find_v21(device, "__" + layout + "__", menu_prefix + suffix), "magic-star",
                layout.title() + " " + group + " menu — " + device_label + "; full screen")
for group, suffix in [("Music", "hero-02-music-expanded.png"), ("Navigation", "hero-03-navigation-expanded.png")]:
    add(find_v21("desktop-1440x900", "__hero__", suffix), "magic-star",
        "Hero " + group + " menu — desktop landscape 1440×900")

# Star, material, correction and motion close-ups.
for terms, category, label in [
    (("motorola-edge-50-fusion-portrait-emulated", "__hero__", "hero-01-closed"), "magic-star", "Closed glowing star — phone portrait"),
    (("motorola-edge-50-fusion-landscape-emulated", "__hero__", "hero-01-closed"), "magic-star", "Closed glowing star — phone landscape"),
    (("motorola-edge-50-fusion-portrait-emulated", "__hero__", "music-icons-labels-close-up"), "material-closeups", "Music labels and raised wheel material close-up"),
    (("motorola-edge-50-fusion-portrait-emulated", "__hero__", "navigation-icons-labels-close-up"), "material-closeups", "Navigation labels and raised wheel material close-up"),
    (("jump-line-before-close-up"), "jump-line", "Jump extra line before correction"),
    (("jump-line-after-music"), "jump-line", "Jump segment after correction — actual running app"),
    (("motorola-edge-50-fusion-portrait-emulated", "open-frame-025ms"), "animation-frames", "Opening early frame"),
    (("motorola-edge-50-fusion-portrait-emulated", "open-frame-195ms"), "animation-frames", "Opening mid frame"),
    (("motorola-edge-50-fusion-portrait-emulated", "close-frame-110ms"), "animation-frames", "Closing mid frame"),
]:
    add(find_v21(*terms), category, label)

for token, label in [
    ("controls-compact-play-along-playing", "Play Along playing"),
    ("controls-compact-play-along-paused", "Play Along paused"),
    ("controls-compact-sound-on", "Sound enabled"),
    ("controls-compact-sound-off", "Sound muted"),
    ("controls-compact-speed-85-percent", "Speed adjusted"),
    ("controls-compact-zoom-8-keys", "Zoom at 8 keys"),
    ("controls-compact-zoom-16-keys", "Zoom at 16 keys"),
]:
    add(find_v21("motorola-edge-50-fusion-portrait-emulated", "__classic__", token), "playback-controls", label)

# Pick actual Release 2 screenshots by workflow and orientation; missing pairs
# remain explicit in the acceptance report. Fixture-based gallery images are
# identified as fixtures and are not evidence of real OMR accuracy.
r2_groups = [
    ("library", ("selector", "library", "song-selection")),
    ("workshop", ("workshop", "fastpath", "import")),
    ("omr-processing", ("omr", "recognition", "processing")),
    ("correction-review", ("correction", "review")),
    ("arrangements", ("arrangement", "basic", "medium", "advanced")),
    ("magic-bubble", ("bubble", "minimize", "recovery")),
    ("installation-offline", ("install", "progress", "offline")),
    ("saved-song-playback", ("playback", "saved", "hero")),
]
missing = []
for category, words in r2_groups:
    matches = [p for p in r2_images if any(word in str(p).lower() for word in words)]
    for orient in ("portrait", "landscape"):
        match = next((p for p in matches if orient in str(p).lower()), None)
        if match:
            fixture = any(word in str(match).lower() for word in ("fixture", "synthetic", "visual-gallery"))
            add(match, "release2-" + category, category.replace("-", " ").title() + " — " + orient +
                (" — synthetic UI fixture" if fixture else " — workflow capture"))
        else:
            missing.append((category, orient))

# Keep both live Magic Star recordings and at most one import/recovery clip.
for orient in ("portrait", "landscape"):
    clip = next((p for p in files(v21, {".webm", ".mp4"}) if "magic-star-open-close-group-switching-" + orient in p.name), None)
    if clip:
        shutil.copy2(clip, out / "recordings" / clip.name)
        records.append({"file": "recordings/" + clip.name, "label": "Magic Star opening, group switching, and closing — " + orient,
                        "source": str(clip.relative_to(root))})
r2_clip = next((p for p in files(r2, {".webm", ".mp4"}) if any(w in p.name.lower() for w in ("fastpath", "workshop", "import"))), None)
if r2_clip:
    shutil.copy2(r2_clip, out / "recordings" / ("release2-" + r2_clip.name))
    records.append({"file": "recordings/release2-" + r2_clip.name, "label": "Workshop import/recovery workflow recording",
                    "source": str(r2_clip.relative_to(root))})

def runrow(name, data):
    if not data:
        return "| " + name + " | NOT FOUND | No exact-source workflow run located |"
    return "| " + name + " | " + str(data.get("conclusion", "unknown")).upper() + " | [Run " + str(data.get("id")) + "](" + data.get("url", "") + ") |"

matrix = ["# Final V2.1 + Release 2 acceptance matrix", "", "Exact source SHA: " + sha, "",
          "## Exact-source CI", "", "| Workflow | Result | Evidence |", "|---|---|---|"]
matrix.append(runrow("V2.1 Magic Star and compact controls", {"id": v21_id, "url": v21_url, "conclusion": v21_conclusion}))
for key in ("r2", "listen", "explosion"):
    matrix.append(runrow(key, runs.get(key)))
matrix += ["", "## V2.1 requirement groups", "", "| ID | Group | Evidence/status |", "|---|---|---|"]
v21_rows = [
    ("V21-01", "Classic Piano", "Classic portrait/landscape captures; browser regression only."),
    ("V21-02", "Magical Piano Hero", "Hero responsive captures; geometry/render regression evidence."),
    ("V21-03", "Unified Play Along", "Play, pause, resume engine-state assertions and captures."),
    ("V21-04", "Fixed playback toolbar", "Play Along, Sound, Speed and Zoom checks/captures."),
    ("V21-05", "Smart Compact Music Library", "Song selector and music integration checks; physical persistence unverified."),
    ("V21-06", "Floating Magic Star", "Fresh profile, upper-right, drag/reload/orientation checks; wheel clearance remains blocked."),
    ("V21-07", "Magic Star Half-Wheel", "Five actions and materials captured; phone portrait highway overlap threshold fails."),
    ("V21-08", "Music Menu", "Five actions and panel transitions exercised by browser suite."),
    ("V21-09", "Navigation Menu", "Five actions and route/state checks exercised by browser suite."),
    ("V21-10", "Measure Panel", "Selection and responsive interaction checks; see R2 diagnostics."),
    ("V21-11", "Magic Loop Panel", "Loop endpoint and handle assertions."),
    ("V21-12", "Long-Song Loop Timeline", "Synthetic 100/300/1,000 measure fixtures; endpoint preservation checked."),
    ("V21-13", "Jump Panel", "Jump navigation and before/after seam evidence."),
    ("V21-14", "Practice Panel", "Browser control checks; no physical-device validation."),
    ("V21-15", "Make Music Integration", "Workshop path reuses existing import workflow; focused suite passed if R2 is green."),
    ("V21-16", "Unified Navigation", "Existing destinations and menu hierarchy exercised."),
    ("V21-17", "Second-layer 3D Panels", "Existing panel visuals/functions exercised in browser evidence."),
    ("V21-18", "Animations", "Open/close frames and live recordings; reduced-motion check."),
    ("V21-19", "Accessibility", "Names, touch targets, keyboard/focus assertions in Chromium emulation."),
    ("V21-20", "Offline/update", "Installer and service-worker simulation; physical PWA data preservation unverified."),
    ("V21-21", "Responsive acceptance", "Phone, iPad and desktop viewport emulations; not physical devices."),
    ("V21-22", "Regression/release validation", "Exact-source workflow outcomes above; owner visual review remains pending."),
]
matrix += ["| " + " | ".join(row) + " |" for row in v21_rows]
matrix += ["", "## Release 2 requirement groups", "", "| ID | Group | Evidence/status |", "|---|---|---|"]
r2_rows = [
    ("R2-01", "Song Library", "Search/favorite/recent/selector checks and available captures."),
    ("R2-02", "Magic Song Workshop", "Capture/import, recognition workflow, review/save and recovery checks."),
    ("R2-03", "OMR recognition/offline", "Ground-truth engine and offline checks; visual fixture is not accuracy evidence."),
    ("R2-04", "Arrangements", "Only implemented and tested levels are evidenced; unsupported cases are not marked complete."),
    ("R2-05", "Magic Bubble", "Minimize/restore workflow check after overlay stacking correction."),
    ("R2-06", "Installation/update", "Integrity, retry, cached offline reuse, and old-worker update simulation."),
    ("R2-07", "End-to-end saved-song playback", "Integration playback workflow test; physical-device persistence is not verified."),
]
matrix += ["| " + " | ".join(row) + " |" for row in r2_rows]
matrix += ["", "## Responsive evidence gaps", ""]
matrix += ["- Missing Release 2 screenshot pair: " + group.replace("-", " ") + " — " + orient + "." for group, orient in missing]
matrix += ["", "All captures are Chromium/browser emulation unless the source path explicitly says otherwise. No physical phone/tablet test is claimed.",
          "Synthetic OMR review fixtures are not presented as real recognition output. The package preserves failed assertions and geometry diagnostics.",
          "Owner visual approval remains pending; this package does not authorize merge, deploy, publication, or Phase 2."]
(out / "ACCEPTANCE_MATRIX.md").write_text("\n".join(matrix) + "\n", encoding="utf-8")

for base in (v21, r2):
    for p in base.rglob("*"):
        if p.is_file() and any(w in p.name.lower() for w in ("failure", "diagnostic", "test-results", "manifest")) and p.suffix.lower() in {".md", ".json", ".txt"}:
            try:
                shutil.copy2(p, out / "diagnostics" / (base.name + "__" + p.name))
            except Exception:
                pass
(out / "manifest.json").write_text(json.dumps({"source_sha": sha, "v21_run_id": v21_id, "v21_run_url": v21_url, "v21_conclusion": v21_conclusion,
    "other_source_workflows": runs, "physical_device_testing": False, "screenshots": [r for r in records if r["file"].startswith("screenshots/")],
    "recordings": [r for r in records if r["file"].startswith("recordings/")], "missing_release2_pairs": missing}, indent=2), encoding="utf-8")

with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for p in sorted(out.rglob("*")):
        if p.is_file():
            zf.write(p, p.relative_to(out).as_posix())
with zipfile.ZipFile(archive) as zf:
    if zf.testzip():
        raise SystemExit("Evidence ZIP integrity check failed")
    names = zf.namelist()
    if "ACCEPTANCE_MATRIX.md" not in names or "manifest.json" not in names:
        raise SystemExit("Required reports missing")
print("Created", archive.name, "with", len([p for p in (out / "screenshots").rglob("*.png")]), "screenshots and exact SHA", sha)
