import os
from pathlib import Path
from uuid import UUID
from app.core.config import UPLOAD_DIRECTORY

class ImageStore:
    def __init__(self, directory: Path = UPLOAD_DIRECTORY):
        self.directory = directory

    def save(self, record_id: UUID, data: bytes, content_type: str) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        extension = ".png" if content_type == "image/png" else ".jpg"
        filename = f"{record_id}{extension}"
        target = self.directory / filename
        temporary = self.directory / f".{filename}.tmp"
        try:
            temporary.write_bytes(data)
            os.replace(temporary, target)
        except OSError as error:
            temporary.unlink(missing_ok=True)
            raise RuntimeError("The uploaded image could not be stored.") from error
        return filename

    def path(self, filename: str) -> Path:
        if Path(filename).name != filename:
            raise ValueError("Invalid image filename.")
        return self.directory / filename

    def delete(self, filename: str) -> None:
        self.path(filename).unlink(missing_ok=True)
