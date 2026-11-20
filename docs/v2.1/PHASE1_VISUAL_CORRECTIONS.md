# Phase 1 visual corrections

**Current status: owner visual approval pending.** The prior wheel version was rejected; its screenshots are labeled accordingly and are not treated as acceptance evidence.

| Rejected defect | Phase 1 correction |
|---|---|
| Flat colored shell | Rebuilt the wheel derivative from the supplied original half-wheel source pivot, radii, raised hub proportions, layered gold rim, dimensional gradients and shadow. Direct supplied star/action SVGs remain in the running application. |
| Tiny detached labels | Added full, live action labels adjacent to each segment's supplied/adapted icon; responsive type, contrast and bounds checks. |
| Wheel separate from the star | Wheel, labels, action controls and one star button now live in a single `.v21-star-assembly`. |
| Wheel opens elsewhere | Source pivot x=120/y=300 maps to the star button center and to the shell reveal origin. The same coordinate system is retained on both screen edges and during group switching. |
| Icons do not match | Four original action icons are loaded directly. The missing Make Music and Navigation visuals use the supplied star-button SVG underneath provisional glyphs and labels. |
| Gameplay obstruction | Compute one edge anchor and wheel radius against the visible viewport, keyboard top and fixed toolbar. Automated checks assert the wheel remains above the keyboard and toolbar. |
| Weak responsive positioning | Recompute the one assembly together for viewport changes, safe insets and mirrored sides; no separate open-state wheel coordinates. |
| Abrupt animation | Open reveals from the hub over 390ms with a restrained ease-out and no bounce; close retracts over 285ms; group labels crossfade over 165ms. Reduced motion uses 1ms transitions. |

The app's existing action handlers are preserved. This Phase 1 change does not redesign Magic Loop, Measure, Jump, Practice panels, piano gameplay or Release 2 features.
