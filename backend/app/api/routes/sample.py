from typing import Annotated
import asyncio
import json
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool
from app.api.routes.visual import get_visual_service
from app.core.config import MAX_IMAGE_BYTES
from app.services.image_validation import validate_image
from app.ml.visual.service import VisualModelService
from app.services.sample_decision import validate_sample
from app.services.v5_capture_log import begin_capture, finish_capture

router = APIRouter(tags=["sample-validation"])


def logged_validation(data, geometry, service, progress=None):
    row = begin_capture(data)
    result = None
    try:
        result = validate_sample(data, geometry, service, progress) if progress else validate_sample(data, geometry, service)
        return result
    finally:
        finish_capture(row, result)


async def live_validation(data, geometry, service):
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    def progress(step, state):
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "progress", "step": step, "state": state})
    async def run():
        try:
            result = await run_in_threadpool(logged_validation, data, geometry, service, progress)
            await queue.put({"type": "result", "result": result})
        except Exception:
            await queue.put({"type": "error", "message": "Validation could not complete. Please retry."})
    task = asyncio.create_task(run())
    try:
        while True:
            event = await queue.get()
            yield json.dumps(event, allow_nan=False) + "\n"
            if event["type"] in ("result", "error"):
                break
    finally:
        task.cancel()


@router.post("/validate-sample")
async def validate_sample_endpoint(
    image: Annotated[UploadFile, File()],
    capture_geometry: Annotated[str, Form(max_length=8192)],
    service: Annotated[VisualModelService, Depends(get_visual_service)],
    live: bool = False,
):
    try:
        if image.content_type not in ("image/jpeg", "image/png"):
            raise HTTPException(415, "Upload JPEG or PNG.")
        data = await image.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image exceeds upload limit.")
        await run_in_threadpool(validate_image, data)
        if live:
            return StreamingResponse(live_validation(data, capture_geometry, service),
                media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
        return await run_in_threadpool(logged_validation, data, capture_geometry, service)
    finally:
        await image.close()
