"""Offline only. No application imports this experiment."""
import csv, json, hashlib, sys
from pathlib import Path
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from app.core.config import MODEL_DIRECTORY, YOLO_MODEL_NAME
def main():
    from ultralytics import YOLO
    out=ROOT/"experiments/shadow_v5/output"
    out.mkdir(exist_ok=True)
    model=YOLO(str(MODEL_DIRECTORY/YOLO_MODEL_NAME))
    captures=ROOT/"backend_handoff/realworld_v5_collection"
    historical=list(csv.DictReader((captures/"results.csv").open()))
    records=[]
    for r in historical:
        if r["v5_detection_count"]!="0": continue
        path=captures/"images"/r["filename"]
        data=path.read_bytes()
        image=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR)
        predictions={}
        for threshold in (.25,.05):
            result=model.predict(source=image.copy(),imgsz=640,conf=threshold,device="cpu",verbose=False)[0]
            predictions[str(threshold)]=[
                dict(confidence=float(b.conf.item()),class_id=int(b.cls.item()),bbox=b.xyxy[0].cpu().numpy().tolist())
                for b in result.boxes
            ]
        boxes=predictions["0.05"]; high=max((b["confidence"] for b in boxes),default=None)
        category="Genuine zero prediction" if high is None else "Near-threshold detection" if high>=.15 else "Very-low-confidence detection"
        record=dict(filename=path.name,sha256=hashlib.sha256(data).hexdigest(),historical_production_count=0,
                    production_count=len(predictions["0.25"]),low_count=len(boxes),max_confidence=high,
                    predictions=predictions,confidence_category=category,
                    visual_correspondence="pending_review",category=category)
        records.append(record)
        # All boxes labeled, not just highest confidence.
        preview=image.copy()
        for i,b in enumerate(boxes):
            x1,y1,x2,y2=map(round,b["bbox"])
            cv2.rectangle(preview,(x1,y1),(x2,y2),(0,0,255),5)
            cv2.putText(preview,f'{i}: {b["confidence"]:.3f}',(x1,max(30,y1-10)),cv2.FONT_HERSHEY_SIMPLEX,1.2,(0,0,255),3)
        h,w=preview.shape[:2]
        preview=cv2.resize(preview,(int(w*min(1,500/w)),int(h*min(1,500/w))))
        cv2.imwrite(str(out/(path.stem+".detector.jpg")),preview)
        print(path.name,high,category,flush=True)
    review_path=Path(__file__).with_name("visual_review.json")
    review=json.loads(review_path.read_text()) if review_path.exists() else {}
    for record in records:
        record.update(review.get(record["filename"], {}))
    (out/"detector.json").write_text(json.dumps(records,indent=2))
    with (out/"detector.csv").open("w",newline="") as f:
        keys=["filename","production_count","low_count","max_confidence","confidence_category","visual_correspondence","category","scene_review","interpretation","predictions"]
        writer=csv.DictWriter(f,keys,extrasaction="ignore");writer.writeheader()
        for r in records:writer.writerow({**r,"predictions":json.dumps(r["predictions"])})
    # Contact sheets retain filename labels and all boxes for human review.
    for start in range(0,len(records),6):
        canvas=np.full((900,1200,3),255,np.uint8)
        for j,r in enumerate(records[start:start+6]):
            img=cv2.imread(str(out/(Path(r["filename"]).stem+".detector.jpg")))
            scale=min(380/img.shape[1],390/img.shape[0])
            img=cv2.resize(img,(round(img.shape[1]*scale),round(img.shape[0]*scale)))
            x=(j%3)*400;y=(j//3)*450
            canvas[y+40:y+40+img.shape[0],x:x+img.shape[1]]=img
            cv2.putText(canvas,f'{start+j+1}: {r["max_confidence"]}',(x+4,y+20),cv2.FONT_HERSHEY_SIMPLEX,.48,(0,0,0),1)
        cv2.imwrite(str(out/f"contact-{start//6+1}.jpg"),canvas)
if __name__=="__main__": main()
