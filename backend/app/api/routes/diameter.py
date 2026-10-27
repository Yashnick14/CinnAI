from typing import Annotated
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from app.core.config import MAX_IMAGE_BYTES
from app.services.image_validation import validate_image

router=APIRouter(tags=["diameter"])

from app.services.diameter_service import process, DiagnosticFailure

@router.post("/measure-diameter")
async def measure_diameter(image: Annotated[UploadFile,File()],capture_geometry: Annotated[str,Form(max_length=8192)]):
    try:
        if image.content_type not in ("image/jpeg","image/png"):
            raise HTTPException(415,"Upload JPEG or PNG.")
        data=await image.read(MAX_IMAGE_BYTES+1)
        if len(data)>MAX_IMAGE_BYTES:
            raise HTTPException(413,"Image exceeds upload limit.")
        try:
            await run_in_threadpool(validate_image,data)
            return await run_in_threadpool(process,data,capture_geometry)
        except DiagnosticFailure as error:
            return JSONResponse(status_code=error.status_code,content={"detail":str(error),"coin_diagnostics":error.diagnostics})
        except (ValueError,ValidationError) as error:
            raise HTTPException(422,str(error)) from error
        except OSError as error:
            raise HTTPException(507,"Could not save diameter diagnostic files.") from error
    finally:
        await image.close()
