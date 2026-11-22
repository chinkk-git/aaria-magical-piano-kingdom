#!/usr/bin/env python3
"""Fail closed when the generated GitHub Pages artifact omits a runtime dependency."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlparse, unquote


BASE = "https://chinkk-git.github.io/aaria-magical-piano-kingdom/"
REQUIRED = (
    "v2.1-ui.js", "v2.1-ui.css", "pwa-update.js", "shared-song-loader.js", "shared-song-library.json",
    "omr-worker.js", "royal-hall.css", "royal-hall.js", "royal-vault.css", "royal-vault.js",
    "assets/royal-hall/top_valance.png", "assets/royal-hall/left_arch_column.png",
    "assets/royal-hall/right_arch_column.png", "assets/royal-hall/left_wall_sconce.png",
    "assets/royal-hall/right_wall_sconce.png", "assets/royal-hall/royal_concert_hall_complete_1672x941.png", "assets/royal-hall/vault/01_vaulted_arch_ribs.svg", "assets/royal-hall/vault/02_translucent_ceiling_panels.svg",
    "assets/royal-hall/vault/03_side_cornice_rails.svg", "assets/royal-hall/vault/04_warm_arch_lights.svg",
    "assets/royal-hall/vault/05_depth_atmosphere.svg", "assets/v2.1-magic-wheel/corrected/panel_measure.svg",
    "assets/v2.1-magic-wheel/corrected/panel_loop.svg",
    "assets/v2.1-magic-wheel/corrected/panel_jump.svg",
    "assets/v2.1-magic-wheel/corrected/panel_practice.svg",
    "assets/v2.1-magic-wheel/half_wheel_none.svg",
    "assets/v2.1-magic-wheel/half_wheel_measure.svg",
    "assets/v2.1-magic-wheel/half_wheel_loop.svg",
    "assets/v2.1-magic-wheel/half_wheel_jump.svg",
    "assets/v2.1-magic-wheel/half_wheel_practice.svg",
)
EXPECTED_SONGS = (
    "Dalmatian Cradle Song", "DDLJ", "Golden", "Faith of Ophelia",
    "Flowers - Miley Sirus", "Beautiful things - Benson Boone",
)


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []
        self.styles: list[str] = []
        self.in_style = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        attr = "href" if tag == "link" else "src"
        if tag in ("script", "link", "img", "source") and values.get(attr):
            self.refs.append((values[attr] or "", f"index.html {tag}[{attr}]"))
        if values.get("srcset"):
            for candidate in (values["srcset"] or "").split(","):
                target = candidate.strip().split()[0] if candidate.strip() else ""
                if target:
                    self.refs.append((target, "index.html srcset"))
        if values.get("style"):
            self.styles.append(values["style"] or "")
        if tag == "style":
            self.in_style = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self.in_style = False

    def handle_data(self, data: str) -> None:
        if self.in_style:
            self.styles.append(data)


def css_urls(css: str) -> list[str]:
    return [(m.group(1) or m.group(2)).strip() for m in
            re.finditer(r"url\(\s*(?:['\"]([^'\"]+)['\"]|([^)]*?))\s*\)", css, re.I)
            if (m.group(1) or m.group(2)).strip()]


def check_ref(site: Path, ref: str, source: str, errors: list[str]) -> None:
    ref = ref.strip()
    if not ref or ref.startswith(("data:", "blob:", "#", "javascript:", "mailto:")):
        return
    resolved = urlparse(urljoin(BASE, ref))
    base = urlparse(BASE)
    if resolved.scheme not in ("https", "http") or resolved.netloc != base.netloc or not resolved.path.startswith(base.path):
        # External libraries are not part of the local Pages package.
        if resolved.netloc != base.netloc:
            return
        errors.append(f"{source}: URL escapes the GitHub Pages repository prefix: {ref}")
        return
    relative = unquote(resolved.path[len(base.path):])
    safe = PurePosixPath(relative)
    if ".." in safe.parts:
        errors.append(f"{source}: path traversal in local URL: {ref}")
        return
    target = site.joinpath(*safe.parts)
    if not relative or relative.endswith("/"):
        target = target / "index.html"
    if not target.is_file() or target.stat().st_size == 0:
        errors.append(f"{source}: missing or empty local asset {relative or 'index.html'} (from {ref})")


def verify(site: Path) -> list[str]:
    errors: list[str] = []
    for required in REQUIRED:
        path = site / required
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"required runtime asset missing or empty: {required}")
    index = site / "index.html"
    sw = site / "sw.js"
    if not index.is_file() or not sw.is_file():
        return errors

    parser = RefParser()
    parser.feed(index.read_text(encoding="utf-8"))
    refs = parser.refs[:]
    for style in parser.styles:
        refs.extend((url, "index.html inline CSS") for url in css_urls(style))

    for css_file in site.rglob("*.css"):
        css_text = css_file.read_text(encoding="utf-8", errors="replace")
        refs.extend((url, f"{css_file.relative_to(site)} CSS url()") for url in css_urls(css_text))
        for imported in re.findall(r"@import\s+(?:url\()?\s*['\"]([^'\"]+)['\"]", css_text, re.I):
            refs.append((imported, f"{css_file.relative_to(site)} @import"))

    for ref, source in refs:
        check_ref(site, ref, source, errors)

    sw_text = sw.read_text(encoding="utf-8")
    update_script = site / "pwa-update.js"
    if update_script.is_file():
        cache_build = re.search(r"const\s+CACHE\s*=\s*['\"](aaria-piano-v\d+\.\d+\.\d+)['\"]", sw_text)
        app_build = re.search(r"const\s+APP_BUILD\s*=\s*['\"](aaria-piano-v\d+\.\d+\.\d+)['\"]", update_script.read_text(encoding="utf-8"))
        if not cache_build or not app_build or cache_build.group(1) != app_build.group(1):
            errors.append("V2.1 build version mismatch between sw.js and pwa-update.js")
    match = re.search(r"const\s+ASSETS\s*=\s*\[(.*?)\]\s*;", sw_text, re.S)
    if not match:
        errors.append("sw.js: cannot parse the precache ASSETS manifest")
    else:
        assets = re.findall(r"['\"]([^'\"]+)['\"]", match.group(1))
        if not assets:
            errors.append("sw.js: precache ASSETS manifest is empty")
        for asset in assets:
            check_ref(site, asset, "sw.js precache", errors)

    install_manifest = site / "release2-install-manifest.json"
    try:
        manifest = json.loads(install_manifest.read_text(encoding="utf-8"))
        files = manifest["files"]
        if not files:
            errors.append("release2-install-manifest.json: OMR installation manifest is empty")
        for entry in files:
            asset = str(entry["path"])
            check_ref(site, asset, "release2-install-manifest.json", errors)
            target = site / unquote(urlparse(urljoin(BASE, asset)).path[len(urlparse(BASE).path):])
            if target.is_file():
                content = target.read_bytes()
                if len(content) != entry.get("bytes") or hashlib.sha256(content).hexdigest() != entry.get("sha256"):
                    errors.append(f"release2-install-manifest.json: size or SHA-256 mismatch for {asset}")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"release2-install-manifest.json: invalid OMR installation manifest ({exc})")

    try:
        catalogue = json.loads((site / "shared-song-library.json").read_text(encoding="utf-8"))
        songs = catalogue["songs"]
        titles = {" ".join(str(song.get("title", "")).replace("–", "-").split()).casefold() for song in songs}
        for expected in EXPECTED_SONGS:
            if " ".join(expected.replace("–", "-").split()).casefold() not in titles:
                errors.append(f"shared-song-library.json: missing required song {expected!r}")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(f"shared-song-library.json: invalid catalogue ({exc})")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=Path("_site"))
    args = parser.parse_args()
    site = args.site.resolve()
    if not site.is_dir():
        print(f"FAIL: deployable directory does not exist: {site}", file=sys.stderr)
        return 1
    errors = verify(site)
    if errors:
        print("Pages artifact integrity FAILED:")
        for error in errors:
            print(f" - {error}")
        return 1
    print(f"Pages artifact integrity PASS: HTML, CSS, service-worker precache, V2.1 panels, OMR entry points, six-song catalogue, and Pages prefix ({BASE})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
