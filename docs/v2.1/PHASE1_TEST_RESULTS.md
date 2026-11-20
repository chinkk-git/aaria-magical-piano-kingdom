# Phase 1 focused test results

The existing PR #53 Actions workflow runs the targeted Chromium acceptance suite and only packages the review ZIP after all assertions complete.

Assertions cover:

- One star button and an exact shared star/assembly pivot.
- Five correctly mapped actions in each group.
- Music ↔ Navigation group switching without moving the star.
- 44×44 CSS-pixel targets, circular target separation and label collision checks.
- Viewport, keyboard, toolbar and horizontal overflow geometry.
- Four permanent playback controls: Play/Pause, Sound, Speed and Zoom.
- Loaded source/adapted SVG image dimensions and no failed wheel requests.
- No runtime page errors on exercised wheel interactions.
- Reduced-motion behavior.
- Real-time open/close and switching recordings plus frame captures.

The commit-bound manifest and actual results are written into the ZIP by that workflow. Automated geometry checks do not constitute owner visual approval. Device-size captures are Chromium viewport emulation only.
