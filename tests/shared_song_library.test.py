import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("shared_song_importer", ROOT / "scripts/import_shared_songs.py")
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


def score(song_id="song-a", title="Practice Song"):
    return {
        "id": song_id,
        "title": title,
        "total": 1,
        "barLengths": [4],
        "bpm": 72,
        "events": [
            {"bar": 1, "at": 0, "dur": 1, "midi": 60, "hand": "right", "part": "piano-rh"},
            {"bar": 1, "at": 0, "dur": 2, "midi": 48, "hand": "left", "part": "piano-lh"},
        ],
        "arrangements": {"basic": {
            "total": 1,
            "barLengths": [4],
            "bpm": 72,
            "events": [{"bar": 1, "at": 0, "dur": 1, "midi": 60, "hand": "right"}],
        }},
        "selectedArrangement": "original",
        "corrections": [{"event": 0, "type": "owner-corrected"}],
        "sourceImagesStored": True,
        "omrDiagnostics": {"private": True},
    }


def backup(*songs):
    return {"format": IMPORTER.FORMAT, "version": 1, "songs": list(songs)}


def catalog(*songs):
    return {"format": IMPORTER.CATALOG_FORMAT, "version": 1, "songs": list(songs)}


class SharedSongLibraryTests(unittest.TestCase):
    def test_import_is_repeatable_and_preserves_music_arrangements_and_applicable_metadata(self):
        song = score()
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            backup_path, catalog_path = directory / "backup.json", directory / "catalog.json"
            backup_path.write_text(json.dumps(backup(song)), encoding="utf-8")
            first = IMPORTER.import_songs(backup_path, catalog_path)
            first_bytes = catalog_path.read_bytes()
            second = IMPORTER.import_songs(backup_path, catalog_path)
            self.assertEqual(first["added"], ["Practice Song"])
            self.assertEqual(second["added"], [])
            self.assertEqual(second["unchanged"], ["Practice Song"])
            self.assertEqual(catalog_path.read_bytes(), first_bytes)
            saved = second["catalog"]["songs"][0]
            self.assertEqual(saved["events"], song["events"])
            self.assertEqual(saved["arrangements"], song["arrangements"])
            self.assertEqual(saved["corrections"], song["corrections"])
            self.assertNotIn("sourceImagesStored", saved)
            self.assertNotIn("omrDiagnostics", saved)

    def test_id_or_normalized_title_matches_without_creating_a_duplicate(self):
        current = score("legacy-id", "Practice Song")
        incoming = score("new-id", " practice—song ")
        merged, report = IMPORTER.reconcile_songs(backup(incoming), catalog(current))
        self.assertEqual(len(merged["songs"]), 1)
        self.assertEqual(merged["songs"][0]["id"], "legacy-id")
        self.assertEqual(report["added"], [])
        self.assertEqual(report["unchanged"], ["Practice Song"])

    def test_musical_conflict_is_reported_without_mutating_catalog(self):
        current = score()
        incoming = score()
        incoming["events"][0]["midi"] = 61
        original = json.dumps(catalog(current), sort_keys=True)
        merged, report = IMPORTER.reconcile_songs(backup(incoming), catalog(current))
        self.assertIn("existing musical data differs in events", report["conflicts"][0])
        self.assertEqual(json.dumps(merged, sort_keys=True), original)

    def test_identical_music_with_different_id_and_title_is_detected_as_duplicate(self):
        existing = score("original-id", "Practice Song")
        duplicate = score("new-id", "Completely Different Title")
        merged, report = IMPORTER.reconcile_songs(backup(duplicate), catalog(existing))
        self.assertEqual(len(merged["songs"]), 1)
        self.assertIn("identical musical data already exists as Practice Song", report["conflicts"][0])

    def test_backup_duplicates_and_invalid_scores_are_rejected(self):
        repeated = score()
        _, report = IMPORTER.reconcile_songs(backup(repeated, score("other-id", "PRACTICE---SONG")), catalog())
        self.assertTrue(report["conflicts"])
        invalid = score()
        invalid["events"][0]["midi"] = 109
        with self.assertRaisesRegex(ValueError, "invalid MIDI"):
            IMPORTER.validate_song(invalid)


if __name__ == "__main__":
    unittest.main()
