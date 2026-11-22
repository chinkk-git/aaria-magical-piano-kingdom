from __future__ import annotations
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
royal_zip = root / 'AARIA_ROYAL_HALL_PR62_RESTORATION_SCREENSHOTS.zip'
settings_zip = root / 'AARIA_SONG_SETTINGS_SELECTOR_OWNER_REVIEW.zip'
update_dir = Path(os.environ['PWA_UPDATE_EVIDENCE_DIR'])
out = root / 'AARIA_PIANO_FINAL_RELEASE_EVIDENCE.zip'
required = {
    'android-portrait', 'android-landscape', 'ipad-portrait', 'ipad-landscape'
}
items: list[tuple[str, bytes]] = []
with ZipFile(royal_zip) as archive:
    for name in archive.namelist():
        if name.lower().endswith('.png') and 'screenshots/' in name:
            leaf = Path(name).name
            area = 'magic-star' if leaf.startswith('magic-star-') else 'royal-hall'
            items.append((f'{area}/{leaf}', archive.read(name)))
with ZipFile(settings_zip) as archive:
    for name in archive.namelist():
        if name.lower().endswith('.png') and 'screenshots/' in name:
            items.append((f'song-settings/{Path(name).name}', archive.read(name)))
for file in update_dir.glob('*.png'):
    items.append((f'update-interface/{file.name}', file.read_bytes()))

for area in ('royal-hall', 'magic-star', 'song-settings', 'update-interface'):
    names = [Path(name).name.lower() for name, _ in items if name.startswith(area + '/')]
    missing = [device for device in required if not any(device in name for name in names)]
    if missing:
        raise SystemExit(f'{area} screenshots missing requested device orientations: {missing}')
updates = [name for name, _ in items if name.startswith('update-interface/')]
for device in required:
    for state in ('dot', 'menu'):
        if not any(device in name and state in name for name in updates):
            raise SystemExit(f'update interface screenshot missing: {device} {state}')

sha = os.environ.get('GITHUB_SHA', 'unknown')
readme = f'''# Aaria’s Magical Piano Kingdom — final release evidence\n\nSource: main commit `{sha}`. The four viewports are Android portrait (412×915), Android landscape (915×412), iPad portrait (834×1194), and iPad landscape (1194×834). Screenshots use Playwright Chromium touch emulation at DPR 1, not physical devices.\n\n- `royal-hall/`: original pillar-based Royal Hall, aligned note highway and keyboard.\n- `magic-star/`: expanded Magic Star with the five actions and approved center artwork. The acceptance test also taps the center to verify collapse and the Make Music control to open its wizard.\n- `song-settings/`: opaque Song Settings and integrated arrangement selector captures, including the requested four viewports.\n- `update-interface/`: confirmed update notification dot and Update Version menu in each requested viewport. Update availability is a controlled fixture; app version shown is V2.1.17.\n\nThe ZIP contains the final screenshots and this note only; no nested archives.\n'''
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('README.md', readme)
    for name, data in items:
        archive.writestr(name, data)
with ZipFile(out) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit(f'ZIP CRC failure: {bad}')
    print(f'Created {out.name}: {len(items)} screenshots; {len(archive.namelist())} files; commit {sha}')
