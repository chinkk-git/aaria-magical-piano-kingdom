# Regression and evidence plan

The draft PR adds two browser checks:

- A real pinned OMR test runs the same synthetic score against PR base and candidate. It checks exact pitches, measure boundaries, onsets/durations, arrangement output, automatic local save, library playback and scheduler timing. It captures 390×844 portrait processing screenshots and short browser recordings.
- A deterministic fake-worker test injects one page-2 recognition error in a three-page synthetic set. It verifies pre-scan status, bounded recovery, one retry of the affected page, preserved page 1 and page 3 results, balanced correction on page 2, MusicXML retention, local source-image storage, existing songs/favorites, and responsive screenshots at six viewport sizes.

The generated fixtures contain no owner sheet content. Chromium mobile viewport emulation is not physical Android hardware verification.

## Results

- `node --check` passed for `song-import.js`, `r2-image.js`, and the new browser harnesses.
- `node --test tests/r2-music.test.js tests/r2-image.test.js tests/r2-integration.test.js tests/pwa-update.test.js`: 4/4 passed.
- `git diff --check`: passed.
- Draft PR CI run [44632234547](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44632234547): browser-recovery and matched-OMR jobs passed.
- Recovery acceptance: synthetic local-only three-page score; 4 recognition calls total, attempts `[1, 2, 1]`, retry affected page only, 3 source pages persisted, existing favorites preserved, saved-song count 2→3, 11 progress events observed.
- Matched baseline/candidate real-engine fixture produced the expected eight note events and passed MusicXML parsing, arrangement, local save, Library selection and playback scheduler checks.
- CI captures Chromium screenshots at 390×844, 844×390, 915×412, 834×1194, 1194×834 and 1440×900, plus short recordings. This is viewport emulation, not physical Android testing.
- Evidence artifacts: [recovery screenshots and recording](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44632234547/artifacts/14582881334) and [matched OMR screenshots, recording and logs](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44632234547/artifacts/14582911341).
