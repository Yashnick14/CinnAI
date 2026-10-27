"""Retain validated original upload bytes for local visual-pipeline debugging."""
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from app.core.config import TEMP_VISUAL_UPLOAD_DIRECTORY

def save_temporary_visual_upload(data: bytes, directory: Path = TEMP_VISUAL_UPLOAD_DIRECTORY) -> Path:
    # Caller validates JPEG/PNG first. Use the content rather than an untrusted filename.
    suffix = ".png" if data.startswith(b"\x89PNG\r\n\x1a\n") else ".jpg"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{timestamp}_{uuid4().hex}{suffix}"
    stream = target.open("xb")
    try:
        with stream:
            stream.write(data)
    except OSError:
        # Do not leave a partially written image that looks like a valid sample.
        target.unlink(missing_ok=True)
        raise
    return target.resolve()
