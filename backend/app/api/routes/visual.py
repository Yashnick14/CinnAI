import logging
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool
from app.core.config import MAX_IMAGE_BYTES
from app.schemas.visual import VisualPrediction
from app.services.image_validation import validate_image
from app.services.temporary_uploads import save_temporary_visual_upload
from app.ml.visual.service import InvalidImageError, ModelContractError, NoUsableQuillsError, VisualModelService

router = APIRouter(tags=["visual"])
logger = logging.getLogger(__name__)

def get_visual_service(request: Request) -> VisualModelService:
    service = getattr(request.app.state, "visual_service", None)
    if service is None:
        raise HTTPException(503, "Visual models are unavailable. Check server startup logs.")
    return service

@router.post("/predict-visual", response_model=VisualPrediction)
async def predict_visual(
    image: Annotated[UploadFile, File(description="JPEG or PNG cinnamon sample")],
    service: Annotated[VisualModelService, Depends(get_visual_service)],
):
    try:
        if image.content_type not in ("image/jpeg", "image/png"):
            raise HTTPException(415, "Upload a JPEG or PNG image.")
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image exceeds the upload size limit.")
        await run_in_threadpool(validate_image, data)
        try:
            saved_path = await run_in_threadpool(save_temporary_visual_upload, data)
        except OSError as error:
            logger.exception("Could not retain temporary visual upload")
            raise HTTPException(507, "The original photo could not be saved for debugging. Check backend storage space and permissions.") from error
        logging.getLogger("uvicorn.error").info("Temporary visual upload saved: %s", saved_path)
        try:
            return await run_in_threadpool(service.predict_visual, data)
        except NoUsableQuillsError as error:
            raise HTTPException(422, str(error)) from error
        except InvalidImageError as error:
            raise HTTPException(400, str(error)) from error
        except ModelContractError as error:
            logger.exception("Visual model contract failure")
            raise HTTPException(503, "Visual inference failed its model/feature contract. Check server logs.") from error
        except Exception as error:
            logger.exception("Visual inference failed")
            raise HTTPException(503, "Visual inference failed. Check server logs and retry.") from error
    finally:
        await image.close()
