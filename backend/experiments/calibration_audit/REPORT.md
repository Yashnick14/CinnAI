# Q1–Q3 calibration audit
No production files or settings changed. Original uploads were matched to saved diagnostics by SHA256; no new inference was substituted.

Capture order confirmed by user:
- Q1: 20261025T144810084570Z_43282029acb14518a3bbd2083bad8fa7.jpg (20:18:10 Asia/Colombo)
- Q2: 20261025T144836160614Z_e0e1152324a349288bf6db4f2dce4e88.jpg (20:18:36)
- Q3: 20261025T145012933701Z_45b2b632ea9e48129141835b60344e4b.jpg (20:20:12)
Q1's stored measurement is 23.7294 mm, not the initially quoted 20 mm.

| Quantity | Q1 | Q2 | Q3 |
|---|---:|---:|---:|
| Manual mm (user supplied) |17|20|23|
| Coin circle diameter px |417.203918|443.021973|422.035034|
| mm/px (26.4 / coin diameter) |0.063278409|0.059590724|0.062554049|
| Final quill width px |375|420|501|
| Final diameter mm |23.729403|25.028104|31.339578|
| Absolute difference mm |6.729403|5.028104|8.339578|
| Central rows, inclusive, zero-based |1374–2221|1298–2244|1316–2275|
| All nonempty rows in band |848|947|960|
| Accepted rows |644|797|784|
| Median before MAD px |374|419|498|
| Median after MAD px |375|420|501|
| Width MAD px |3|4|5|
| Mask bounding-box width px |378|453|553|
| Accepted row width min/max px |367–378|409–429|486–507|
| Coin fitted ellipse minor/major |0.983|0.993|0.960|
| Quill centerline tilt from vertical degrees |0.008|1.382|2.168|

Bounding boxes refer to full-resolution refined-mask extents, not YOLO box metadata. The saved artifacts do not record YOLO box width; production uses row widths, not that box width.
Each Q*-rows.csv contains every candidate row, x endpoints, width and acceptance flag: filter accepted=True for the exact measured set. Overlay magenta lines are sampled central rows for legibility, not the complete accepted-row list.

## Inspection
All three coin contours visually follow the outer coin boundary. All three quill masks largely follow the visible physical silhouette in the measurement band; no large attached shadow extension like the earlier failures is apparent. Small boundary offsets remain possible; this is visual inspection, not hand-labeled edge ground truth.
To explain the manual differences solely by coin under-segmentation, coin diameters would need to be about 582.35, 554.40, 575.06 px instead of 417.20, 443.02, 422.04. Those 25–40% larger circles are inconsistent with the visible current coin outlines.
MAD adds 1, 1, 3 px, only 0.0633, 0.0596, 0.1877 mm. The horizontal-span calculation is behaving as specified. Approximate centerline tilt implies a negligible horizontal-versus-perpendicular width effect (<0.1% for these angles), not a 25–40% error.
Both objects appear supported by the same sheet. However the coin face and elevated quill silhouette are not geometrically the same height. Depth, camera angle, lens distortion and separation across the image can affect local scale. Near-circular coin fits suggest limited tilt at the coin, but do not prove a uniform metric scale at the quill. Camera height/calibration is unavailable, so perspective cannot be quantitatively ruled out.
No ruler, caliper jaws or marked manual location appears in the images. Manual position, direction, method, and whether it measured thickness versus broad projected width are unknown. The quills appear non-circular/flattened in silhouette; a different cross-sectional direction could differ from the photographed breadth, but photos alone cannot establish cross-sectional shape.
Q2 and Q3 taper; a location mismatch can matter. Full bbox width is not being used and so is not the source of the reported central width.

## Conclusions A–F
A: Formula verified. Large coin-boundary underestimation unsupported by visible contours. Local scale mismatch remains possible.
B: No broad mask inflation apparent in these three; small edge errors not ruled out.
C/F: Strongest unresolved hypothesis is manual-versus-image measurement definition/location (different direction or section), NOT a proven cause.
D: Depth/perspective remains a credible secondary hypothesis. No camera pose/depth ground truth.
E: Arithmetic/central-band/MAD verified; filtering explains only a tiny fraction of differences.

No unique causal diagnosis is defensible until manual measurement technique and marked location are supplied. Next controlled capture: mark the central measurement section, measure straight across in the same direction as the photographed width, photograph the caliper/ruler reading, keep camera perpendicular and record camera distance. Do not apply a correction factor.
