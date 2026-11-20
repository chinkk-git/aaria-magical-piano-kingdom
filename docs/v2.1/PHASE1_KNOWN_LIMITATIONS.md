# Phase 1 known limitations

- **Geometry is not fully accepted.** Across 35 measured states, the half-wheel bounding region intersected the keyboard in 2 states and the falling-note highway in 23 states. No measured state intersected the fixed playback toolbar. Hero and landscape screenshots visibly show remaining highway overlap.
- **Group switching is not fully stable.** Three Classic viewport runs recorded Magic Star movement while switching groups.
- **Pressed feedback check remains unresolved.** Fourteen pressed samples did not match the test's expected `brightness(1.3)`; the observed computed filter remained at brightness 1.
- The focused Phase 1 workflow is marked failed for diagnostic geometry and interaction findings. GitHub Actions did upload the owner-review ZIP successfully.
- Screenshots use seven Chromium viewport emulations. No physical-device verification is claimed.
- Both source archives contain SVG/PNG artwork, not native 3D model geometry; the original wheel contains four named Music actions.
- The fifth Music segment, Make Music icon, Navigation action art and labels are provisional adaptations documented in the asset map.
- The original package has no explicit license or broad redistribution grant. This implementation is limited to the owner's authorized integration and review.
- The recordings and frame captures are browser-emulated; they do not prove physical-device GPU performance.
- Secondary panels and unrelated Release 2 features are outside this correction.
- Owner approval is pending. Merge, deployment and release are not performed.
- The screenshot harness seeds an isolated local test song and hides the OMR installation gate to render gameplay in the test browser. It does not test OMR installation or change owner-device storage.
