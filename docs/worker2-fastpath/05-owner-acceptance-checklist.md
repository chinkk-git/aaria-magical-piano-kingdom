# Owner acceptance checklist

| Requirement | Status | Evidence / follow-up |
|---|---|---|
| Original owner failure root cause | Unconfirmed | No original device logs or score fixture available |
| Local, lightweight photo pre-scan | Implemented | Await browser CI |
| Clean images avoid enhancement | Implemented | Original variant is the default; await real-OMR CI |
| Conservative correction only on flagged validation recovery | Implemented | Await fake-worker retry CI |
| Bounded, error-specific recovery (max 3 attempts/page) | Implemented | Await retry CI |
| Retry affected page only; retain successful page checkpoints | Implemented | Three-page simulated failure test |
| Fingerprinted, versioned, validated checkpoints | Implemented | Resume/recovery browser checks pending |
| MusicXML and complete score validation | Implemented | Real pinned OMR CI pending |
| Worker 1 progress/ETA interface reuse | Integrated | Uses `AariaWorkshopProgress`; no competing UI |
| Existing saved songs, favorites, OMR cache | Protected by implementation | Browser assertions pending; no clear/reset added |
| App-shell update to v1.20.6 | Implemented | PWA update regression CI pending |
| Owner four-page score | Not available | Supply privately for device-specific follow-up; never commit/upload it |
| Android evidence | Pending CI | 390×844 Chromium mobile/touch emulation; physical Android remains unverified |
| Matched before/after benchmark | Pending CI | Same fixture/model/runner on PR base and candidate |
| Draft PR and CI links | Pending | To be reported after push/PR creation |
| Merge or deploy | Not authorized for this task | Remains draft pending owner review |
