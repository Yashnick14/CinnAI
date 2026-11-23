"""Validated report branding; uploaded logos are bounded and re-encoded."""
import base64
import binascii
import io
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ReportSettingsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    company_name: str = Field(default="", max_length=120)
    address: str = Field(default="", max_length=400)
    phone: str = Field(default="", max_length=50)
    email: str = Field(default="", max_length=150)
    website: str = Field(default="", max_length=200)
    registration_number: str = Field(default="", max_length=80)
    logo_data_url: str | None = Field(default=None, max_length=2800000)

    @field_validator("logo_data_url")
    @classmethod
    def clean_logo(cls, value):
        """Accept PNG/JPEG content only and strip metadata before storing inline."""
        if value is None:
            return None
        try:
            prefix, encoded = value.split(",", 1)
            if prefix not in ("data:image/png;base64", "data:image/jpeg;base64"):
                raise ValueError("Choose a PNG or JPEG logo.")
            raw = base64.b64decode(encoded, validate=True)
            if len(raw) > 2 * 1024 * 1024:
                raise ValueError("Logo must be smaller than 2 MB.")
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(raw)) as source:
                    if source.format not in ("PNG", "JPEG") or source.width * source.height > 16000000:
                        raise ValueError("Logo dimensions are too large or unsupported.")
                    source.load()
                    image = ImageOps.exif_transpose(source).convert("RGBA")
                    image.thumbnail((800, 400))
                    output = io.BytesIO()
                    image.save(output, format="PNG", optimize=True)
            if output.tell() > 512 * 1024:
                raise ValueError("Choose a simpler or smaller logo.")
            return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")
        except (binascii.Error, UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError("Choose a valid PNG or JPEG logo.") from exc
