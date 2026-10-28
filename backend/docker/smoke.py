"""Linux-only real-model/HTTP smoke and resource report, using test target dependencies."""
import json
import os
import platform
import hashlib
import cv2
import sys
try:
    import resource
except ImportError:
    resource = None
import time
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient
from PIL import Image
from sentence_transformers import SentenceTransformer
from app.main import app
from app.ml.segmentation.service import get_segmentation_service
from app.ai_assistant.retrieval import Retriever
from app.ml.measurement.config import USE_DIAMETER_CALIBRATION, DIAMETER_CALIBRATION_OFFSET_MM
from app.core.config import MODEL_DIRECTORY, PROJECT_ROOT
report = {"requests": [], "detector": [], "platform": platform.system()}
expected = json.loads((PROJECT_ROOT / "docker/model-sha256.json").read_text())
report["model_sha256"] = {name: hashlib.sha256((MODEL_DIRECTORY/name).read_bytes()).hexdigest() for name in expected}
assert report["model_sha256"] == expected
report["inference"] = {"imgsz": 640, "conf": 0.25, "device": "cpu", "iou": "Ultralytics default", "preprocessing": "Original bytes decoded to BGR by OpenCV"}
assert USE_DIAMETER_CALIBRATION and DIAMETER_CALIBRATION_OFFSET_MM == 1.5
start = time.perf_counter()
with TestClient(app) as client:
    report["startup_seconds"] = time.perf_counter() - start
    assert client.get("/health").json() == {"status": "ok"}
    visual = app.state.visual_service
    assert visual.detector.task == "detect" and visual.detector.names == {0: "Quill"}
    segment = get_segmentation_service()
    assert segment.model.task == "segment" and segment.model.names == {0: "Coin", 1: "Quill"}
    report["rf_classes"] = visual.classes
    start = time.perf_counter()
    from app.core.config import ASSISTANT_ENCODER_PATH, ASSISTANT_ENCODER_CACHE
    encoder = SentenceTransformer(ASSISTANT_ENCODER_PATH, cache_folder=str(ASSISTANT_ENCODER_CACHE), device="cpu", local_files_only=True)
    retriever = Retriever(encoder)
    assert encoder.encode(["cinnamon"]).shape == (1, 384)
    assert retriever.embeddings.shape == (62, 384)
    report["encoder_init_seconds"] = time.perf_counter() - start
    images = sorted((PROJECT_ROOT / "backend_handoff/test_images").glob("*.jpg"))
    assert images, "Mount original test images"
    for image in images:
        data = image.read_bytes()
        decoded = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        result = visual.detector.predict(source=decoded, imgsz=640, conf=.25, device="cpu", verbose=False)[0]
        report["detector"].append({"image": image.name, "image_sha256": hashlib.sha256(data).hexdigest(),
            "decoded_sha256": hashlib.sha256(decoded.tobytes()).hexdigest(), "decoded_shape": list(decoded.shape),
            "boxes": result.boxes.xyxy.cpu().tolist(), "confidences": result.boxes.conf.cpu().tolist(),
            "iou": visual.detector.predictor.args.iou})
        w, h = Image.open(image).size
        geometry = dict(version=1, mapping="ios-preview-cropped", image_width=w, image_height=h,
                        preview_width=w, preview_height=h, coin=dict(x=.02,y=.45,width=.2,height=.2*w/h),
                        quill=dict(x=.55,y=.05,width=.4,height=.9))
        for endpoint in ("/predict-visual", "/measure-diameter", "/validate-sample"):
            started = time.perf_counter()
            response = client.post(endpoint, files={"image": (image.name, image.read_bytes(), "image/jpeg")},
                                   data={"capture_geometry": json.dumps(geometry)})
            assert response.status_code in (200,422), response.text[:500]
            body = response.json()
            if endpoint == "/measure-diameter" and response.status_code == 200:
                assert abs(body["diameter_mm"] - max(body["raw_diameter_mm"]-1.5,0)) < 1e-9
            report["requests"].append(dict(image=image.name, endpoint=endpoint, http_status=response.status_code,
                seconds=time.perf_counter()-started, diameter_mm=body.get("diameter_mm"),
                raw_diameter_mm=body.get("raw_diameter_mm"), calibrated_diameter_mm=body.get("calibrated_diameter_mm"), diameter_grade=body.get("diameter_grade"),
                status=body.get("status"), detail=body.get("detail"), visual_prediction=body.get("visual_prediction")))
report["process_peak_rss_mib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 if resource else None
peak = Path("/sys/fs/cgroup/memory.peak")
report["cgroup_peak_bytes"] = int(peak.read_text()) if peak.exists() else None
report["status"] = "PASS"
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
