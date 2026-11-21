#!/usr/bin/env bash
set -euo pipefail

source_dir="${GITHUB_WORKSPACE}/source-artifact"
outer_zip="${source_dir}/AARIA_V2_1_MAGIC_STAR_COMPACT_CONTROLS_FINAL_OWNER_REVIEW.zip"
inner_zip="${RUNNER_TEMP}/v21-source-evidence.zip"
out_dir="${GITHUB_WORKSPACE}/hero-review-package"
archive="${GITHUB_WORKSPACE}/AARIA_V2_1_HERO_PORTRAIT_LANDSCAPE_REVIEW.zip"
source_root="magic-star-phase1-evidence"

rm -rf "$out_dir" "$archive"
mkdir -p "$out_dir"
unzip -p "$outer_zip" AARIA_V2_1_MAGIC_STAR_COMPACT_CONTROLS_FINAL_OWNER_REVIEW.zip > "$inner_zip"

extract_capture() {
  local source="$1" target="$2"
  unzip -p "$inner_zip" "${source_root}/${source}" > "${out_dir}/${target}"
  test -s "${out_dir}/${target}"
}

extract_capture motorola-edge-50-fusion-portrait-emulated__hero__hero-02-music-expanded.png 01-hero-portrait-music-412x915.png
extract_capture motorola-edge-50-fusion-portrait-emulated__hero__hero-03-navigation-expanded.png 02-hero-portrait-navigation-412x915.png
extract_capture motorola-edge-50-fusion-landscape-emulated__hero__hero-02-music-expanded.png 03-hero-landscape-music-915x412.png
extract_capture motorola-edge-50-fusion-landscape-emulated__hero__hero-03-navigation-expanded.png 04-hero-landscape-navigation-915x412.png
extract_capture magic-star-open-close-group-switching-portrait.webm 05-magic-star-controls-demo-17s.webm

cat > "${out_dir}/06-validation-results.md" <<'REPORT'
# V2.1 Hero visual review

Capture source SHA: `b733737349423b893de9ad2254567bea5b31e711`

- Four full-screen running-app captures: Hero Music and Navigation in portrait (412×915) and landscape (915×412), Chromium phone viewport emulation.
- One 17.56-second running-app WebM: wheel opening/closing, group switching, and compact playback controls.
- Zoom: PASS — verified 12 → 8 → 16 → 12 against engine state and keyboard key count.
- Play Along: PASS — accessible Play/Pause/Resume names and engine transitions verified.
- Sound toggle and preference persistence: PASS. Speed adjustment: PASS.
- Hero wheel alignment/clearance and label checks: PASS; geometry failures 0. Jump ray absence and reduced-motion glow checks passed.
- Classic smoke coverage: shared wheel and controls exercised in Classic; the browser tests used emulated viewports.
- Known diagnostic: one pressed-state style assertion expected exact `brightness(1.3)` and observed computed `brightness(1.29907)` with the expected drop shadow. No app rendering or geometry failure was recorded from that check.
- Physical devices were not tested. Owner visual approval remains pending.
REPORT

for image in "${out_dir}"/*.png; do file "$image"; done
file "${out_dir}/05-magic-star-controls-demo-17s.webm"
zip -q -j "$archive" "${out_dir}"/*
unzip -t "$archive" | tail -1
count="$(unzip -Z1 "$archive" | wc -l | tr -d ' ')"
test "$count" = 6
