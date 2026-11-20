# Magic Star Phase 1 asset mapping

**Approval:** Pending. This is a provisional visual correction. No native 3D renderer or model is claimed.

## Owner packages inspected

- Primary reference: `AARIA_MAGIC_STAR_HALF_WHEEL_CORRECTED_V2.zip`, owner-provided Library attachment. Complete extraction: 44 files (19 SVG, 19 PNG, 4 Markdown/JSON documents, 2 PNG references); no nested archives.
- Original reference: `AARIA_MAGIC_STAR_HALF_WHEEL_DESIGN_PACKAGE.zip`, owner-provided Library attachment. Complete extraction: 48 files (21 SVG, 21 PNG, 6 Markdown/JSON documents); no nested archives.
- Both packages' documentation, SVG/PNG pairs, component overview, and art-direction reference were inspected. The supplied art consists of layered SVG/PNG artwork, not native 3D models.
- Only four Music actions are named in the supplied wheel art. There is no supplied Make Music segment or action-specific artwork for the five Navigation controls.

## Original source to runtime

| Runtime element | Exact source path | Integration |
|---|---|---|
| Closed star / wheel hub | `assets/v2.1-magic-wheel/original/star_idle.svg` | Loaded directly by the single semantic Magic Star button. The button remains at the same center while the wheel is open. |
| Measure | `assets/v2.1-magic-wheel/original/button_measure.svg` | Directly loaded supplied button artwork; live HTML label and accessible button. |
| Loop | `assets/v2.1-magic-wheel/original/button_loop.svg` | Directly loaded supplied button artwork. |
| Jump | `assets/v2.1-magic-wheel/original/button_jump.svg` | Directly loaded supplied button artwork. |
| Practice | `assets/v2.1-magic-wheel/original/button_practice.svg` | Directly loaded supplied button artwork. |
| Five-segment wheel shell | Source: `assets/v2.1-magic-wheel/original/half_wheel_default.svg`; runtime derivative: `assets/v2.1-magic-wheel/phase1/half-wheel-five-action-adapted.svg` | The derivative uses the source's 600×600 coordinate frame, x=120/y=300 star pivot, 250/88 outer/inner radii, gold rim, raised hub proportions, gradient materials and shadows. The 4 supplied segments are adapted to 5. One semantic star remains centered at the supplied pivot. |
| Make Music button base | `assets/v2.1-magic-wheel/corrected/button_star.svg` | Loaded directly below a new music-plus glyph and live “Make Music” label. Existing Add New Song route retained. |
| Navigation button bases | `assets/v2.1-magic-wheel/corrected/button_star.svg` | Loaded directly below newly drawn Home, My Songs, Piano Mode, Settings, and Update App glyphs/labels. |
| Visual comparison references | `tests/visual-fixtures/original-art-direction.jpg`; owner-rejected portrait/landscape review fixtures | Included only in comparison evidence. These are not runtime assets. |

The shell derivative preserves the original source pivot and half-wheel extent. Its radial reveal, action hit targets, icons, labels and the single star button are positioned from the same assembly origin. Right-side placement mirrors around the same source pivot.

## Provisional adaptations

These are newly adapted, not original supplied artwork:

1. The fifth Music segment and its Make Music symbol.
2. The five Navigation glyphs and their labels.
3. The five-action adaptation of the supplied four-segment wheel.
4. Selected-state lighting, responsive positioning and coordinated opening/closing transitions.

The adaptations use supplied source artwork as material foundations. The reports do not describe them as original assets.

## Runtime and conversion evidence

SVG remains browser-native; no conversion service, paid product or additional runtime dependency is required. The focused Chromium test checks successful requests and decoded dimensions for the supplied star, four supplied action buttons, supplied star-button bases and adapted shell at the tested commit.

## License and scope

Neither archive contains an explicit license/redistribution grant. The owner supplied the files and authorized this Phase 1 application integration and review evidence. No broader redistribution rights are asserted. Owner screenshots/reference files are reduced-size review fixtures, not application assets.

No gameplay layout, keyboard geometry, playback implementation, OMR, library, storage, service worker, update workflow or secondary panel design was changed by this wheel correction.
