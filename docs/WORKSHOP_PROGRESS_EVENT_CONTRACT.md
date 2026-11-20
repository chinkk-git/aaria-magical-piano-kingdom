# Workshop progress-event contract

PR #44 exposes one progress-event consumer for the Add New Song dialog and minimized Magic Bubble. Worker 2 should report from the main-thread import orchestrator; Worker threads must forward progress messages to their owner because `window` is not available in a worker.

## API

Call `window.AariaWorkshopProgress.report(event)` while an Add New Song attempt is active:

```js
window.AariaWorkshopProgress.report({
  stage: 'recover_page',
  page: { current: 2, total: 4, completed: 1 },
  message: 'Retrying page 2 of 4…'
});
```

The API adds `version: 1`, the active `attemptId`, and a monotonic `sequence`, then dispatches a `CustomEvent` named `aaria-workshop-progress`. The same event listener updates the card, status text, and Magic Bubble. Do not create a separate progress store or update either visual component directly.

## Event payload

| Field | Meaning |
| --- | --- |
| `version` | Contract version; currently `1`. Added by the API. |
| `attemptId` | Stable identifier for one processing attempt. Added by the API. |
| `sequence` | Increasing event number within that attempt. Added by the API. |
| `stage` | One supported stage listed below. |
| `page.current` | 1-based page currently being worked on; use 0 while idle. |
| `page.total` | Total selected pages in this attempt. |
| `page.completed` | Count of pages whose recognition and MusicXML parsing actually succeeded. |
| `message` | Optional short, accurate, child-friendly stage detail. |
| `pageDurationMs` | Optional positive measured duration for a page that has just completed. Send only with a real completion event. |

Supported stages: `check_photos`, `prepare_photos`, `recognize_music`, `recover_page`, `interpret_notes`, `create_arrangement`, `save_song`, `completed`, `needs_attention`, `failed`, `paused`, and `prepare_reader`.

## Progress and ETA rules

The interface intentionally has no caller-supplied percentage. The UI derives determinate page progress only as `floor(page.completed / page.total × 100)`. It rejects page-count regressions within an attempt, ignores stale attempt IDs and out-of-order sequence values, and permits a retry to begin a new attempt using the number of genuinely completed pages.

Unmeasured work uses the animated indeterminate indicator. The UI shows “Estimating time…” until it has at least three measured page durations. A numeric ETA is suppressed when those measurements vary by more than 2.25× or no pages remain. Otherwise the displayed interval uses measured minimum/maximum page duration for the remaining pages; arrangement and save time are not included.

## Integration points

1. Call `report({stage:'check_photos', ...})` and `report({stage:'prepare_photos', ...})` from photo validation/preparation.
2. Report `recognize_music` for the active OMR page and `recover_page` when retrying/recovering a page.
3. Report `interpret_notes` for MusicXML parsing and score analysis, `create_arrangement` for arrangement generation, and `save_song` for library persistence.
4. Increase `page.completed` only after a page has succeeded and its result is accepted by the existing recovery flow. Include its measured duration at that point.
5. Report `completed` only after the song save succeeds. Use `needs_attention` for recoverable save failures and `failed` for processing failures.

Current Worker 1 integration points are `readPhoto()`, the per-page completion loop, `setStage()`, the worker download/retry message handler, `saveDraft()`, and `createSong()` in `song-import.js`. The API does not change the OMR algorithm, photo-processing behavior, model binaries, or IndexedDB schema.
