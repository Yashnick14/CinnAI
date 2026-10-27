"""Training-era visual preprocessing, copied verbatim from FYP.ipynb.

Authoritative cells (one-based): 91 (mask/colour/surface), 92 (aggregation).
Do not substitute the revised functions in cell 122.
Notebook SHA256: 9baf88d7d246f5f42eb93c64b971c31f5596e46b5718790ed1520b690828547a
"""
import cv2
import numpy as np

colour_feature_names = [
    "hue_circular_mean",
    "sat_mean",
    "value_mean",
    "hue_median",
    "sat_median",
    "value_median",
    "lab_l_mean",
    "lab_a_mean",
    "lab_b_mean",
    "lab_l_median",
    "lab_a_median",
    "lab_b_median",
    "foreground_ratio"
]

surface_feature_names = [
    "intensity_mean",
    "intensity_std",
    "intensity_median",
    "edge_density",
    "local_contrast",
    "dark_anomaly_ratio",
    "surface_entropy",
    "laplacian_variance"
]

all_feature_names = (
    colour_feature_names
    + surface_feature_names
)

def create_quill_mask_v2(image, box, padding=0.15):

    x1, y1, x2, y2 = map(int, box)

    img_h, img_w = image.shape[:2]

    box_w = x2 - x1
    box_h = y2 - y1

    pad_x = int(box_w * padding)
    pad_y = int(box_h * padding)

    # Expanded crop
    ex1 = max(0, x1 - pad_x)
    ey1 = max(0, y1 - pad_y)
    ex2 = min(img_w, x2 + pad_x)
    ey2 = min(img_h, y2 + pad_y)

    crop = image[ey1:ey2, ex1:ex2].copy()

    if crop.size == 0:
        return None, None

    # Smooth image slightly
    blurred = cv2.GaussianBlur(
        crop,
        (5, 5),
        0
    )

    # Convert to LAB
    lab = cv2.cvtColor(
        blurred,
        cv2.COLOR_BGR2LAB
    ).astype(np.float32)

    h, w = lab.shape[:2]

    # Use approximately 8% of image border
    # to estimate background colour
    border_size = max(
        1,
        int(min(h, w) * 0.08)
    )

    top = lab[:border_size, :, :].reshape(-1, 3)
    bottom = lab[-border_size:, :, :].reshape(-1, 3)
    left = lab[:, :border_size, :].reshape(-1, 3)
    right = lab[:, -border_size:, :].reshape(-1, 3)

    border_pixels = np.vstack(
        [top, bottom, left, right]
    )

    # Median border colour = estimated background
    background_colour = np.median(
        border_pixels,
        axis=0
    )

    # Difference between each pixel and background
    colour_distance = np.linalg.norm(
        lab - background_colour,
        axis=2
    )

    distance_normalized = cv2.normalize(
        colour_distance,
        None,
        0,
        255,
        cv2.NORM_MINMAX
    ).astype(np.uint8)

    # Automatic thresholding
    _, mask = cv2.threshold(
        distance_normalized,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )

    # Clean the mask
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (5, 5)
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1
    )

    # Find candidate foreground contours
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return (
            crop,
            np.zeros(
                crop.shape[:2],
                dtype=np.uint8
            )
        )

    # YOLO object centre relative to expanded crop
    target_x = ((x1 + x2) / 2) - ex1
    target_y = ((y1 + y2) / 2) - ey1

    best_contour = None
    best_score = -1

    for contour in contours:

        area = cv2.contourArea(contour)

        if area <= 0:
            continue

        moments = cv2.moments(contour)

        if moments["m00"] == 0:
            continue

        cx = moments["m10"] / moments["m00"]
        cy = moments["m01"] / moments["m00"]

        distance = np.sqrt(
            (cx - target_x) ** 2
            +
            (cy - target_y) ** 2
        )

        # Prefer large contours close to
        # the centre of the YOLO detection
        score = area / (1 + distance)

        if score > best_score:
            best_score = score
            best_contour = contour

    final_mask = np.zeros(
        crop.shape[:2],
        dtype=np.uint8
    )

    if best_contour is not None:

        cv2.drawContours(
            final_mask,
            [best_contour],
            -1,
            255,
            thickness=cv2.FILLED
        )

    return crop, final_mask


def extract_colour_features(crop, mask):

    # Slightly erode mask to avoid
    # background pixels at object edge
    kernel = np.ones(
        (3, 3),
        np.uint8
    )

    colour_mask = cv2.erode(
        mask,
        kernel,
        iterations=1
    )

    hsv = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2HSV
    )

    lab = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2LAB
    )

    hsv_pixels = hsv[
        colour_mask > 0
    ]

    lab_pixels = lab[
        colour_mask > 0
    ]

    if len(hsv_pixels) == 0:
        return None

    # --------------------------------------------------------
    # Circular hue mean
    # --------------------------------------------------------
    # OpenCV hue range = 0 to 179.
    # Hue is circular, therefore an ordinary arithmetic
    # mean can be misleading around the 0/179 boundary.

    hue = hsv_pixels[:, 0].astype(float)

    saturation = (
        hsv_pixels[:, 1]
        .astype(float)
    )

    # Convert OpenCV hue into radians
    angles = (
        hue
        * (2 * np.pi / 180.0)
    )

    # Give low-saturation pixels less influence
    weights = saturation / 255.0

    weight_sum = np.sum(weights) + 1e-8

    sin_mean = (
        np.sum(
            np.sin(angles) * weights
        )
        / weight_sum
    )

    cos_mean = (
        np.sum(
            np.cos(angles) * weights
        )
        / weight_sum
    )

    mean_angle = np.arctan2(
        sin_mean,
        cos_mean
    )

    if mean_angle < 0:
        mean_angle += 2 * np.pi

    hue_circular_mean = (
        mean_angle
        * 180.0
        / (2 * np.pi)
    )

    # --------------------------------------------------------
    # Return colour features
    # --------------------------------------------------------

    return {

        "hue_circular_mean":
            float(hue_circular_mean),

        "sat_mean":
            float(
                np.mean(
                    hsv_pixels[:, 1]
                )
            ),

        "value_mean":
            float(
                np.mean(
                    hsv_pixels[:, 2]
                )
            ),

        "hue_median":
            float(
                np.median(
                    hsv_pixels[:, 0]
                )
            ),

        "sat_median":
            float(
                np.median(
                    hsv_pixels[:, 1]
                )
            ),

        "value_median":
            float(
                np.median(
                    hsv_pixels[:, 2]
                )
            ),

        "lab_l_mean":
            float(
                np.mean(
                    lab_pixels[:, 0]
                )
            ),

        "lab_a_mean":
            float(
                np.mean(
                    lab_pixels[:, 1]
                )
            ),

        "lab_b_mean":
            float(
                np.mean(
                    lab_pixels[:, 2]
                )
            ),

        "lab_l_median":
            float(
                np.median(
                    lab_pixels[:, 0]
                )
            ),

        "lab_a_median":
            float(
                np.median(
                    lab_pixels[:, 1]
                )
            ),

        "lab_b_median":
            float(
                np.median(
                    lab_pixels[:, 2]
                )
            ),

        "foreground_ratio":
            float(
                np.count_nonzero(
                    colour_mask
                )
                / colour_mask.size
            )
    }


def extract_surface_features(crop, mask):

    # Remove a small boundary region
    kernel = np.ones(
        (3, 3),
        np.uint8
    )

    surface_mask = cv2.erode(
        mask,
        kernel,
        iterations=1
    )

    gray = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2GRAY
    )

    foreground_pixels = gray[
        surface_mask > 0
    ]

    if len(foreground_pixels) == 0:
        return None

    # --------------------------------------------------------
    # Intensity features
    # --------------------------------------------------------

    intensity_mean = np.mean(
        foreground_pixels
    )

    intensity_std = np.std(
        foreground_pixels
    )

    intensity_median = np.median(
        foreground_pixels
    )

    # --------------------------------------------------------
    # Edge density
    # --------------------------------------------------------

    edges = cv2.Canny(
        gray,
        50,
        150
    )

    foreground_edges = edges[
        surface_mask > 0
    ]

    edge_density = (
        np.count_nonzero(
            foreground_edges
        )
        / len(foreground_edges)
    )

    # --------------------------------------------------------
    # Local contrast
    # --------------------------------------------------------

    blurred = cv2.GaussianBlur(
        gray,
        (7, 7),
        0
    )

    difference = cv2.absdiff(
        gray,
        blurred
    )

    contrast_pixels = difference[
        surface_mask > 0
    ]

    local_contrast = np.mean(
        contrast_pixels
    )

    # --------------------------------------------------------
    # Dark anomaly ratio
    # --------------------------------------------------------

    mad = np.median(
        np.abs(
            foreground_pixels.astype(float)
            -
            intensity_median
        )
    )

    dark_threshold = (
        intensity_median
        -
        1.5 * mad
    )

    dark_anomaly_ratio = np.mean(
        foreground_pixels
        <
        dark_threshold
    )

    # --------------------------------------------------------
    # Surface entropy
    # --------------------------------------------------------

    histogram = cv2.calcHist(
        [gray],
        [0],
        surface_mask,
        [256],
        [0, 256]
    ).flatten()

    histogram_sum = histogram.sum()

    if histogram_sum > 0:

        histogram = (
            histogram
            / histogram_sum
        )

        histogram = histogram[
            histogram > 0
        ]

        surface_entropy = -np.sum(
            histogram
            *
            np.log2(histogram)
        )

    else:
        surface_entropy = 0.0

    # --------------------------------------------------------
    # Laplacian texture variation
    # --------------------------------------------------------

    laplacian = cv2.Laplacian(
        gray,
        cv2.CV_64F
    )

    laplacian_pixels = laplacian[
        surface_mask > 0
    ]

    laplacian_variance = np.var(
        laplacian_pixels
    )

    # --------------------------------------------------------
    # Return surface features
    # --------------------------------------------------------

    return {

        "intensity_mean":
            float(intensity_mean),

        "intensity_std":
            float(intensity_std),

        "intensity_median":
            float(intensity_median),

        "edge_density":
            float(edge_density),

        "local_contrast":
            float(local_contrast),

        "dark_anomaly_ratio":
            float(dark_anomaly_ratio),

        "surface_entropy":
            float(surface_entropy),

        "laplacian_variance":
            float(laplacian_variance)
    }


def aggregate_circular_hue(hue_values):

    hue_values = np.asarray(
        hue_values,
        dtype=float
    )

    if len(hue_values) == 0:
        return np.nan

    angles = (
        hue_values
        * 2
        * np.pi
        / 180.0
    )

    mean_sin = np.mean(
        np.sin(angles)
    )

    mean_cos = np.mean(
        np.cos(angles)
    )

    angle = np.arctan2(
        mean_sin,
        mean_cos
    )

    if angle < 0:
        angle += 2 * np.pi

    return float(
        angle
        * 180.0
        / (2 * np.pi)
    )


def aggregate_quill_features(
    per_quill_features
):

    if len(per_quill_features) == 0:
        return None

    result = {}

    # --------------------------------------------
    # Circular hue requires special treatment
    # --------------------------------------------

    hue_values = [
        q["hue_circular_mean"]
        for q in per_quill_features
    ]

    result[
        "hue_circular_mean"
    ] = aggregate_circular_hue(
        hue_values
    )

    # Optional variation between quills
    if len(hue_values) > 1:

        angles = (
            np.asarray(hue_values)
            * 2
            * np.pi
            / 180.0
        )

        R = np.sqrt(
            np.mean(np.cos(angles)) ** 2
            +
            np.mean(np.sin(angles)) ** 2
        )

        result[
            "hue_circular_variation"
        ] = float(1 - R)

    else:

        result[
            "hue_circular_variation"
        ] = 0.0

    # --------------------------------------------
    # Aggregate all other features
    # --------------------------------------------

    for feature in all_feature_names:

        if feature == "hue_circular_mean":
            continue

        values = np.asarray(
            [
                q[feature]
                for q in per_quill_features
            ],
            dtype=float
        )

        result[
            f"{feature}_mean"
        ] = float(
            np.mean(values)
        )

        result[
            f"{feature}_std"
        ] = float(
            np.std(values)
        )

    return result

