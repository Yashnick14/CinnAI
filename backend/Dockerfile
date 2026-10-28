# syntax=docker/dockerfile:1
FROM python:3.13-slim-bookworm AS dependencies
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt requirements-container.txt ./
# Explicit CPU wheels prevent a multi-GB CUDA dependency installation.
RUN python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.11.0+cpu torchvision==0.26.0+cpu \
    && python -m pip install -r requirements-container.txt \
    && python -m pip check

FROM dependencies AS encoder
COPY docker/prepare_encoder.py /build/prepare_encoder.py
RUN python /build/prepare_encoder.py

FROM dependencies AS runtime
ENV PYTHONPATH=/app MODEL_DIRECTORY=/app/models \
    ASSISTANT_ENCODER_PATH=/opt/minilm \
    ASSISTANT_ENCODER_CACHE=/tmp/assistant-cache \
    HF_HUB_OFFLINE=1 HF_HOME=/tmp/huggingface \
    TOKENIZERS_PARALLELISM=false MPLCONFIGDIR=/tmp/matplotlib YOLO_CONFIG_DIR=/tmp/ultralytics \
    TEMP_VISUAL_UPLOAD_DIRECTORY=/var/lib/cinnai/temporary-visual-uploads \
    V5_COLLECTION_DIRECTORY=/var/lib/cinnai/realworld-v5-collection \
    UPLOAD_DIRECTORY=/var/lib/cinnai/grading-images \
    OMP_NUM_THREADS=2 MKL_NUM_THREADS=2
RUN groupadd --gid 10001 cinnai && useradd --uid 10001 --gid 10001 --no-create-home cinnai \
    && mkdir -p /var/lib/cinnai && chown 10001:10001 /var/lib/cinnai
COPY --from=encoder /opt/minilm /opt/minilm
COPY app/ ./app/
COPY models/quill_detector_v5.pt models/coin_quill_segmentation.pt models/rf_vision_8_class.pkl ./models/
COPY docker/ ./docker/
RUN python docker/verify_models.py
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4); assert r.status == 200"
# One worker: the evaluation CSV uses process-local locking, not distributed locking.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

# Optional validation image; tests/fixtures are mounted read-only, never copied.
FROM runtime AS test
USER root
RUN python -m pip install 'pytest>=8,<10' 'httpx>=0.28,<1' && python -m pip check
USER 10001:10001
CMD ["python", "-B", "-m", "pytest", "/app/tests", "-q", "-p", "no:cacheprovider", "--basetemp=/tmp/pytest"]

# Default docker build must produce the runtime, not the test image.
FROM runtime AS production
