# Magic Star Phase 1 asset mapping and audit

Status: source audit completed before the correction. Phase 1 remains subject to owner visual approval.

## Source packages inspected

| Package | Source | Inventory |
|---|---|---|
| `AARIA_MAGIC_STAR_HALF_WHEEL_CORRECTED_V2.zip` | Owner-provided Library attachment; extracted to `AARIA_MAGIC_WHEEL_V2/` | 44 files: 19 SVGs, 19 PNGs, 4 Markdown/JSON docs, 2 PNG references. No nested archives. |
| `AARIA_MAGIC_STAR_HALF_WHEEL_DESIGN_PACKAGE.zip` | Owner-provided Library attachment; extracted to `aaria_magic_wheel_package/` | 48 files: 21 SVGs, 21 PNGs, 6 Markdown/JSON docs. No nested archives. |

The complete path inventory is below. SVG and PNG pairs have matching basenames except where a format is absent.

### Corrected V2 package

- Docs: `AARIA_MAGIC_WHEEL_V2/docs/ASSET_MANIFEST.json`, `INTERACTIONS.md`, `README.md`, `RESPONSIVE_AND_QA.md`
- References: `AARIA_MAGIC_WHEEL_V2/references/component_overview.png` (1800×1860 composite), `3d_art_direction_reference.png` (1536×1024; reference image, not guaranteed transparent).
- SVG/PNG assets (SVG and PNG, each supplied at 900×620): `button_close`, `button_jump`, `button_loop`, `button_measure`, `button_minus`, `button_plus`, `button_practice`, `button_star`, `button_zoom_in`, `button_zoom_out`, `half_wheel_jump`, `half_wheel_loop`, `half_wheel_measure`, `half_wheel_none`, `half_wheel_practice`, `panel_jump`, `panel_loop`, `panel_measure`, `panel_practice`.
- The package describes the SVG/PNG as polished layered vector illustrations, not pixel-identical 3D renders or a production UI. Its documentation calls the 3D art-direction PNG a reference only.

### Original design package

- Docs: `aaria_magic_wheel_package/docs/ASSET_MANIFEST.json`, `INTERACTION_EFFECTS.md`, `PRODUCT_SPEC.md`, `README.md`, `RESPONSIVE_LAYOUT.md`, `WORKER_HANDOFF.md`.
- SVG/PNG assets: `button_close`, `button_jump`, `button_loop`, `button_measure`, `button_play`, `button_practice`, `button_sound`, `button_speed`, `button_zoom`, `half_wheel_default`, `half_wheel_jump`, `half_wheel_left_edge`, `half_wheel_loop`, `half_wheel_measure`, `half_wheel_practice`, `loop_handle`, `panel_background`, `star_active`, `star_idle`, `star_pressed`, `wheel_with_loop_panel`.
- Dimensions: action-button PNGs and star PNGs 256×256; half-wheel PNGs 600×600; loop handle 200×200; panel background 800×470; wheel-with-loop composite 650×600. SVGs are editable vector source for these illustrations.
- Wheel artwork has four labeled Music segments (Measure, Loop, Jump, Practice), a central Magic Star hub, and edge-pinned variants. It does not supply a Make Music segment or the five Navigation action illustrations.

## Intended architecture and visual source

The package specifications describe one left/right edge-pinned Magic Star and one inward-opening 180° half-wheel; the star is the wheel hub. The SVG/PNG components are source artwork, not native 3D models. A semantic interaction layer must retain live controls, keyboard/touch support, measured geometry, and the existing playback toolbar.

The corrected package is the primary visual reference. The original package supplies the reusable edge-pinned wheel and star/button layers. The reference images were inspected alongside the SVG/PNG components; they inform the dimensional highlight and material direction, but are not represented as runtime assets.

## Existing PR #53 status at audit time

PR #53 was open and draft at head `b864261f3d9fe3dcd7945521b21d4c0f6f5c787b`.

Before this correction, `v2.1-ui.js` mounted the floating star and expanded wheel as independent fixed-position elements. The expanded shell was a new five-color adapted SVG rather than an adaptation of the supplied four-segment wheel geometry. Action icon images reused supplied button assets, while Navigation actions reused the generic star-button artwork. Labels were separate compact DOM labels. The original wheel’s source geometry, central hub alignment and continuous layered rim were not the runtime shell. The owner screenshots `1000078852.png` and `1000078851.png` show the clipped/disconnected appearance, small detached-looking labels and interference with the playfield.

## Source-to-runtime plan for this correction

| Runtime part | Supplied source | Integration |
|---|---|---|
| Closed and expanded Magic Star hub | `aaria_magic_wheel_package/assets/svg/star_idle.svg` (original source) | Keep one semantic star button at the assembly anchor. The same center remains visible during open/close. |
| Five-segment half-wheel shell | `AARIA_MAGIC_WHEEL_V2/assets/svg/half_wheel_none.svg` plus `aaria_magic_wheel_package/assets/svg/half_wheel_default.svg` geometry/material definitions | Create a documented five-segment derivative that preserves the supplied pivot, semicircle, gold rim, purple/pink/cyan/orange gradient palette, layered stroke and shadow. The derivative is an adaptation, not an original supplied asset. The hub is omitted from the derivative so the live star button remains the single visible center. |
| Music icons | `aaria_magic_wheel_package/assets/svg/button_measure.svg`, `button_loop.svg`, `button_jump.svg`, `button_practice.svg` | Load the supplied raised button art; add live labels and an adapted Make Music action. |
| Navigation icons | Supplied button materials and star/button style above | Newly adapted five icon treatments and live labels; not original supplied action artwork. |
| Make Music action | No dedicated action in either package | Provisional adaptation using the supplied star/button material and live text; route to existing Add New Song flow. |
| Interaction geometry | Supplied wheel pivot and 180° arc | CSS/JS hit targets derive from the shared star center/radius; no separately positioned second wheel. |

The five-action subdivision and all five Navigation action illustrations are provisional, newly adapted elements. The implementation uses zero-cost in-repository SVG/PNG/HTML/CSS only; it adds no external runtime service or paid dependency. SVG is already browser-native, so no paid or external conversion is required.

## Licensing and redistribution

Neither ZIP contains a license file or explicit redistribution terms. The owner supplied these packages and authorized their use in this repository and owner-review evidence for Phase 1. This audit does not grant broader redistribution rights. No third-party artwork or service is introduced.

## Validation of asset use

Runtime evidence will be tied to an exact PR commit: the app loads the adapted shell SVG and source star/button SVGs in-browser, and focused tests assert successful requests and nonzero image dimensions. The source-to-runtime mapping, including all authored derivatives, is maintained in this document and the final evidence package.
