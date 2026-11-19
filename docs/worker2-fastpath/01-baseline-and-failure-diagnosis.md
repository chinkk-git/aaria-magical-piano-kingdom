# Fast Photo Path — baseline and failure diagnosis

**Status:** implementation and matched CI measurements pending on the draft PR branch.
**Fixture privacy:** no owner sheet images were found in the supplied package or the available workspace. Only the repository's synthetic score fixture is used in public CI.

## What can be confirmed

The earlier PR #44 Actions run (`44622822851`) exercised the pinned local OMR engine against a synthetic one-page, eight-note score and reported `recognitionElapsedMs=12811` before saving the playable song; the full OMR-to-playback path reported `15714 ms`. This was one hosted Linux/Chromium run (n=1), not an Android-device benchmark and not a median. Run: <https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44622822851>.

The original owner-reported first-attempt failure cannot be attributed to a specific device, image, model, parser, storage or worker error from the evidence available here. No owner capture, browser log, worker trace, or four-page score was available. The cause remains **unconfirmed**.

## Reproduced code-path gaps

- A lightweight pixel inspection helper existed, but photo selection did not run it before starting OMR.
- Recognition errors had no bounded, error-specific automatic retry path.
- Page results were saved in the Workshop's existing IndexedDB job record, but had no source-image hash or model/parser/pipeline provenance to prove that a resumed result matched its input and current processing versions.
- The importer already processed pages in sequence; recovery did not isolate a failed page while retaining verifiably successful pages.
- Parsing produced structured events, but there was no explicit page-level score validation before accepting a checkpoint.

These are verified implementation gaps. They do not prove which one caused the owner's original failure.
