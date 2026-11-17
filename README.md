# Aaria's Magical Piano Kingdom — song package

Standalone installable PWA, hosted independently from Aaria's Magical Kitchen.

## Songs
- **Dalmatian Cradle Song** — existing practice arrangement; its score transcription remains provisional and accompaniment is incomplete.
- **DDLJ** — melody notes supplied by the owner, selectable from the Song dropdown. The supplied piano-note list contains pitches but not durations, rests, or a complete accompaniment. Phrase endings are held to represent sustained notes. The supplied key list omits note-by-note durations and rests, so exact DDLJ rhythm remains provisional; its left-hand accompaniment is not included because the supplied piano score is only a partial advanced arrangement.

## Features
- Interactive piano keyboard with falling notes aligned to keys, sustained note lengths, and R/L hand markers across all songs. Listen playback and Learn key highlights honor each event's duration.
- DDLJ melody notes are marked right hand; its left-hand accompaniment has not been transcribed from the partial score.
- Listen and Learn modes, pause, restart, navigation, adjustable speed, and vertical timeline swipe.
- Photo-to-song workflow: take/choose a score photo, use the linked on-device scanner to export MusicXML, review pitch/hand/timing, then save the song to this browser's local library. Custom songs persist on the current device/browser; the score photo is not uploaded or stored by Piano Kingdom.
- The linked scanner is a separate open-source project. It downloads about 150 MB of recognition models on first use, supports printed staff notation, and documents limits including guitar tablature/drum notation; OMR output requires human review. Its license/model lineage may limit commercial reuse.
- MusicXML imports currently accept piano pitches C3–C6 and keep note lengths, rests, time signatures, tempo, ties, and staff-based R/L mapping when present. Compressed MXL imports and other pitch ranges need a future extension.
- Versioned service-worker offline support.
- Android install prompt and iPhone Safari Add to Home Screen guidance.

## Hosting
GitHub Pages serves the repository root over HTTPS. Application assets and icons are local. No paid services or external APIs are required.

## Device verification
Desktop/browser checks do not replace Android or iPhone hardware testing. Confirm touch alignment, swipe, audio timing, home-screen launch, and offline playback on target phones.
