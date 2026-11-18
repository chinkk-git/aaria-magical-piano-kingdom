# Aaria's Magical Piano Kingdom — song package

Standalone installable PWA, hosted independently from Aaria's Magical Kitchen.

## Songs
- **Dalmatian Cradle Song** — existing practice arrangement; its score transcription remains provisional and accompaniment is incomplete.
- **DDLJ** — melody notes supplied by the owner, selectable from the Song dropdown. The supplied piano-note list contains pitches but not durations, rests, or a complete accompaniment. Phrase endings are held to represent sustained notes. The supplied key list omits note-by-note durations and rests, so exact DDLJ rhythm remains provisional; its left-hand accompaniment is not included because the supplied piano score is only a partial advanced arrangement.

## Features
- Interactive piano keyboard with falling notes aligned to keys, sustained note lengths, and R/L hand markers across all songs. Listen playback and Learn key highlights honor each event's duration.
- DDLJ melody notes are marked right hand; its left-hand accompaniment has not been transcribed from the partial score.
- Listen and Learn modes, pause, restart, navigation, adjustable speed, and vertical timeline swipe.
- Photo-to-song workflow is inside the PWA: take or choose score photos, name the song, and let the on-device OMR reader convert the pages into timed notes, then add it directly to the song picker. There is no external scanner link and no note-review screen. Photos are processed in a browser worker and are never uploaded.
- The first song scan downloads about 158 MB of OMR models from this app's own Pages site; the reader keeps the models in local browser storage for later offline scans. First setup needs Wi-Fi and sufficient device storage.
- The OMR uses the embedded Partsong/homr reader; attribution, source links, and license details are in `OMR-THIRD-PARTY-NOTICES.md`. The recognition can misread notation, so the child flow adds songs automatically and a grown-up can listen afterward. Clear printed scores photographed flat work best; tablature and drum notation are unsupported.
- Imported MusicXML notes retain lengths, rests, tempo, ties, and staff-based right/left hand assignment where present. The current piano keyboard accepts C3–C6; unsupported pitches fail with a simple message rather than silently dropping notes.
- Versioned service-worker support caches the engine for offline use; the model files are cached locally after their first download. GitHub Actions assembles these assets from pinned upstream source at deployment time; the running app loads them only from its own Pages site.
- Android install prompt and iPhone Safari Add to Home Screen guidance.

## Hosting
GitHub Pages serves the app over HTTPS through a GitHub Actions deployment. The complete OMR runtime and model files are bundled into that app; after first setup, recognition works offline. No paid services or photo-upload APIs are used.

## Device verification
Desktop/browser checks do not replace Android or iPhone hardware testing. Confirm touch alignment, swipe, audio timing, home-screen launch, and offline playback on target phones.

## My Songs and data protection
- **My Songs** is available from the piano screen. It combines the two bundled songs with locally saved photo-created songs and provides title search, favorites, recently played, Play, and Practice actions.
- Existing photo-created songs in `aaria-piano-custom-songs-v1` are read without changing their song IDs or event data, then copied additively into IndexedDB. IndexedDB becomes the durable local catalogue for newly saved songs; the legacy localStorage entry is kept as a compatibility mirror where browser quota allows.
- Identical OMR results use a content fingerprint so retries do not add another copy. A matching song already in the library is opened without replacing its title or stored notes.
- **Back up My Songs** exports user-created songs and library marks to a JSON file. **Restore songs** validates the complete backup before adding songs; matching IDs are skipped. The backup stays on the device unless the user chooses to move it. Browser storage can still be cleared by the user, browser settings, or the operating system; keep the exported backup somewhere safe.

## Piano Hero — real keyboard visual guide
- The home experience is being rebuilt around an animated perspective note highway, a purple-and-gold castle scene, the supplied Aaria face-and-hair reference, and a large reference keyboard that follows the current musical passage.
- Follow Along and Practice Together run a silent visual guide for Aaria’s real keyboard. Listen First plays the built-in reference tone. Each mode starts with a visible three-second countdown. The app does not use a microphone or award playing-accuracy scores.
- Magic Zoom changes the reference keyboard window; measure navigation, loop length, and tempo are on the practice dock. The keyboard setup is optional and can remain “I’m not sure”; it explains Middle C as C4 and can record key count and lowest note when known.
- Hand colours can be hidden. A finger number is displayed only if a song record contains a 1–5 finger value explicitly marked verified.
- Current viewport and playback interaction changes are on the development branch only. The approved screenshot remains the design reference; full visual matching, avatar review, mobile hardware checks, and creator interruption recovery still require verification.
