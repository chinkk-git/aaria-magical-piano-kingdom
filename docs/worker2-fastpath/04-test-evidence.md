# Regression and evidence plan

The draft PR adds two browser checks:

- A real pinned OMR test runs the same synthetic score against PR base and candidate. It checks exact pitches, measure boundaries, onsets/durations, arrangement output, automatic local save, library playback and scheduler timing. It captures 390×844 portrait processing screenshots and short browser recordings.
- A deterministic fake-worker test injects one page-2 recognition error in a three-page synthetic set. It verifies pre-scan status, bounded recovery, one retry of the affected page, preserved page 1 and page 3 results, balanced correction on page 2, MusicXML retention, local source-image storage, existing songs/favorites, and responsive screenshots at six viewport sizes.

The generated fixtures contain no owner sheet content. Chromium mobile viewport emulation is not physical Android hardware verification.

## Current local results

- `node --check` passed for `song-import.js`, `r2-image.js`, and the new browser harnesses.
- `node --test tests/r2-music.test.js tests/r2-image.test.js tests/r2-integration.test.js tests/pwa-update.test.js`: 4/4 passed.
- `git diff --check`: passed.
- Browser/real-engine tests have not yet run locally because the workspace lacks the Playwright package/browser installation. Draft PR CI is the browser evidence source.
