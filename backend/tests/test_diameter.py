from app.services import diameter_service
from io import BytesIO
import base64
import cv2
import numpy as np
import pytest
from PIL import Image
from app.ml.measurement.controlled import Geometry, measure
from app.ml.measurement.config import diameter_grade

@pytest.fixture(autouse=True)
def legacy_measurement_for_comparison(monkeypatch):
    # Retain all existing OpenCV diagnostics/measurement tests as a separate comparison path.
    from app.api.routes import diameter
    monkeypatch.setattr(diameter_service, "measure", measure)

def scene(coin=True,quill=True):
    image=np.full((1600,1200,3),245,np.uint8)
    if coin:
        cv2.circle(image,(276,1056),125,(100,100,100),-1)
        cv2.putText(image,"10",(240,1070),0,1,(40,40,40),2)
    if quill:
        cv2.rectangle(image,(800,300),(949,1399),(45,120,180),-1)
    _,data=cv2.imencode(".png",image)
    return data.tobytes()

def geometry():
    return Geometry.model_validate(dict(version=1,mapping="ios-preview-cropped",
        image_width=1200,image_height=1600,preview_width=300,preview_height=400,
        coin=dict(x=.07,y=.54,width=.32,height=.24),
        quill=dict(x=.55,y=.08,width=.36,height=.84)))

def test_known_scale_and_width_and_overlay():
    result,png=measure(scene(),geometry())
    assert result["coin_diameter_px"]==pytest.approx(250,abs=3)
    assert result["quill_width_px"]==pytest.approx(150,abs=2)
    assert result["quill_diameter_mm"]==pytest.approx(15.84,abs=.25)
    assert result["diameter_grade"]=="C4"
    assert result["valid_rows"]>100
    assert base64.b64decode(result["diagnostic_overlay"].split(",")[1])==png
    assert Image.open(BytesIO(png)).size==(1200,1600)

@pytest.mark.parametrize("coin,quill",[(False,True),(True,False)])
def test_missing_objects_do_not_produce_measurements(coin,quill):
    with pytest.raises(ValueError):
        measure(scene(coin,quill),geometry())

def test_mapping_mismatch_is_rejected():
    g=geometry()
    g.image_width=1100
    with pytest.raises(ValueError,match="dimensions"):
        measure(scene(),g)
    g=geometry()
    g.preview_height=300
    with pytest.raises(ValueError,match="aspect"):
        measure(scene(),g)

@pytest.mark.parametrize("kind",["clipped_coin","tilted_quill","clipped_quill"])
def test_invalid_pose_is_rejected(kind):
    image=cv2.imdecode(np.frombuffer(scene(),np.uint8),cv2.IMREAD_COLOR)
    if kind=="clipped_coin":
        image[864:1248,84:468]=245
        cv2.circle(image,(100,1056),125,(100,100,100),-1)
    else:
        image[128:1472,660:1092]=245
        if kind=="tilted_quill":
            points=np.array([[710,300],[850,270],[1050,1350],[910,1380]],np.int32)
            cv2.fillPoly(image,[points],(45,120,180))
        else:
            cv2.rectangle(image,(800,100),(949,1399),(45,120,180),-1)
    _,data=cv2.imencode(".png",image)
    with pytest.raises(ValueError): measure(data.tobytes(),geometry())

@pytest.mark.parametrize("mm,grade", [
    (6.9, "Alba"),
    (7.0, "C5 Special"),
    (9.9, "C5 Special"),
    (10.0, "Manual review"),
    (10.1, "C5"),
    (11.9, "C5"),
    (12.0, "Manual review"),
    (12.1, "C4"),
    (15.9, "C4"),
    (16.0, "Manual review"),
    (16.1, "M5"),
    (17.9, "M5"),
    (18.0, "Manual review"),
    (18.1, "M4"),
    (20.9, "M4"),
    (21.0, "Manual review"),
    (21.1, "H1"),
    (24.0, "H1"),
    (24.9, "H1"),
    (25.0, "Manual review"),
    (25.1, "H2"),
    (32.0, "H2"),
    (32.1, "Manual review"),
])
def test_grade_boundaries(mm,grade):
    assert diameter_grade(mm)==grade

def test_roi_geometry_validation():
    raw=geometry().model_dump()
    raw["coin"]["x"]=.95
    with pytest.raises(ValueError): Geometry.model_validate(raw)

def test_endpoint_saves_original_geometry_and_overlay(monkeypatch,tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes import diameter
    from app.services.temporary_uploads import save_temporary_visual_upload
    monkeypatch.setattr(diameter_service,"save_temporary_visual_upload",lambda data:save_temporary_visual_upload(data,tmp_path))
    app=FastAPI()
    app.include_router(diameter.router)
    with TestClient(app) as api:
        response=api.post("/measure-diameter",files={"image":("capture.png",scene(),"image/png")},data={"capture_geometry":geometry().model_dump_json()})
        assert response.status_code==200,response.text
        assert response.json()["diameter_grade"]=="C4"
        invalid=api.post("/measure-diameter",files={"image":("capture.png",scene(),"image/png")},data={"capture_geometry":"{}"})
        assert invalid.status_code==422
        assert invalid.json()["coin_diagnostics"]["coin_failure_categories"]==["incorrect_roi_mapping"]
        failed=api.post("/measure-diameter",files={"image":("capture.png",scene(coin=False),"image/png")},data={"capture_geometry":geometry().model_dump_json()})
        assert failed.status_code==422
        diagnostic=failed.json()["coin_diagnostics"]
        assert diagnostic["coin_failure_categories"]==["no_foreground_separation"]
        assert diagnostic["artifacts"]["coin-roi"].endswith(".coin-roi.png")
    assert len(list(tmp_path.glob("*.geometry.json")))==3
    assert len(list(tmp_path.glob("*.overlay.png")))==1

def test_coin_diagnostics_include_all_metrics_and_selected_contour():
    diagnostics={"report":{},"images":{}}
    result,_=measure(scene(),geometry(),diagnostics)
    report=diagnostics["report"]
    assert report["coin_roi_image_px"]==dict(x=84,y=864,width=384,height=384,right_exclusive=468,bottom_exclusive=1248)
    assert report["selected_contour_id"]==0
    c=report["candidates"][0]
    assert c["accepted"] and c["rejection_reason"] is None
    assert c["enclosing_circle_radius_px"]==pytest.approx(125,abs=2)
    assert c["area_px2"]>40000 and c["solidity"]>.9
    assert not c["touches_roi_border"]
    assert c["distance_from_roi_centre_px"]<2
    assert set(diagnostics["images"]) >= {"coin-roi","coin-contours","coin-mask","coin-selected","mapped-guides"}
    assert result["quill_diameter_mm"]==pytest.approx(15.84,abs=.25)

@pytest.mark.parametrize("kind,category",[("empty","no_foreground_separation"),("mapping","incorrect_roi_mapping"),("clipped","contour_touches_roi_edge"),("multiple","multiple_ambiguous_candidates"),("shape","shape_convexity_rejection")])
def test_failed_coin_diagnostics_are_saved(monkeypatch,tmp_path,kind,category):
    import json
    from app.api.routes import diameter
    from app.services.temporary_uploads import save_temporary_visual_upload
    monkeypatch.setattr(diameter_service,"save_temporary_visual_upload",lambda data:save_temporary_visual_upload(data,tmp_path))
    image=cv2.imdecode(np.frombuffer(scene(),np.uint8),cv2.IMREAD_COLOR)
    g=geometry()
    if kind=="mapping":
        g.image_width=1100
    else:
        image[864:1248,84:468]=245
        if kind=="clipped": cv2.circle(image,(100,1056),125,(100,100,100),-1)
        if kind=="multiple":
            for x in (190,360): cv2.circle(image,(x,1056),65,(100,100,100),-1)
        if kind=="shape": cv2.rectangle(image,(130,970),(420,1100),(100,100,100),-1)
    _,data=cv2.imencode(".png",image)
    with pytest.raises(diameter.DiagnosticFailure) as caught:
        diameter.process(data.tobytes(),g.model_dump_json())
    report=caught.value.diagnostics
    assert category in report["coin_failure_categories"]
    assert report["selected_contour_id"] is None
    assert len(list(tmp_path.glob("*.coin-roi.png")))==1
    assert len(list(tmp_path.glob("*.coin-contours.png")))==1
    saved=json.loads(next(tmp_path.glob("*.coin-diagnostics.json")).read_text())
    assert saved["status"]=="failed" and saved["artifacts"]["coin-roi"]
    if kind=="multiple": assert len(saved["accepted_candidate_ids"])==2
