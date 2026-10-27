import csv,json,hashlib
from pathlib import Path
from collections import Counter
import cv2,numpy as np
from PIL import Image,ImageOps
from io import BytesIO
from app.ml.visual.service import VisualModelService
from app.services.sample_decision import detect_evidence,decide
from app.ml.measurement.segmentation_diameter import measure
root=Path("backend_handoff/realworld_v5_collection")
rows=list(csv.DictReader((root/"results.csv").open()))
print("COUNTS",Counter(r["sample_validation_result"] for r in rows),flush=True)
selected=[rows[-1],rows[-4],rows[-6],rows[-8]]
service=VisualModelService.load()
out=[]
for r in selected:
    path=root/"images"/r["filename"]; data=path.read_bytes()
    folder=Path("audit-shadow")/path.stem; folder.mkdir(exist_ok=True)
    (folder/path.name).write_bytes(data)
    detector=detect_evidence(service,data)
    diagnostics={"report":{},"images":{}}
    errors={};visual=diameter=None
    try: visual=service.predict_visual(data)
    except Exception as e: errors["visual"]=str(e)
    try:
        diameter,_=measure(data,None,diagnostics)
        diameter.pop("diagnostic_overlay",None)
    except Exception as e: errors["diameter"]=str(e)
    result=decide(detector,visual,diameter,errors)
    a=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR)
    b=cv2.cvtColor(np.asarray(ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")),cv2.COLOR_RGB2BGR)
    result["decode_comparison"]={"same_shape":a.shape==b.shape,"max_channel_difference":int(np.abs(a.astype(int)-b.astype(int)).max()) if a.shape==b.shape else None}
    result["filename"]=path.name
    result["previous"]=r
    for name,img in diagnostics["images"].items(): cv2.imwrite(str(folder/(name+".png")),img)
    (folder/"measurement.json").write_text(json.dumps(diagnostics["report"],indent=2))
    (folder/"result.json").write_text(json.dumps(result,indent=2))
    out.append(result)
    print(path.name,result["validation_breakdown"],flush=True)
Path("audit-shadow/results.json").write_text(json.dumps(out,indent=2))
