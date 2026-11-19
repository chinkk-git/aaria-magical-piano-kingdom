# Before/after benchmark

## Method

The OMR CI job runs the same generated one-page, eight-note fixture on the PR base and candidate, serially on the same GitHub Actions runner with the same pinned Partsong source revision and Chromium version. The browser viewport is 390×844 with mobile/touch emulation. It records pre-scan time, page-processing time, end-to-end time, page duration when available, and browser heap measurements when Chromium exposes the API.

The pre-existing baseline from Actions run `44622822851` is `12,811 ms` to an automatically saved playable song and `15,714 ms` OMR-to-playback, n=1. It is retained as historical context; the matched PR-base run is the primary comparison because runner conditions can vary.

## Results

The actual before/after values and CI artifact links will be filled from the first completed draft-PR run. No candidate value is inferred from source code. The acceptance goal of ≤5% median clean-path overhead is provisional and cannot be declared met from a single run; report sample count and runner conditions with every value.

| Measure | PR base | Candidate | Sample/notes |
|---|---:|---:|---|
| Pre-scan elapsed | Pending CI | Pending CI | One synthetic page |
| OMR page elapsed | Pending CI | Pending CI | Same pinned model and fixture |
| Processing click to saved song | Pending CI | Pending CI | Includes local parse and save |
| Browser heap before/after | Pending CI | Pending CI | `performance.memory` availability varies |
| First-attempt success | Pending CI | Pending CI | Synthetic fixture only |
| Recovery success | Not applicable | Pending CI | Deterministic fake-worker page-2 fault test |
