# Worker 1 Release 2 gap audit

**Audit date:** 2026-11-19  
**Verified main:** `f9739d0071e6e8586e3d9f1b5a049cea9b50534f` (PR #37 merge)  
**Production evidence:** Pages workflow run [#44585961860](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44585961860) completed successfully for this SHA. The live app was opened and showed `App build: aaria-piano-v1.20.3` in Settings.  
**Important:** Chromium inspection is emulated browser evidence. No physical Android/iOS device was tested. Findings are based on current main source and the live production UI; no new code was changed before this audit.

| ID | Current code / observed behavior | Status | Evidence and remaining work |
|---|---|---|---|
| R2-W1-01 | `index.html` Settings contains a fixed `App build: aaria-piano-v1.20.3` string and no Check for Updates control. `r2-install.js` registers the worker and calls `registration.update()` automatically on launch. | **MISSING** | Live Settings confirms no user action. Automatic background checking does not report current/latest build, offer a safe restart, or verify the installed build after restart. Add authoritative build metadata, user-triggered status, safe activation, and upgrade/preservation coverage. |
| R2-W1-02 | `song-import.js` reports actual model-download bytes and receives page checkpoints in `activeJob.completedPages`; it reports stages such as recognition, analysis, arrangement and save. The minimized bubble uses a generic busy label/icon. | **PARTIAL** | Truthful download progress and checkpoint recovery exist. The bubble does not mirror the current measured stage/page count. Tests do not cover the full success/slow/retry/offline/failure/minimize matrix against the real model path. |
| R2-W1-03 | `song-import.js` has a Cancel control that immediately terminates the worker and rejects pending operations. | **DEFECT** | There is no confirmation before cancel. Boundary behavior while a save is already committing and late callback suppression needs targeted coverage. Add confirmation and verify cancel leaves prior songs, favorites, sources and verified OMR cache intact. |
| R2-W1-04 | `index.html` `finishBar()` sets `mode='stop'` at the final measure and says “Song complete. Choose Play Along or Listen.” | **DEFECT** | No distinct COMPLETED state or Play Again action is present in the current playback state model. Add a single restart transition that begins at measure 1 once and respects loop/speed/arrangement/Listen preference. |
| R2-W1-05 | Playback labels and status are assigned across `togglePause()`, `startMode()`, `finishBar()`, and measure navigation. Paused and completed both use `mode='stop'`; `pausedMode` separately tracks pause. | **PARTIAL / DEFECT** | The reported READY/Resume mismatch was not independently reproduced in this audit. The state model does not represent completion separately, so labels and state can diverge. Add tests for start/pause/seek/song switch/completion/restart/rapid input/background. |
| R2-W1-06 | `song-import.js` MusicXML parser maps event positions/durations as `value * 2 / divisions`; bar length is `beats * 8 / beatType` (4/4 → 8 app ticks). It parses MusicXML notes, rests, chords, backup/forward, ties and time signature. | **BLOCKED / UNVERIFIED** | Prior CI evidence reports real pinned Partsong recognition 8/8 on an isolated fixture, including offline, but explicitly did not prove app tick conversion → save → reopen → playback. The fixture's four-tick quarter-note basis differs from this app's eight-tick 4/4 measure basis. Run the actual pinned model through the complete app pipeline against an independent ground truth. Do not claim semantic acceptance until that passes. |
| R2-W1-07 | The repository notice records Partsong and homr-rs pins, model download and on-device recognition. Pinned homr-rs README identifies its code as AGPL-3.0. The model fetch script downloads three ONNX archives from the mutable `onnx_checkpoints` release tag. | **BLOCKED — LEGAL REVIEW REQUIRED** | The exact license/redistribution terms for model weights, training-data provenance, and downstream obligations have not been established by this audit. The source notice's Camera-PrIMuS statement was not confirmed from a primary dataset license. No legal clearance is claimed; see `OMR_LICENSE_PROVENANCE_REVIEW.md`. |
| R2-W1-08 | Existing PR #37 Chromium coverage includes Android-emulated portrait/landscape, iPad-emulated portrait/landscape and desktop responsive checks. `docs/release-2/OWNER-DEVICE-CHECKLIST.md` still says Release 2 is not deployed and describes the old PR #20 artifact. | **PARTIAL** | Physical Android update/data/offline checks are **PENDING**. No physical-device evidence is available. Refresh owner checklist to current production; keep device results pending until owner runs them. |
| R2-W1-09 | Issue #11 body still identifies `bfdc4ccb…` as production, though PR #37 is now on main and the corresponding Pages run succeeded. | **DEFECT (TRACKER STALE)** | Add a dated Control Tower comment with verified main/deploy/build, audit table, draft PRs and pending owner-device/legal checks. Preserve prior issue history; do not replace it. |

## Baseline review notes

- Current `main` includes the PR #37 landscape controls fix. PR #37 merged as `f9739d0071e6e8586e3d9f1b5a049cea9b50534f`; deploy run #44585961860 succeeded.
- Settings in the live page reports `aaria-piano-v1.20.3`; this is the currently served UI string, but the source stores it as a literal rather than discovering the installed worker's build.
- PR #30 (Delete Song) and PR #31 (Note Explosion) remain open drafts. Worker 2's `feature/neon-note-labels` branch has active Actions runs #44589760720, #44589760436 and #44589760281. Worker 1 will keep visual rendering untouched and isolate any necessary Settings markup.
- PRs #20/#23/#28/#33–#37 are historical evidence and must be classified by their merged source and CI, not by stale PR body text or old open drafts.
- The service worker's shell cache is `aaria-piano-v1.20.3`. It removes prior shell caches matching `aaria-piano-vN.N.N` during activation. OMR installer cache is separately named `aaria-piano-r2-install-v1`; local songs use IndexedDB `aaria-piano-library` and a legacy localStorage mirror. No physical-device retention claim is made.

## Next steps

1. Implement Settings update action in a focused draft PR; verify old→new worker, stale metadata, no update, offline/error, safe restart, and app data fixtures.
2. Improve truthful import status and confirmed cancellation in a separate focused draft PR.
3. Fix the playback completed/restart state and label synchronization in a focused draft PR.
4. Execute the real OMR end-to-end semantic acceptance. If CI budget/device limits prevent that, record BLOCKED and provide a repeatable procedure.
5. Keep the model provenance gate BLOCKED until qualified review decides redistribution rights.


## Execution update — 2026-11-19

The audit above records the verified main-branch state before code changes. Draft-only implementation now exists:

| ID | Draft response | Current validation |
|---|---|---|
| R2-W1-01 | [PR #40](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/40) adds Settings update reporting and a user-controlled restart. | Local syntax passed. First CI uncovered stale build-ID expectations (fixed). Real-engine OMR subtest timed out; rerun pending. |
| R2-W1-02/03 | [PR #41](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/41) mirrors stage/page/download status in the minimized bubble and confirms cancellation. | Initial test assertion counted built-in songs; fixed. Updated CI [#44597715880](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44597715880) is in progress. |
| R2-W1-04/05 | [PR #42](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/42) models COMPLETED and Play Again, and synchronizes Pause/Resume labels. | Stacked on #40. Chromium tests and screenshots await CI. |
| R2-W1-06 | No correctness fix is claimed. | BLOCKED / UNVERIFIED: actual-engine app-level semantic path is still not proven; the first 600-second run reported installer idle and `ERR_INVALID_URL`. |
| R2-W1-07 | [Provenance review](OMR_LICENSE_PROVENANCE_REVIEW.md). | LEGAL REVIEW REQUIRED; no distribution clearance claimed. |
| R2-W1-08/09 | [Device checklist](OWNER-DEVICE-CHECKLIST.md); progress comment added to Issue #11. | Physical device is pending. Control Tower final reconciliation awaits current CI and owner review. |

PR #39 and PRs #40–#42 remain drafts; none has been merged or deployed.
