import sys,csv,json
from pathlib import Path
import cv2,numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from app.ml.measurement.segmentation_diameter import refine_quill_mask,central_widths
from shadow_candidate import correct_shadow

def main():
    out=ROOT/"experiments/shadow_v5/output"
    records=[]
    for folder in sorted((ROOT/"audit-shadow").iterdir()):
        if not folder.is_dir():continue
        originals=list(folder.glob("*.jpg"))
        if not originals:continue
        path=originals[0];image=cv2.imread(str(path))
        raw=(cv2.imread(str(folder/"quill-mask.png"),0)>0).astype(np.uint8)
        refined=refine_quill_mask(raw)
        candidate,debug=correct_shadow(image,refined)
        report=json.loads((folder/"measurement.json").read_text())
        scale=report["pixels_per_mm"]
        br,bk,bw,_,_=central_widths(refined)
        er,ek,ew,_,_=central_widths(candidate)
        dest=out/path.stem;dest.mkdir(exist_ok=True)
        for name,mask in [("raw",raw),("refined",refined),("experimental",candidate)]:
            cv2.imwrite(str(dest/(name+".png")),mask*255)
        overlay=image.copy()
        for mask,color in [(refined,(0,0,255)),(candidate,(0,255,0))]:
            contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(overlay,contours,-1,color,3)
        ys,xs=np.nonzero(raw)
        crop=overlay[max(0,ys.min()-30):min(image.shape[0],ys.max()+31),max(0,xs.min()-30):min(image.shape[1],xs.max()+31)]
        cv2.imwrite(str(dest/"overlay-crop.jpg"),crop)
        debug["rows"]=[dict(y=y,left=l,right=r,width=w,accepted=bool(k)) for (y,l,r,w),k in zip(er,ek)]
        (dest/"diagnostics.json").write_text(json.dumps(debug,indent=2))
        row=dict(filename=path.name,baseline_pixel_width=bw,experimental_pixel_width=ew,
                 baseline_diameter_mm=bw/scale,experimental_diameter_mm=ew/scale,
                 manual_diameter_mm=None,baseline_absolute_error_mm=None,experimental_absolute_error_mm=None)
        records.append(row);print(row,flush=True)
    (out/"shadow.json").write_text(json.dumps(records,indent=2))
    with (out/"shadow.csv").open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(records[0]));w.writeheader()
        for r in records:w.writerow({k:"null" if v is None else v for k,v in r.items()})
if __name__=="__main__":main()
