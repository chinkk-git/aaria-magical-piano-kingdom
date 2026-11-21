# Magic Star Phase 1 premium visual asset map

**Review state:** Owner approval pending. The artwork is layered SVG, not a native WebGL or 3D model.

## Source reference and runtime assets

| Runtime element | Source reference | Runtime implementation |
|---|---|---|
| Wheel shape and pivot | `assets/v2.1-magic-wheel/original/half_wheel_default.svg` | `assets/v2.1-magic-wheel/phase1/half-wheel-premium.svg` preserves the supplied 600 × 600 coordinate system, pivot at x=120/y=300, 250-unit outer radius and 88-unit hub radius. The five faces use offset sidewalls, layered amethyst/violet fills, five clipped domed lacquer overlays, elliptical reflections, curved specular bands, dark rolled edges, metallic-gold bevels, directional highlights and contact shadows. The Jump center ray is omitted; only wedge boundaries remain. |
| Closed/open star hub | `assets/v2.1-magic-wheel/original/star_idle.svg` | `assets/v2.1-magic-wheel/phase1/star-button-premium.svg` reuses the supplied circular star composition and purple/gold identity with matching bevel and reflection treatment. The same star button remains at the wheel pivot. |
| Measure, Loop, Jump, Practice symbols | `assets/v2.1-magic-wheel/original/button_measure.svg`, `button_loop.svg`, `button_jump.svg`, `button_practice.svg` | Inline monochrome SVG/text glyphs derived from the supplied symbols. Each live action button now contains its icon and exact title together. |
| Make Music and Navigation symbols | Supplied star/button material references and the established piano/kingdom icon language | Inline SVG or text glyph adaptations for Make Music, My Songs, Home, Piano Mode, Settings and Update App. They are labeled adaptations; they are not presented as owner-supplied assets. |
| Typography | Action names supplied in the project requirements | Ivory-white 10px minimum text with subtle gold/contrast shadow. Longer names wrap inside their segment button. Button `aria-label` preserves the exact action name. |
| Original and rejected visual comparisons | `tests/visual-fixtures/original-art-direction.jpg`, `rejected-portrait.jpg`, `rejected-landscape.jpg` | Review-only fixture images. They are not application runtime assets. |

## Rendering and motion

The wheel uses a source-geometry SVG with independently layered segment faces. Offset dark shells, interior edge strokes and separate beveled rails create visible depth in the rendered SVG; this is not described as native 3D. The SVG surface remains partially translucent to retain neon-note light underneath. A slow 3.6-second gold breathing highlight is visible while open; reduced-motion preferences replace it with a steady glow. Responsive radius is capped by viewport size. The inline action compositions fade in with a small controlled scale as the radial clip reveals around the star. Closing uses a shorter deceleration. Classic and Hero layouts use the same wheel component.

The single fixed playback dock keeps Play Along as the labeled primary action, icon-only accessible Sound and Zoom utilities, and an adjustable Speed slider with a visible percentage. Sound still uses the existing preference and engine handler; Zoom still calls the existing keyboard-framing function. `sw.js` caches the new artwork under shell version `aaria-piano-v2.1.5` so the PWA can render the revised wheel offline after installation/update.

## Scope and evidence limits

No song data, OMR implementation, local song storage, playback engine, or production deployment is changed by this visual correction. The focused screenshot workflow uses a seeded isolated test song and suppresses the first-install gate only in its test browser. The resulting viewport images are Chromium emulations, not physical-device captures. Owner visual approval remains required.
