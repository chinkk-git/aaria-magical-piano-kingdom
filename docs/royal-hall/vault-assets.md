# Royal Hall vaulted roof source and placement

Source package: `AARIA_ROYAL_VAULT_ROOF_PR62_PACKAGE.zip` supplied for Issue #59 / PR #62. The five separate SVG assets are copied byte-for-byte into `assets/royal-hall/vault/`; asset 06 is excluded because the layered source files are used separately.

| Layer order | File | Source design size | Runtime role |
|---:|---|---:|---|
| 1 | `02_translucent_ceiling_panels.svg` | 1600 × 900; viewBox `0 0 1600 900` | Purple translucent upper vault |
| 2 | `05_depth_atmosphere.svg` | 1600 × 900; viewBox `0 0 1600 900` | Subtle depth and vignette |
| 3 | `01_vaulted_arch_ribs.svg` | 1600 × 900; viewBox `0 0 1600 900` | Six golden barrel-arch ribs |
| 4 | `03_side_cornice_rails.svg` | 1600 × 900; viewBox `0 0 1600 900` | Perspective side cornices |
| 5 | `04_warm_arch_lights.svg` | 1600 × 900; viewBox `0 0 1600 900` | Warm arch light blooms |

The existing game's measured highway vanishing point is the measured top-center of `#rain`. At runtime, the roof layers share one uniform scale `min(playfield.width/1600, playfield.height/900)` and translate so design-space point `(800,340)` meets that measured point. They are contained by the measured gameplay playfield and rendered at z-index 1, beneath the existing note canvas (z-index 2) and keyboard (z-index 3). No highway or keyboard dimensions are changed to fit the design.

Only the optional Royal Concert Hall preview activates the vault composition. The default stage retains the previous star/disco coordinates and no roof. In Royal Hall preview the existing canvas-drawn starburst and disco ball use the same center at approximately 43% of the measured gameplay-container height; both are painted before note bars, so active notes remain in front.

The app uses the five source SVGs only. The combined overlay (`06_combined_roof_overlay`) is not used, preventing duplicate stacking. This is transparent artwork, not a 3D mesh.
