"""Application configuration. The active API is visual-only."""
import os
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
MODEL_DIRECTORY = Path(os.getenv("MODEL_DIRECTORY", str(PROJECT_ROOT / "models")))
YOLO_MODEL_NAME = "quill_detector_v5.pt"
RF_MODEL_NAME = "rf_vision_8_class.pkl"
SEGMENTATION_MODEL_NAME = "coin_quill_segmentation.pt"
SUPPORTED_GRADES = ("Alba", "C4", "C5", "C5 Special", "H1", "H2", "M4", "M5")
REFERENCE_COIN_DIAMETER_MM = 26.4
MOISTURE_LIMIT_PERCENT = 14.0
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MAX_IMAGE_PIXELS = 24_000_000
TEMP_VISUAL_UPLOAD_DIRECTORY = Path(
    os.getenv("TEMP_VISUAL_UPLOAD_DIRECTORY", str(PROJECT_ROOT / "data" / "temporary-visual-uploads"))
)
if not TEMP_VISUAL_UPLOAD_DIRECTORY.is_absolute():
    TEMP_VISUAL_UPLOAD_DIRECTORY = PROJECT_ROOT / TEMP_VISUAL_UPLOAD_DIRECTORY
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://cinnamon:cinnamon@localhost:5432/cinnamon_grading",
)
UPLOAD_DIRECTORY = Path(
    os.getenv("UPLOAD_DIRECTORY", str(PROJECT_ROOT / "data" / "grading-images"))
)
ALLOWED_ORIGINS = tuple(
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:8082").split(",")
    if origin.strip()
)
# Configuration for future integration only; not executed by the mock service.
DIAMETER_RULES = {
    "Alba": {"min": 0, "max": 7, "max_inclusive": False},
    "C5 Special": {"min": 8, "max": 10, "max_inclusive": True},
    "C5": {"min": 10, "max": 12, "max_inclusive": True},
    "C4": {"min": 12, "max": 16, "max_inclusive": True},
    "M5": {"min": 18, "max": 23, "max_inclusive": True},
    "M4": {"min": 21, "max": 23, "max_inclusive": True},
    "H1": {"min": 23, "max": 32, "max_inclusive": True},
    "H2": {"min": 32, "max": 38, "max_inclusive": True},
}
MIN_ABSOLUTE_CANDIDATE_PROBABILITY = 0.10
MIN_NORMALIZED_CANDIDATE_CONFIDENCE = 0.50

