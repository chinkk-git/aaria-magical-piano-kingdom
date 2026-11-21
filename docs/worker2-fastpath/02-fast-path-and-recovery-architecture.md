# Fast Photo Path and Smart Recovery architecture

## Clean path

1. Photo selection starts a local 512 px thumbnail scan and SHA-256 fingerprint. It measures bounded pixel brightness, contrast, edge energy, staff-row hints, and page-edge risk. The scan is advisory; it does not claim OMR confidence.
2. The original photo remains unchanged in the Workshop record and is sent through the existing layout and recognition flow. A clean scan never triggers contrast or brightness enhancement.
3. Image bitmap and thumbnail canvases are closed after use. Page order and duplicate pages are retained; duplicate detection is a visible hint only.
4. Successful page output is parsed and checked for valid measure structure, ordered note events, playable MIDI range, and valid note times before it is checkpointed.

## Page recovery

- Each validated checkpoint carries the original image SHA-256, pipeline version, pinned Partsong revision, parser version, page index, selected variant, and validation time.
- On resume, a checkpoint is reused only when its source fingerprint and all processing versions match and its structured events pass validation. Legacy/unproven output is archived in the active job record and read again.
- A worker startup failure or timeout allows one worker restart. A deterministic MusicXML/output validation failure may use one mild, contrast-only balanced correction when the pre-scan found dark, low-contrast, or over-bright content. Other errors stop without destructive retries.
- The hard limit is three attempts per page. Only that page is retried. Previously validated pages and original photos remain in the existing Workshop IndexedDB job record.
- Before saving, page MusicXML is retained, page events are combined in order, and the existing score validator checks the complete structured song.

## Worker 1 integration

The implementation is based on the latest available `worker1/magic-music-progress-eta` head (`ea415af976fe1e482f2308920cdea91e9319641b` at integration). It uses `window.AariaWorkshopProgress` and the existing event stages for pre-scan, recognition, recovery, parsing, arrangement, save, completion and failure. Recovery attempt counts and reasons are recorded in the existing Workshop checkpoint and exposed in stage messages. No second progress bar, ETA engine, bubble, IndexedDB store, or schema migration is introduced.

## Privacy and data scope

No localStorage song/favorite keys, song-library records, shared OMR model cache, or existing source-image store are cleared. Workshop checkpoints use the existing `aaria-piano-workshop` IndexedDB object store. The owner-provided score was not present; CI uses generated synthetic score fixtures only.
