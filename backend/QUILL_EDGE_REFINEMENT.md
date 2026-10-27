# Quill edge refinement

The rough Lab mask and existing central-row eligibility checks remain the starting point. Only quill width endpoints are refined. Coin detection, coin size, mapping, RF/YOLO and diameter grade rules are unchanged.

Each rough boundary is searched within 10% of that row's rough width (minimum four pixels). A five-row median Lab profile and mild resolution-relative horizontal Gaussian smoothing suppress pixel noise. The strongest local colour-gradient peak provides a subpixel endpoint. Weak peaks, peaks at the search-window limit, competing peaks and insufficient colour contrast reject the row. Refined widths are checked against neighbouring rows and the overall median/MAD. At least 60% of the previously accepted rough rows, and at least eight rows, must remain. No subtraction, physical reference, or calibration offset enters inference.

The full successful overlay shows rough edges in red, refined endpoints in cyan and accepted width rows in green. Every refinement attempt also saves `.quill-edges.png` beside existing temporary diagnostics, including failed attempts. Orange identifies a located endpoint on a rejected row. Per-row endpoints, rejection reasons, rough width and accepted count are in the `quill_refinement` section of `.coin-diagnostics.json`.

## Replay of the user's approximately 24 mm sample

Source: `20261018T095110236866Z_7531a60107634725a9fe086a49f29d10.jpg` with its original geometry sidecar. SHA-256: `7b8770ec6a77b962c01e099a16e026c571267007d7805bc6991edc7447826a56`.

Old width: 415.0 px. Old diameter: 25.06293956 mm. Reference: approximately 24.0 mm. Absolute error: 1.06293956 mm; percentage error: 4.42891484%.

Refinement rejected this capture: of 377 previously accepted rows, 217 had no clear left transition and 160 had competing left transitions. Zero refined rows remained. Refined width, diameter and error are therefore unavailable; no fallback number or grade is issued. The strong left shadow prevents this capture from validating an improvement in physical accuracy. Synthetic tests verify shadow-margin removal on clear transitions, clean-width preservation, expansion of undersized rough masks, and rejection of ambiguous/noisy measurements.

`scripts/validate_quill_refinement.py IMAGE GEOMETRY --physical-mm 24 --output REPORT.json` reproduces the comparison and retains diagnostic artifacts. The physical value is used only when calculating validation errors, never by measurement.
