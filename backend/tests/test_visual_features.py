import ast
import inspect
import json
from pathlib import Path
import cv2
import numpy as np
import pytest
from app.ml.visual import feature_extraction as deployed
from app.ml.visual.service import FEATURE_COLUMNS

NOTEBOOK = Path(__file__).resolve().parents[1] / "backend_handoff" / "FYP.ipynb"

@pytest.fixture(scope="module")
def training():
    """Load only original pure definitions; never execute training or notebook I/O."""
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    namespace = {"cv2": cv2, "np": np}
    for index in (90, 91):
        tree = ast.parse("".join(notebook["cells"][index]["source"]))
        definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef) or
                       (isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in
                        {"colour_feature_names", "surface_feature_names", "all_feature_names"} for target in node.targets))]
        exec(compile(ast.Module(body=definitions, type_ignores=[]), "training_notebook", "exec"), namespace)
    return namespace

@pytest.mark.parametrize("name", ["create_quill_mask_v2", "extract_colour_features", "extract_surface_features", "aggregate_circular_hue", "aggregate_quill_features"])
def test_function_ast_exactly_matches_authoritative_notebook(name):
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    cell = notebook["cells"][90 if name.startswith(("create_", "extract_")) else 91]
    original = next(node for node in ast.parse("".join(cell["source"])).body if isinstance(node, ast.FunctionDef) and node.name == name)
    actual = ast.parse(inspect.getsource(getattr(deployed, name))).body[0]
    assert ast.dump(actual, include_attributes=False) == ast.dump(original, include_attributes=False)

@pytest.mark.parametrize("box", [(35, 5, 100, 230), (0, 0, 90, 220), (15, 15, 200, 230)])
def test_crop_mask_features_and_aggregation_match_training_numerically(training, box):
    rng = np.random.default_rng(42)
    image = np.full((250, 220, 3), 210, dtype=np.uint8)
    image[15:230, 35:100] = rng.integers(20, 175, size=(215, 65, 3), dtype=np.uint8)
    expected_crop, expected_mask = training["create_quill_mask_v2"](image, box)
    crop, mask = deployed.create_quill_mask_v2(image, box)
    np.testing.assert_array_equal(crop, expected_crop)
    np.testing.assert_array_equal(mask, expected_mask)
    expected, actual = {}, {}
    for name in ("extract_colour_features", "extract_surface_features"):
        oracle = training[name](expected_crop, expected_mask)
        result = getattr(deployed, name)(crop, mask)
        assert result == oracle
        if result is not None:
            expected.update(oracle)
            actual.update(result)
    assert actual
    assert deployed.aggregate_quill_features([actual, actual]) == training["aggregate_quill_features"]([expected, expected])

def test_circular_aggregation_and_final_selection(training):
    quills = []
    for hue in (179.0, 1.0):
        row = {name: 10.0 for name in training["all_feature_names"]}
        row["hue_circular_mean"] = hue
        quills.append(row)
    assert deployed.aggregate_quill_features(quills) == training["aggregate_quill_features"](quills)
    assert "hue_circular_variation" not in FEATURE_COLUMNS
    assert list(FEATURE_COLUMNS) == ["hue_circular_mean"] + [name + "_mean" for name in training["all_feature_names"] if name != "hue_circular_mean"]
