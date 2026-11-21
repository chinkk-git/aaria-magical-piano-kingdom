#!/usr/bin/env python3
"""Assemble the GitHub Pages runtime from a reviewed allowlist and pinned OMR build."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts/pages-runtime-assets.txt"


def copy_runtime_assets(site: Path) -> None:
    site.mkdir(parents=True, exist_ok=True)
    for raw in MANIFEST.read_text(encoding="utf-8").splitlines():
        item = raw.strip()
        if not item or item.startswith("#"):
            continue
        source = (ROOT / item).resolve()
        if ROOT not in source.parents and source != ROOT:
            raise ValueError(f"Manifest path escapes repository: {item}")
        if not source.exists():
            raise FileNotFoundError(f"Runtime asset listed in {MANIFEST.relative_to(ROOT)} is missing: {item}")
        destination = site / item
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def copy_omr_assets(site: Path, omr_source: Path) -> None:
    required = [
        (omr_source / "omr-worker.js", site / "omr-worker.js"),
        (omr_source / "omr", site / "omr"),
        (omr_source / "models", site / "models"),
        (omr_source / "lib/onnxruntime-web@1.30.0", site / "lib/onnxruntime-web@1.30.0"),
    ]
    for source, destination in required:
        if not source.exists():
            raise FileNotFoundError(f"Pinned OMR runtime input is missing: {source}")
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    shutil.copy2(ROOT / "OMR-THIRD-PARTY-NOTICES.md", site / "OMR-THIRD-PARTY-NOTICES.md")
    license_source = omr_source / "LICENSE"
    if not license_source.is_file():
        raise FileNotFoundError(f"Pinned OMR license is missing: {license_source}")
    license_target = site / "vendor/omr-licenses/partsong-LICENSE"
    license_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(license_source, license_target)
    (site / ".nojekyll").touch()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=ROOT / "_site")
    parser.add_argument("--omr-source", type=Path, required=True)
    args = parser.parse_args()
    site = args.site.resolve()
    if site.exists():
        shutil.rmtree(site)
    copy_runtime_assets(site)
    copy_omr_assets(site, args.omr_source.resolve())
    subprocess.run(
        [sys.executable, str(ROOT / "scripts/create-r2-install-manifest.py"), "--site", str(site)],
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
