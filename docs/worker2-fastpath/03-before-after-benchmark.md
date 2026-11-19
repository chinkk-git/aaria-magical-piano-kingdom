# Before/after benchmark

## Method

The OMR CI job runs the same generated one-page, eight-note fixture on the PR base and candidate, serially on the same GitHub Actions runner with the same pinned Partsong source revision and Chromium version. The browser viewport is 390×844 with mobile/touch emulation. It records pre-scan time, page-processing time, end-to-end time, page duration when available, and browser heap measurements when Chromium exposes the API.

The pre-existing baseline from Actions run `44622822851` is `12,811 ms` to an automatically saved playable song and `15,714 ms` OMR-to-playback, n=1. It is retained as historical context; the matched PR-base run is the primary comparison because runner conditions can vary.

## Results

Completed matched run: [Actions run 44631401874](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44631401874). Both browser-recovery and matched-OMR jobs passed. Candidate and PR base ran serially on the same hosted runner with the same fixture, engine, model and Chromium setup. This is one sample per side; it does not establish a median or a statistically reliable speedup. The clean path met the provisional ≤5% overhead goal in this single run.

Artifacts (14-day retention): [responsive screenshots and recovery recording](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44631401874/artifacts/14582695780) · [matched OMR screenshots, recording and raw logs](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44631401874/artifacts/14581302867).

| Measure | PR base | Candidate | Sample/notes |
|---|---:|---:|---|
| Pre-scan elapsed | 38 ms | 83 ms | One synthetic page; absolute delta 45 ms |
| OMR page elapsed | 20,957 ms | 21,074 ms | Same pinned model and fixture |
| Processing click to saved song | 24,267 ms | 22,407 ms | Includes local parse and save |
| Browser heap before/after | 10 MB reported | 10 MB reported | `performance.memory`; not a device memory profile |
| First-attempt success | 1/1 | 1/1 | Synthetic fixture only; both produced expected events |
| Recovery success | Not applicable | 1/1 | Injected page-2 fault recovered; pages 1 and 3 each ran once |

Clean-path cost comparison: candidate pre-scan added 45 ms, equal to 0.21% of the matched base's 20,957 ms OMR page time (45 / 20,956.7 × 100). End-to-end was 1,860 ms lower in this run, but treat that difference as observational only because n=1 and hosted-runner timings vary.
