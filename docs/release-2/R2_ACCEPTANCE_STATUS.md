# Release 2 Worker 1 acceptance status

**Snapshot:** 2026-11-19, main `f9739d0071e6e8586e3d9f1b5a049cea9b50534f`; Pages workflow run [#44585961860](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44585961860) succeeded; live Settings showed build `aaria-piano-v1.20.3`.  
**This is an audit snapshot.** Code PRs and full Release 2 acceptance remain in progress; this is not owner approval.

| Gate | Status | Evidence / remaining action |
|---|---|---|
| R2-W1-01 Settings update action | **IN REVIEW — CI PENDING** | Draft PR #40 adds the build display, update action and safe restart. Local syntax checks passed; initial CI found stale build expectations (fixed) and the actual-engine OMR job timed out. Draft regression run [#44599394703](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44599394703) is in progress; Android device test remains pending. |
| R2-W1-02 Truthful import progress | **IN REVIEW — CI PENDING** | Draft PR #41 synchronizes the minimized bubble to existing byte/stage/page status. Existing model-download bytes and page checkpoints remain. Updated Workshop browser run [#44598893902](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44598893902) passed; its artifact includes a minimized progress screenshot. Real-engine and device coverage remain pending. |
| R2-W1-03 Safe cancel | **IN REVIEW — CI PENDING** | Draft PR #41 adds confirmation and a browser case for dismissal, confirmed stop, no partial save and re-entry. Updated validation [#44598893902](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44598893902) passed, including the cancel and no-partial-save regression. Save-boundary and real-device coverage remain pending. |
| R2-W1-04 Play Again | **IN REVIEW — CI PENDING** | Draft PR #42 introduces a distinct completed state and Play Again restart to measure 1; stacked on #40. The first stacked run [#44599167173](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44599167173) used the earlier worker-race test and failed. PR #42 synced to the corrected test; new CI and screenshot artifact are pending. |
| R2-W1-05 State/label consistency | **IN REVIEW — CI PENDING** | Draft PR #42 synchronizes READY/Pause/Resume/completed labels and covers speed, loop, passage, Listen preference and Classic/Hero flows in Chromium. The historical READY/Resume screenshot was not independently available for reproduction. |
| R2-W1-06 Actual OMR end-to-end | **BLOCKED / NOT TESTED** | Isolated actual-engine 8/8 recognition is recorded in historical CI. Actual parser → app save → reopen → playback semantic comparison has not been evidenced. |
| R2-W1-07 OMR provenance | **BLOCKED — LEGAL REVIEW REQUIRED** | Reader code is AGPL-3.0; model weights/training-data rights and deployment obligations remain unresolved. See provenance review. |
| R2-W1-08 Physical device/offline acceptance | **PENDING** | Chromium responsive test evidence exists. Physical Android/iPhone/iPad/MacBook results are not available; owner-run checklist refreshed separately. |
| R2-W1-09 Control Tower reconciliation | **IN PROGRESS** | A dated progress comment with the verified baseline, PR links, CI failures and pending gates was posted to Issue #11 on 2026-11-19. Final closeout remains pending updated CI and all blocked/unverified items. |

## Data-safety boundary

- Existing tests and repository structure identify custom songs in IndexedDB `aaria-piano-library` with a legacy localStorage mirror and separately cached OMR assets under `aaria-piano-r2-install-v1`.
- Current shell cache is `aaria-piano-v1.20.3`; activation removes only prior shell caches matching the shell version pattern. Future code changes must not clear the OMR cache or song/favorite stores.
- Physical-device data retention is **not confirmed**. Use disposable fixtures in automated upgrade tests; do not inspect or export actual user song content.

## Required completion evidence

For each code PR: branch/head SHA, focused CI URL and conclusion, Chromium screenshots at relevant viewports, old-to-new worker upgrade, data-preservation fixtures, rollback note, and draft state. Any failed or unavailable check remains explicitly FAIL/BLOCKED/PENDING. Do not mark Release 2 owner-approved.


## Progress since this snapshot — 2026-11-19

Draft implementation PRs: [#40](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/40) (update action), [#41](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/41) (progress/cancel), and [#42](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/42) (playback state). Checklist and audit updates remain in [PR #39](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/39).

The first update PR CI run [#44594125078](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44594125078) found tests still pinned to the old shell build, and its actual-engine OMR test timed out after 600 seconds with installation state `idle` and browser console `ERR_INVALID_URL`. The old-build expectations have been corrected; OMR semantic acceptance is still **BLOCKED / NOT VERIFIED**. The initial workshop run [#44595003522](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44595003522) found a broad test assertion that counted existing built-in songs; that assertion is narrowed, and updated run [#44597715880](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44597715880) is in progress.

Physical-device checks remain pending. No implementation PR is merged/deployed and Release 2 is not owner-approved.
