#!/usr/bin/env python3
"""Reconcile owner song backups with the versioned shared song catalogue.

Playback data is copied without transformation. Private OMR diagnostics and
source-image payloads are intentionally excluded from the public catalogue.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from pathlib import Path
from typing import Any

FORMAT = "aaria-piano-song-backup"
CATALOG_FORMAT = "aaria-piano-shared-song-library"
KEEP_FIELDS = (
    "id", "title", "total", "barLengths", "bpm", "events",
    "arrangements", "selectedArrangement", "schemaVersion", "difficulty",
    "keySignature", "timeSignature", "imported", "confidenceStatus", "unavailableArrangements",
    "corrections",
)
MUSICAL_FIELDS = (
    "total", "barLengths", "bpm", "events", "arrangements",
    "selectedArrangement",
)


def normalize_title(title: str) -> str:
    text = unicodedata.normalize("NFKD", title).casefold()
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_score(score: dict[str, Any], label: str) -> None:
    bars, events, total = score.get("barLengths"), score.get("events"), score.get("total")
    if not isinstance(total, int) or isinstance(total, bool) or total < 1:
        raise ValueError(f"{label}: total must be a positive integer")
    if not isinstance(bars, list) or len(bars) != total or any(not _finite_number(n) or n <= 0 for n in bars):
        raise ValueError(f"{label}: barLengths must contain one positive finite length per bar")
    if not isinstance(events, list) or not events:
        raise ValueError(f"{label}: events must be a non-empty list")
    for number, event in enumerate(events, 1):
        if not isinstance(event, dict):
            raise ValueError(f"{label}: event {number} is not an object")
        bar, at, dur, midi = (event.get("bar"), event.get("at"), event.get("dur"), event.get("midi"))
        if not isinstance(bar, int) or isinstance(bar, bool) or not 1 <= bar <= total:
            raise ValueError(f"{label}: event {number} has an invalid bar")
        if not _finite_number(at) or at < 0 or not _finite_number(dur) or dur <= 0:
            raise ValueError(f"{label}: event {number} has invalid timing")
        if not isinstance(midi, int) or isinstance(midi, bool) or not 21 <= midi <= 108:
            raise ValueError(f"{label}: event {number} has an invalid MIDI pitch")
        if "hand" in event and event["hand"] not in ("left", "right"):
            raise ValueError(f"{label}: event {number} has an invalid hand assignment")


def validate_song(song: dict[str, Any]) -> None:
    if not isinstance(song, dict) or not isinstance(song.get("id"), str) or not song["id"].strip() or not isinstance(song.get("title"), str) or not song["title"].strip():
        raise ValueError("each song needs a non-empty string id and title")
    validate_score(song, song["title"])
    arrangements = song.get("arrangements", {})
    if not isinstance(arrangements, dict):
        raise ValueError(f"{song['title']}: arrangements must be an object")
    for name, arrangement in arrangements.items():
        if not isinstance(arrangement, dict):
            raise ValueError(f"{song['title']}: arrangement {name} is not an object")
        validate_score(arrangement, f"{song['title']} / {name}")
    unavailable = song.get("unavailableArrangements", [])
    if not isinstance(unavailable, list) or any(not isinstance(name, str) for name in unavailable):
        raise ValueError(f"{song['title']}: unavailableArrangements must be a string list")


def project_song(song: dict[str, Any]) -> dict[str, Any]:
    return {key: song[key] for key in KEEP_FIELDS if key in song}


def musical_data(song: dict[str, Any]) -> dict[str, Any]:
    return {key: song.get(key, {} if key == "arrangements" else None) for key in MUSICAL_FIELDS}


def musical_fingerprint(song: dict[str, Any]) -> str:
    return json.dumps(musical_data(song), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _load_catalog(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"format": CATALOG_FORMAT, "version": 1, "songs": []}
    catalog = json.loads(path.read_text(encoding="utf-8"))
    if catalog.get("format") != CATALOG_FORMAT or not isinstance(catalog.get("songs"), list):
        raise ValueError("unsupported shared catalog format")
    return catalog


def reconcile_songs(backup: dict[str, Any], catalog: dict[str, Any]) -> tuple[dict[str, Any], dict[str, list[str]]]:
    if backup.get("format") != FORMAT or not isinstance(backup.get("songs"), list):
        raise ValueError("unsupported backup format")
    report: dict[str, list[str]] = {"added": [], "unchanged": [], "metadata_updated": [], "conflicts": []}
    existing = catalog["songs"]

    def detect_duplicates(songs: list[dict[str, Any]], source: str) -> None:
        ids: dict[str, dict[str, Any]] = {}
        titles: dict[str, dict[str, Any]] = {}
        fingerprints: dict[str, dict[str, Any]] = {}
        for song in songs:
            validate_song(song)
            title_key = normalize_title(song["title"])
            fingerprint = musical_fingerprint(song)
            prior_id, prior_title = ids.get(song["id"]), titles.get(title_key)
            prior_music = fingerprints.get(fingerprint)
            if prior_id:
                report["conflicts"].append(f"{source}: duplicate id {song['id']} ({song['title']})")
            if prior_title and prior_title.get("id") != song["id"]:
                report["conflicts"].append(f"{source}: duplicate title {song['title']} and {prior_title['title']}")
            if prior_music and normalize_title(prior_music["title"]) != title_key:
                report["conflicts"].append(f"{source}: identical musical data appears as both {song['title']} and {prior_music['title']}")
            ids[song["id"]] = song
            titles[title_key] = song
            fingerprints[fingerprint] = song

    detect_duplicates(existing, "catalog")
    incoming: list[dict[str, Any]] = []
    incoming_ids: set[str] = set()
    incoming_titles: set[str] = set()
    incoming_fingerprints: dict[str, dict[str, Any]] = {}
    for raw in backup["songs"]:
        validate_song(raw)
        song = project_song(raw)
        title_key = normalize_title(song["title"])
        fingerprint = musical_fingerprint(song)
        prior_music = incoming_fingerprints.get(fingerprint)
        if song["id"] in incoming_ids or title_key in incoming_titles:
            report["conflicts"].append(f"backup: duplicate id or title for {song['title']} ({song['id']})")
        if prior_music and normalize_title(prior_music["title"]) != title_key:
            report["conflicts"].append(f"backup: identical musical data appears as both {song['title']} and {prior_music['title']}")
        incoming_ids.add(song["id"])
        incoming_titles.add(title_key)
        incoming_fingerprints[fingerprint] = song
        incoming.append(song)

    if report["conflicts"]:
        return catalog, report

    by_id = {song["id"]: song for song in existing}
    by_title = {normalize_title(song["title"]): song for song in existing}
    for song in incoming:
        same_id = by_id.get(song["id"])
        same_title = by_title.get(normalize_title(song["title"]))
        same_music = next((item for item in existing if musical_fingerprint(item) == musical_fingerprint(song)), None)
        if same_id and same_title and same_id is not same_title:
            report["conflicts"].append(f"{song['title']}: id and normalized title match different catalogue records")
            continue
        if not same_id and not same_title and same_music:
            report["conflicts"].append(f"{song['title']}: identical musical data already exists as {same_music['title']}; existing entry preserved")
            continue
        match = same_id or same_title
        if match:
            if normalize_title(match["title"]) != normalize_title(song["title"]):
                report["conflicts"].append(f"{song['title']}: stable id {song['id']} is already used by {match['title']}")
                continue
            if musical_data(match) != musical_data(song):
                changed = [key for key in MUSICAL_FIELDS if musical_data(match)[key] != musical_data(song)[key]]
                report["conflicts"].append(f"{song['title']}: existing musical data differs in {', '.join(changed)}; existing entry preserved")
                continue
            changed_metadata = []
            for key in KEEP_FIELDS:
                if key in ("id", "title", "imported") or key in MUSICAL_FIELDS or key not in song:
                    continue
                if key not in match:
                    match[key] = song[key]
                    changed_metadata.append(key)
                elif match[key] != song[key]:
                    report["conflicts"].append(f"{song['title']}: metadata differs in {key}; existing entry preserved")
            if changed_metadata:
                report["metadata_updated"].append(f"{match['title']}: added {', '.join(changed_metadata)}")
            else:
                report["unchanged"].append(match["title"])
            continue
        existing.append(song)
        by_id[song["id"]] = song
        by_title[normalize_title(song["title"])] = song
        report["added"].append(song["title"])

    # Additions are ordered by normalized title for deterministic output.
    initial_count = len(existing) - len(report["added"])
    original = existing[:initial_count]
    additions = sorted(existing[initial_count:], key=lambda item: (normalize_title(item["title"]), item["id"]))
    catalog["songs"] = original + additions
    return catalog, report


def import_songs(backup_path: Path, catalog_path: Path) -> dict[str, Any]:
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    catalog = _load_catalog(catalog_path)
    merged, report = reconcile_songs(backup, catalog)
    if report["conflicts"]:
        raise ValueError("Import conflicts:\n- " + "\n- ".join(report["conflicts"]))
    catalog_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"catalog": merged, **report}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup", type=Path)
    parser.add_argument("catalog", type=Path)
    args = parser.parse_args()
    result = import_songs(args.backup, args.catalog)
    print(f"Added: {', '.join(result['added']) or 'none'}")
    print(f"Unchanged: {', '.join(result['unchanged']) or 'none'}")
    print(f"Metadata updated: {', '.join(result['metadata_updated']) or 'none'}")
    print(f"Catalog now contains {len(result['catalog']['songs'])} song(s).")


if __name__ == "__main__":
    main()
