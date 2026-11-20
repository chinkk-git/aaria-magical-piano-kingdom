#!/usr/bin/env python3
"""Merge a piano song backup into the public, bundled song catalog.

Only playback and arrangement fields are copied. Local OMR diagnostics,
source-image metadata, favorites, and recent-use state stay out of the bundle.
Musical event objects and arrangement objects are preserved without edits.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

FORMAT = "aaria-piano-song-backup"
KEEP_FIELDS = (
    "id", "title", "total", "barLengths", "bpm", "events",
    "arrangements", "selectedArrangement", "schemaVersion", "difficulty",
    "keySignature", "timeSignature", "imported",
)


def validate_score(score: dict[str, Any], label: str) -> None:
    bars, events = score.get("barLengths"), score.get("events")
    total = score.get("total")
    if not isinstance(total, int) or total < 1:
        raise ValueError(f"{label}: total must be a positive integer")
    if not isinstance(bars, list) or len(bars) != total or any(not isinstance(n, (int, float)) or n <= 0 for n in bars):
        raise ValueError(f"{label}: barLengths must contain one positive length per bar")
    if not isinstance(events, list) or not events:
        raise ValueError(f"{label}: events must be a non-empty list")
    for number, event in enumerate(events, 1):
        if not isinstance(event, dict):
            raise ValueError(f"{label}: event {number} is not an object")
        bar, at, dur, midi = (event.get("bar"), event.get("at"), event.get("dur"), event.get("midi"))
        if not isinstance(bar, int) or not 1 <= bar <= total:
            raise ValueError(f"{label}: event {number} has an invalid bar")
        if not isinstance(at, (int, float)) or at < 0 or not isinstance(dur, (int, float)) or dur <= 0:
            raise ValueError(f"{label}: event {number} has invalid timing")
        if not isinstance(midi, int) or not 21 <= midi <= 108:
            raise ValueError(f"{label}: event {number} has an invalid MIDI pitch")


def validate_song(song: dict[str, Any]) -> None:
    if not isinstance(song, dict) or not isinstance(song.get("id"), str) or not isinstance(song.get("title"), str):
        raise ValueError("each song needs a string id and title")
    validate_score(song, song["title"])
    arrangements = song.get("arrangements", {})
    if not isinstance(arrangements, dict):
        raise ValueError(f"{song['title']}: arrangements must be an object")
    for name, arrangement in arrangements.items():
        if not isinstance(arrangement, dict):
            raise ValueError(f"{song['title']}: arrangement {name} is not an object")
        validate_score(arrangement, f"{song['title']} / {name}")


def import_songs(backup_path: Path, catalog_path: Path) -> dict[str, Any]:
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    if backup.get("format") != FORMAT or not isinstance(backup.get("songs"), list):
        raise ValueError("unsupported backup format")
    incoming: dict[str, dict[str, Any]] = {}
    for song in backup["songs"]:
        validate_song(song)
        record = {key: song[key] for key in KEEP_FIELDS if key in song}
        if record["id"] in incoming:
            raise ValueError(f"duplicate song id in backup: {record['id']}")
        incoming[record["id"]] = record

    catalog = {"format": "aaria-piano-shared-song-library", "version": 1, "songs": []}
    if catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        if catalog.get("format") != "aaria-piano-shared-song-library" or not isinstance(catalog.get("songs"), list):
            raise ValueError("unsupported shared catalog format")
    existing = {song["id"]: song for song in catalog["songs"]}
    for song_id, song in incoming.items():
        existing[song_id] = song
    titles: set[str] = set()
    for song in existing.values():
        validate_song(song)
        title = song["title"].casefold()
        if title in titles:
            raise ValueError(f"duplicate song title: {song['title']}")
        titles.add(title)
    catalog["songs"] = list(existing.values())
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return catalog


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup", type=Path)
    parser.add_argument("catalog", type=Path)
    args = parser.parse_args()
    catalog = import_songs(args.backup, args.catalog)
    print(f"Validated and merged {len(catalog['songs'])} song(s) into {args.catalog}")
    for song in catalog["songs"]:
        arrangement_names = sorted(song.get("arrangements", {}))
        print(f"{song['title']}: {len(song['events'])} events; {len(arrangement_names)} arrangement(s)")


if __name__ == "__main__":
    main()
