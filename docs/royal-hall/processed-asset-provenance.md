# Royal Concert Hall asset provenance

- Source: owner-provided `AARIA_ROYAL_CONCERT_HALL_ASSET_PACKAGE_V2.zip`.
- The reference image is excluded from runtime.
- Runtime artwork consists only of the supplied valance, left/right column crops, and left/right sconces copied byte-for-byte into `assets/royal-hall/`.
- No external image service, paid service, new runtime dependency, or network-hosted art is used.
- The column crops contain baked-in scenery; they are not advertised as transparent cutouts. A non-destructive CSS polygon mask clips each whole crop to the measured safe outer wedge with 24 CSS px of clearance. The mask is recomputed from the actual canvas and key DOM bounds after resize/orientation change.
- `optional_arch_outline.svg` and `manifest.json` are retained with the copied source assets but are not rendered by the app.

## Runtime file verification

SHA-256 and byte counts are for the exact files committed under `assets/royal-hall/`:

| File | Bytes | SHA-256 |
|---|---:|---|
| `left_arch_column.png` | 217421 | `8fcde87f278ec7e9c6e3f31f4d2c8e14116489cf645f2d76bc96c35483c9824b` |
| `left_wall_sconce.png` | 70508 | `50493e1d783bdaf9bb84d320dd58cfbf224b3c7d68cf5d59111f1fdc8497fbd4` |
| `right_arch_column.png` | 223174 | `4b9cc8f96b272de4e3f93f4385b3045d4cf25c777200ecf0774daea647c6093f` |
| `right_wall_sconce.png` | 68242 | `659d9d7ea3b9920326d7f28f035a7023a91d9db635dde6afb7c0a8588bf9c611` |
| `top_valance.png` | 86706 | `de5b6cb6fb0c47df1a601af8d73b631f1f63f43e00dd579008c370898060755c` |

Total runtime image payload: 666051 bytes (about 650.4 KiB, decimal conversion 666051 / 1024).
