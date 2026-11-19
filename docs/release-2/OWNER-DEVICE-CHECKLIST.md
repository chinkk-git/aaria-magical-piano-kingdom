# Release 2 owner device-testing checklist

**Updated:** 2026-11-19  
**Current production baseline:** `f9739d0071e6e8586e3d9f1b5a049cea9b50534f`, app build `aaria-piano-v1.20.3`. GitHub Pages deploy workflow run [#44585961860](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44585961860) succeeded.  
**Physical-device results:** PENDING. Chromium emulation is not a physical-device result.

## Android installed PWA — owner run

Record device model, Android version, Chrome version, app-installed state, date, result and any error. Use a test song/fixture where practical.

- [ ] Open Settings; record installed build and check for update when Worker 1 PR-A is available.
- [ ] Install/update/reopen without uninstalling or clearing site data; verify the new build after restart.
- [ ] Verify Library, saved-song count, favorites and recent song remain.
- [ ] Check Magical Piano Hero in portrait and landscape: song picker, Zoom Keys, Home, Settings, Speed, Loop and measure selection.
- [ ] Play, pause, resume, complete, use Play Again and verify Listen On/Off preference.
- [ ] Add New Song: camera and gallery selection, preview, Make Music, progress, minimize/restore, cancel confirmation, retry, save once, reopen and playback.
- [ ] After the OMR reader is installed, disable network and verify local recognition/playback if the workflow is cleared for testing.
- [ ] Verify saved songs, favorites, imported score data and verified OMR cache survive app update.
- [ ] Record touch target, focus/status announcement and text-size behavior.

## Automated browser evidence (emulation only)

The PR #37 Release 2 validation run [#44584621784](https://github.com/chinkk-git/aaria-magical-piano-kingdom/actions/runs/44584621784) reports Chromium interaction/responsive coverage at:

- Android portrait 390×844; landscape 844×390 and 915×412.
- iPad portrait 834×1194 and landscape 1194×834.
- Desktop 1440×900.

These are browser-emulated viewports, not physical devices. Worker 1 PRs should attach updated screenshots and label them Chromium emulation.

## Historical V1 review-site instructions

The previous checklist below described PR #20's self-contained review artifact and is retained for history only; its opening status is stale.

Release 2 remains in PR #20 and is not deployed. The PR Actions workflow builds a self-contained review site as an artifact; it does not publish to GitHub Pages.

## Review the built site on MacBook

1. Open PR [#20](https://github.com/chinkk-git/aaria-magical-piano-kingdom/pull/20) and open its latest successful **Release 2 validation** run.
2. Download the `release-2-v1-review-site` artifact and unzip it.
3. In Terminal, run `python3 -m http.server 8000 --directory /path/to/unzipped/site`.
4. Open `http://localhost:8000/` in Chrome or Safari. Keep the page open until the service worker is controlling it. Use the PWA install option if the browser offers it.
5. The artifact includes the pinned OMR runtime and model files. Process the supplied ground-truth exercise once while online/connected to the local server, then disable Wi-Fi and repeat recognition to check offline reuse. The automated workflow independently checks this path.

Stop the local server with Ctrl+C. This review site is temporary; it is not production.

## Real-device matrix

Record device model, OS/browser version, installed/not-installed state, result, and any screenshot or console error.

### Android phone — Chrome, portrait and landscape

- [ ] Load/reload the built review site; install as a PWA if available.
- [ ] Grant camera access; capture a printed page. Also test gallery import, retake, rotate and crop.
- [ ] Run recognition and inspect the result; correct a pitch, onset, duration and hand; add a missed note.
- [ ] Confirm levels only unlock after reviewing every measure and checking the sheet.
- [ ] Save once; force-close/reopen; confirm the song and source photo persist without duplicates.
- [ ] Minimize to Magic Bubble, use the piano, restore the workshop, cancel/retry, then reload and recover.
- [ ] After model setup, disconnect Wi-Fi and repeat recognition; verify Library, playback and saved songs remain available.
- [ ] Check touch targets, screen reader labels, reduced motion, and that the bubble avoids piano controls.
- [ ] Repeat in landscape; note if OS backgrounding or screen lock pauses processing.

### iPhone — Safari, portrait and landscape

- [ ] Open the review site in Safari; test camera permission, gallery import, crop/rotate and retake.
- [ ] Add to Home Screen when available, then repeat Library, recognition, correction, save and playback.
- [ ] After model setup, enable Airplane Mode and repeat recognition and local playback.
- [ ] Minimize/restore/cancel/reload; record any pause when Safari is backgrounded or the screen locks.
- [ ] Check VoiceOver labels, dynamic type, reduced motion, keyboard not required, and touch targets.
- [ ] Repeat both orientations.

### iPad — Safari, portrait and landscape

- [ ] Repeat the iPhone flow in both orientations.
- [ ] Confirm Library and Workshop remain scrollable and controls are not clipped at tablet width.
- [ ] Test split-screen/resizing if normally used; record behavior when Safari suspends a background tab.
- [ ] Check VoiceOver, touch, and reduced-motion behavior.

### MacBook — Chrome and Safari

- [ ] Test desktop-width Library and Workshop, keyboard focus order, visible focus, Escape/close controls, and screen-reader names.
- [ ] Import a score from disk, crop it, correct notes, save once, reopen the saved song, and play in Classic Piano and Magical Piano Hero.
- [ ] Test the artifact site after disconnecting from Wi-Fi once the service worker and local model pack are installed.
- [ ] Test reduced motion and browser zoom at 200%.

## Record results

For each device, mark Pass / Fail / Not available and attach the browser/OS version. Do not interpret a failed device-only check as covered by desktop Chromium. Mobile operating systems may suspend background processing; the app must preserve resumable local work and state this limitation.
