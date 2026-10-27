import logging
import json
import cv2
from app.services.temporary_uploads import save_temporary_visual_upload
from app.ml.measurement.controlled import Geometry
from app.ml.measurement.segmentation_diameter import measure
from app.ml.segmentation.service import SegmentationUnavailableError, SegmentationDetectionError

class DiagnosticFailure(ValueError):
    def __init__(self, message, diagnostics, status_code=422):
        super().__init__(message)
        self.diagnostics=diagnostics
        self.status_code=status_code


def process(data, raw_geometry, measurement=None):
    path=save_temporary_visual_upload(data)
    path.with_suffix(".geometry.json").write_text(raw_geometry,encoding="utf-8")
    logging.getLogger("uvicorn.error").info("Diameter capture and geometry: %s",path)
    diagnostics={"report":{"stage":"geometry_validation","mapping_status":"not_validated","coin_roi_image_px":None,"candidates":[],"selected_contour_id":None,"selected_enclosing_circle":None},"images":{}}
    report=diagnostics["report"]
    try:
        geometry=Geometry.model_validate_json(raw_geometry)
        result,png=(measurement or measure)(data,geometry,diagnostics)
        path.with_suffix(".overlay.png").write_bytes(png)
        report["status"]="success"
    except SegmentationUnavailableError as error:
        report.update(status="failed",error=str(error))
        logging.getLogger("uvicorn.error").warning("Diameter segmentation unavailable: %s", error, exc_info=True)
        raise DiagnosticFailure(str(error),report,status_code=503) from error
    except ValueError as error:
        if isinstance(error, SegmentationDetectionError):
            report["segmentation"] = error.evidence
        report["status"]="failed"
        report["error"]=str(error)
        stage=report["stage"]
        if stage in ("geometry_validation","roi_mapping"):
            report["coin_failure_categories"]=["incorrect_roi_mapping"]
        elif stage=="coin_foreground":
            report["coin_failure_categories"]=["no_foreground_separation"]
        elif stage=="quill_measurement":
            report["coin_failure_categories"]=[]
            report["note"]="Coin was accepted; measurement failed later in the quill stage."
        raise DiagnosticFailure(str(error),report) from error
    finally:
        artifacts={"original":str(path),"geometry":str(path.with_suffix(".geometry.json"))}
        for name,image in diagnostics["images"].items():
            destination=path.with_suffix(f".{name}.png")
            ok,encoded=cv2.imencode(".png",image)
            if not ok:
                raise OSError("Could not encode coin diagnostic image")
            destination.write_bytes(encoded.tobytes())
            artifacts[name]=str(destination)
        report["artifacts"]=artifacts
        report_path=path.with_suffix(".coin-diagnostics.json")
        report_path.write_text(json.dumps(report,indent=2,allow_nan=False),encoding="utf-8")
        logging.getLogger("uvicorn.error").info("Coin diagnostics (%s): %s",report.get("status","error"),report_path)
    result["coin_diagnostics"]=report
    return result

