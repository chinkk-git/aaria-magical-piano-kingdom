# Release 2 Worker 1 acceptance status

**Snapshot:** 2026-11-19, main `f9739d0071e6e8586e3d9f1b5a049cea9b50534f`; Pages workflow run [#44585961860](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44585961860) succeeded; live Settings showed build `aaria-piano-v1.20.3`.  
**This is an audit snapshot.** Code PRs and full Release 2 acceptance remain in progress; this is not owner approval.

| Gate | Status | Evidence / remaining action |
|---|---|---|
| R2-W1-01 Settings update action | **FAIL — missing** | Live Settings has a static build label and no Check for Updates button. Implement and test. |
| R2-W1-02 Truthful import progress | **PARTIAL** | Real model bytes and page checkpoints exist; bubble status does not mirror actual stages. Add stage/retry/offline/storage/minimize coverage. |
| R2-W1-03 Safe cancel | **FAIL — missing confirmation** | Cancel immediately terminates worker. Add confirmation and race-safe boundary tests. |
| R2-W1-04 Play Again | **FAIL — missing** | Completion transitions to `stop`; no distinct Play Again action. Implement. |
| R2-W1-05 State/label consistency | **PARTIAL** | No dedicated completed state; reproduction of old READY/Resume report remains unverified. Implement state fixes and test transitions. |
| R2-W1-06 Actual OMR end-to-end | **BLOCKED / NOT TESTED** | Isolated actual-engine 8/8 recognition is recorded in historical CI. Actual parser → app save → reopen → playback semantic comparison has not been evidenced. |
| R2-W1-07 OMR provenance | **BLOCKED — LEGAL REVIEW REQUIRED** | Reader code is AGPL-3.0; model weights/training-data rights and deployment obligations remain unresolved. See provenance review. |
| R2-W1-08 Physical device/offline acceptance | **PENDING** | Chromium responsive test evidence exists. Physical Android/iPhone/iPad/MacBook results are not available; owner-run checklist refreshed separately. |
| R2-W1-09 Control Tower reconciliation | **IN PROGRESS** | Issue #11 body still cites prior production commit. Add dated comment with current facts and draft PRs after implementation. |

## Data-safety boundary

- Existing tests and repository structure identify custom songs in IndexedDB `aaria-piano-library` with a legacy localStorage mirror and separately cached OMR assets under `aaria-piano-r2-install-v1`.
- Current shell cache is `aaria-piano-v1.20.3`; activation removes only prior shell caches matching the shell version pattern. Future code changes must not clear the OMR cache or song/favorite stores.
- Physical-device data retention is **not confirmed**. Use disposable fixtures in automated upgrade tests; do not inspect or export actual user song content.

## Required completion evidence

For each code PR: branch/head SHA, focused CI URL and conclusion, Chromium screenshots at relevant viewports, old-to-new worker upgrade, data-preservation fixtures, rollback note, and draft state. Any failed or unavailable check remains explicitly FAIL/BLOCKED/PENDING. Do not mark Release 2 owner-approved.
