# OMR license and provenance review

**Review date:** 2026-11-19  
**Status: LEGAL REVIEW REQUIRED — no public redistribution clearance is asserted.**  
This is a factual inventory for owner/qualified review, not legal advice.

## Verified from the application source and primary upstream files

| Component | Verified evidence | What remains unresolved |
|---|---|---|
| Partsong recognizer | App notice pins `pzfreo/partsong` commit [9834842408b3012730b76249e0c3738820a08912](https://github.com/pzfreo/partsong/commit/9834842408b3012730b76249e0c3738820a08912). The pinned repository includes a `LICENSE` blob whose contents are GNU AGPL v3; the same license blob is present in the pinned homr-rs tree. | Confirm exact combined-work obligations for the app's bundled/modified wasm, JS worker and static GitHub Pages distribution with qualified counsel. Confirm required complete source and notices are published alongside the served build. |
| homr-rs reader | App notice pins [homr-rs commit f6309104e3582bae8df22669f0325e7fd1a7ab32](https://github.com/pzfreo/homr-rs/commit/f6309104e3582bae8df22669f0325e7fd1a7ab32). Its pinned [README](https://github.com/pzfreo/homr-rs/blob/f6309104e3582bae8df22669f0325e7fd1a7ab32/README.md) says homr and this port are AGPL-3.0 and labels the port experimental/not yet tested in real use. | Confirm applicable notices/source-offer obligations for this app's deployment and any modifications. |
| ONNX Runtime Web | App notice says files are pinned by SHA-256 in Partsong's `scripts/fetch-libs.sh`. The production deploy workflow runs that script at the pinned Partsong commit. | Inspect and record exact runtime version, file hashes, notices, and deployed files for the current build; confirm app-side notices and source availability. |
| Model weights | At the pinned Partsong commit, `scripts/fetch-models.sh` fetches `segnet_308-3296ccd40960f90ca6ab9c035cca945675d30a0f`, `encoder_pytorch_model_509-2293bba14bfea47d9d28411339362af15fce4c31`, and `decoder_pytorch_model_509-2293bba14bfea47d9d28411339362af15fce4c31` from [homr release tag `onnx_checkpoints`](https://github.com/liebharc/homr/releases/tag/onnx_checkpoints). The release API currently marks that tag mutable. The app notice reports 157,528,486 model bytes. | No separate weights license was found in the fetched release or pinned code declarations. Confirm model copyright/redistribution terms and replace mutable tag references with immutable asset identifiers/checksums in the build. The build-time installer manifest hashes downloaded files but does not establish legal rights. |
| Training data | The app notice says part of the training data (Camera-PrIMuS) is non-commercial. The pinned homr-rs README does not identify the dataset license, and the homr README at the release tag does not substantiate that sentence. | Obtain primary dataset provenance and license for each training source/model checkpoint; identify whether non-commercial restrictions apply to the weights or their redistribution. Do not infer an answer from the app being free. |
| Distribution | `.github/workflows/piano-deploy.yml` checks out Partsong at the pin, runs its library/model fetch scripts and publishes the resulting static site to GitHub Pages. The app notice says recognition runs on-device and photos are not sent to a server. | Verify complete source for exact bundled artifacts, notices, modifications, dependency licensing, and the public network-service analysis required by applicable license terms. |

## Release tag evidence

The `onnx_checkpoints` release is marked mutable by GitHub. At review time its asset list includes zip files for the three model names above, with API-provided SHA-256 digests. Those digests are useful integrity evidence for those archive bytes; they do not identify the legal license or training-data rights. Record the current asset digests in CI/build provenance and avoid relying on mutable names alone.

## Owner / qualified-review decisions needed

1. Confirm whether public GitHub Pages redistribution of the full app, reader, runtime, model weights and their source is permitted under the exact applicable terms.
2. Confirm obligations for source publication, notices and user access for the deployed version.
3. Confirm model weight and training-data provenance/rights, including Camera-PrIMuS.
4. If rights cannot be verified, decide whether distribution must be paused or a separately reviewed alternative is needed. No functionality has been removed by this review.

## Primary sources

- [Pinned Partsong source and license](https://github.com/pzfreo/partsong/tree/9834842408b3012730b76249e0c3738820a08912)
- [Pinned Partsong model fetch script](https://github.com/pzfreo/partsong/blob/9834842408b3012730b76249e0c3738820a08912/scripts/fetch-models.sh)
- [Pinned homr-rs README](https://github.com/pzfreo/homr-rs/blob/f6309104e3582bae8df22669f0325e7fd1a7ab32/README.md)
- [homr ONNX release (mutable tag)](https://github.com/liebharc/homr/releases/tag/onnx_checkpoints)
- [Piano Kingdom deploy workflow](https://github.com/chinkk-git/aaria-magical-piano-kingdom/blob/main/.github/workflows/piano-deploy.yml)
