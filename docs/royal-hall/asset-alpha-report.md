# Royal Concert Hall supplied asset alpha inspection

Source package: `AARIA_ROYAL_CONCERT_HALL_ASSET_PACKAGE_V2.zip`. The supplied originals are copied without destructive editing to `assets/royal-hall/`.

| Asset | Source dimensions | Alpha inspection | Use decision |
|---|---:|---|---|
| `top_valance.png` | 574×156 | RGBA; 36,108 fully transparent pixels, 53,426 partial-alpha pixels, 10 fully opaque pixels | Used in the two top outer wedges only. |
| `left_arch_column.png` | 215×597 | RGBA; zero fully transparent pixels; mostly near-opaque alpha across the crop. It contains wall/curtain background. | Used as a complete side-scene crop, then clipped to the calculated left safe wedge. It is not treated as a transparent cutout. |
| `right_arch_column.png` | 216×597 | RGBA; zero fully transparent pixels; mostly near-opaque alpha across the crop. It contains wall/curtain background. | Used as a complete side-scene crop, then clipped to the calculated right safe wedge. It is not treated as a transparent cutout. |
| `left_wall_sconce.png` | 260×254 | RGBA; 18,345 fully transparent pixels; 47,695 partial-alpha pixels; glow edges are low-alpha. | Used only in wider layouts; clipped to the left safe wedge. |
| `right_wall_sconce.png` | 257×254 | RGBA; 27,034 fully transparent pixels; 38,244 partial-alpha pixels; glow edges are low-alpha. | Used only in wider layouts; clipped to the right safe wedge. |

The columns are not isolated cutouts, so using them as floating transparent foreground art would expose their baked-in rectangular background. Instead, the full crops serve as scenery panels and a separate runtime `clip-path` masks them to the side regions outside the measured projected note lanes, maintaining 24 CSS px of clearance. The original image bytes remain unchanged. The reference image is not included in the app rendering.
