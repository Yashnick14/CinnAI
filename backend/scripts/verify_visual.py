"""Run real uploads through /predict-visual and compare with saved notebook output.

Run from backend: python scripts/verify_visual.py
Never trains, edits, or saves either model. Only pure notebook definitions execute.
"""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT / "data" / "runtime"))
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / "data" / "runtime" / "matplotlib"))

import cv2
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd

from app.main import app
from app.ml.visual.service import FEATURE_COLUMNS
from app.core.config import MODEL_DIRECTORY, YOLO_MODEL_NAME, RF_MODEL_NAME

HANDOFF = ROOT / "backend_handoff"
notebook = json.loads((HANDOFF / "FYP.ipynb").read_text(encoding="utf-8"))

def training_definitions():
    ns = {"cv2": cv2, "np": np}
    for i in (90, 91):
        tree = ast.parse("".join(notebook["cells"][i]["source"]))
        nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) or
                 (isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in
                  {"colour_feature_names", "surface_feature_names", "all_feature_names"} for t in node.targets))]
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "notebook_training_definitions", "exec"), ns)
    return ns

def notebook_baselines():
    text = "\n".join("".join(o.get("text", [])) for o in notebook["cells"][140].get("outputs", []))
    baseline = {}
    for part in re.split(r"(diameter_test_0[123]\.jpg)", text)[1:]:
        if re.fullmatch(r"diameter_test_0[123]\.jpg", part):
            filename = part
            continue
        prediction = re.search(r"Visual prediction:\s*(.+)", part)
        confidence = re.search(r"Visual confidence:\s*([\d.]+)", part)
        detected = re.search(r"Detected quills:\s*(\d+)", part)
        probabilities = dict((name, float(prob)) for name, prob in re.findall(
            r"^\s*(Alba|C4|C5 Special|C5|H1|H2|M4|M5)\s*:\s*([\d.]+)\s*$", part, flags=re.MULTILINE))
        if prediction and confidence and detected and len(probabilities) == 8:
            baseline[filename] = {"detected_quills": int(detected.group(1)), "visual_prediction": prediction.group(1).strip(), "visual_confidence": float(confidence.group(1)), "probabilities": probabilities}
    return baseline

def original_training_features(path, detector, ns):
    # Cell 92's original per-image statements, executed without any training/I/O loops.
    tree = ast.parse("".join(notebook["cells"][91]["source"]))
    grade_loop = next(node for node in tree.body if isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node.target.id == "grade")
    image_loop = next(node for node in grade_loop.body if isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node.target.id == "image_name")
    # Keep the loop so its original continue statements and skip behaviour remain intact.
    scope = dict(ns)
    scope.update({"final_model": detector, "image_files": [path.name], "grade_dir": str(path.parent), "grade": "TEST", "os": os,
                  "tqdm": lambda iterable, **kwargs: iterable, "failed_images": [], "rows": [], "processed_images": 0,
                  "pd": pd, "checkpoint_path": str(ROOT / "data" / "unused-checkpoint.csv")})
    exec(compile(ast.Module(body=[image_loop], type_ignores=[]), "notebook_cell_92_image_loop", "exec"), scope)
    if not scope["rows"]:
        raise RuntimeError(f"Original notebook training loop found no usable features: {scope['failed_images']}")
    return {name: scope["rows"][0][name] for name in FEATURE_COLUMNS}

def main():
    paths = [HANDOFF / "test_images" / f"diameter_test_0{i}.jpg" for i in (1, 2, 3)]
    missing = [str(p) for p in paths if not p.is_file()]
    if missing:
        raise FileNotFoundError("Missing original images: " + ", ".join(missing))
    baselines = notebook_baselines()
    ns = training_definitions()
    report = {"preprocessing": "training-era cells 91–95; no later area/aspect filter or IoU override", "artifacts": {}, "images": []}
    for name in (YOLO_MODEL_NAME, RF_MODEL_NAME):
        report["artifacts"][name] = hashlib.sha256((MODEL_DIRECTORY / name).read_bytes()).hexdigest()
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        service = app.state.visual_service
        for path in paths:
            with path.open("rb") as handle:
                response = client.post("/predict-visual", files={"image": (path.name, handle, "image/jpeg")})
            entry = {"filename": path.name, "image_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "http_status": response.status_code, "backend": response.json(), "notebook_later_test": baselines[path.name]}
            if response.status_code == 200:
                image = cv2.imread(str(path))
                detected, usable, deployed_row = service.extract_image_features(image)
                oracle = original_training_features(path, service.detector, ns)
                np.testing.assert_allclose(list(deployed_row.values()), list(oracle.values()), rtol=0, atol=0)
                expected_probs = service.rf_model.predict_proba(pd.DataFrame([oracle], columns=service.feature_columns))[0]
                actual_probs = list(entry["backend"]["probabilities"].values())
                np.testing.assert_allclose(actual_probs, expected_probs, rtol=0, atol=0)
                entry["usable_quills"] = usable
                entry["training_oracle_exact_match"] = True
                entry["training_features"] = deployed_row
                entry["probability_deltas_vs_later_test"] = {
                    grade: entry["backend"]["probabilities"][grade] - baselines[path.name]["probabilities"][grade]
                    for grade in service.classes}
            report["images"].append(entry)
    for name, before in report["artifacts"].items():
        assert hashlib.sha256((MODEL_DIRECTORY / name).read_bytes()).hexdigest() == before, "Model artifact changed"
    out = ROOT / "visual_validation_results.json"
    out.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(report, indent=2, allow_nan=False))
    if any(entry["http_status"] != 200 for entry in report["images"]):
        raise SystemExit("One or more real endpoint requests failed; see the report.")

if __name__ == "__main__":
    main()
