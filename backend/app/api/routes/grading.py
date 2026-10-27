from typing import Annotated
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from app.core.config import MAX_IMAGE_BYTES
from app.database import get_db
from app.repositories.grading_records import GradingRecordRepository
from app.schemas.grading import GradingResult, Scenario, StoredGradingResult
from app.services.grading_service import GradingService, get_grading_service
from app.services.image_validation import validate_image
from app.services.image_store import ImageStore

router = APIRouter(prefix="/api/v1", tags=["grading"])

@router.post("/grade", response_model=GradingResult, summary="Return an explicitly labelled MOCK grading fixture")
async def grade(
    image: Annotated[UploadFile, File(description="JPEG or PNG; validated but not analysed")],
    service: Annotated[GradingService, Depends(get_grading_service)],
    moisture_percent: Annotated[float | None, Form(ge=0, le=100, allow_inf_nan=False)] = None,
    mock_scenario: Annotated[Scenario, Form()] = "accepted",
    db: Session = Depends(get_db),
):
    try:
        if image.content_type not in ("image/jpeg", "image/png"):
            raise HTTPException(415, "Upload a JPEG or PNG image.")
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image exceeds the upload size limit.")
        await run_in_threadpool(validate_image, data)
        result = await run_in_threadpool(service.grade, data, moisture_percent, mock_scenario)
        store = ImageStore()
        try:
            filename = await run_in_threadpool(store.save, result.id, data, image.content_type)
        except RuntimeError as error:
            raise HTTPException(507, str(error)) from error
        try:
            await run_in_threadpool(
                GradingRecordRepository(db).save, result, filename, image.content_type
            )
        except Exception:
            await run_in_threadpool(store.delete, filename)
            raise HTTPException(503, "The grading record could not be saved.")
        return result
    finally:
        await image.close()

def _response(record, request: Request) -> StoredGradingResult:
    return StoredGradingResult.model_validate({
        **record.result_payload,
        "image_url": str(request.url_for("record_image", record_id=record.id)),
    })

@router.get("/records", response_model=list[StoredGradingResult])
def records(request: Request, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    return [_response(record, request) for record in GradingRecordRepository(db).list(limit, offset)]

@router.get("/records/{record_id}", response_model=StoredGradingResult)
def record(record_id: UUID, request: Request, db: Session = Depends(get_db)):
    saved = GradingRecordRepository(db).get(record_id)
    if not saved:
        raise HTTPException(404, "Grading record not found.")
    return _response(saved, request)

@router.get("/records/{record_id}/image", name="record_image")
def record_image(record_id: UUID, db: Session = Depends(get_db)):
    saved = GradingRecordRepository(db).get(record_id)
    if not saved:
        raise HTTPException(404, "Grading record not found.")
    path = ImageStore().path(saved.image_filename)
    if not path.is_file():
        raise HTTPException(404, "Stored image not found.")
    return FileResponse(path, media_type=saved.image_content_type, filename=Path(path).name)

