"""Upload validation only. No grading, segmentation or measurement."""
from io import BytesIO
import warnings
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException
from app.core.config import MAX_IMAGE_PIXELS

def validate_image(data: bytes) -> None:
    if not data:
        raise HTTPException(400, "The uploaded image is empty.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in ("JPEG", "PNG"):
                    raise HTTPException(415, "Upload a JPEG or PNG image.")
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, "Image resolution is too large. Use a smaller capture.")
                image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, "The file is not a valid JPEG or PNG image.") from None

