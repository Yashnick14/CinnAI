from contextlib import asynccontextmanager
from app.api.routes.assistant import router as assistant_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.visual import router as visual_router
from app.api.routes.diameter import router as diameter_router
from app.api.routes.sample import router as sample_router
from app.core.config import ALLOWED_ORIGINS
from app.ml.visual.service import VisualModelService
from starlette.concurrency import run_in_threadpool

@asynccontextmanager
async def lifespan(application: FastAPI):
    # Fail startup rather than serving invented grades when an artifact is invalid.
    application.state.visual_service = await run_in_threadpool(VisualModelService.load)
    try:
        yield
    finally:
        application.state.visual_service = None

app = FastAPI(
    title="Cinnamon Visual Grading",
    version="0.3.0",
    description="Training-era YOLO11n detection and 21-feature Random Forest visual prediction only.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(visual_router)
app.include_router(diameter_router)
app.include_router(sample_router)


app.include_router(assistant_router)
