"""ROI-only prototype metrology. Never used by the visual feature pipeline."""
import base64
import io
import cv2
import numpy as np
from PIL import Image, ImageOps
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.ml.measurement.config import COIN_DIAMETER_MM, diameter_grade
from app.ml.measurement.coin_diagnostics import candidate_report, finish_contours
from app.ml.measurement.quill_edges import refine_rows, edge_overlay

class Rect(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def bounds(self):
        if self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Guide extends outside image")
        return self

class Geometry(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    version: int = Field(ge=1, le=1)
    mapping: str = Field(pattern="^ios-preview-cropped$")
    image_width: int = Field(gt=0)
    image_height: int = Field(gt=0)
    preview_width: float = Field(gt=0)
    preview_height: float = Field(gt=0)
    coin: Rect
    quill: Rect

    @model_validator(mode="after")
    def layout(self):
        a,b = self.coin,self.quill
        if not (a.x+a.width <= b.x or b.x+b.width <= a.x or
                a.y+a.height <= b.y or b.y+b.height <= a.y):
            raise ValueError("Guides overlap")
        if abs((a.width*self.preview_width)/(a.height*self.preview_height)-1) > .03:
            raise ValueError("Coin guide must be square")
        return self

def crop(image, rect):
    h,w = image.shape[:2]
    x,y = int(np.floor(rect.x*w)),int(np.floor(rect.y*h))
    right,bottom = min(w,int(np.ceil((rect.x+rect.width)*w))),min(h,int(np.ceil((rect.y+rect.height)*h)))
    if min(right-x,bottom-y) < 32:
        raise ValueError("Guide resolution is too small. Move closer and retake.")
    return image[y:bottom,x:right],(x,y,right,bottom)

def foreground(roi, stats=None):
    lab = cv2.cvtColor(cv2.GaussianBlur(roi,(3,3),0),cv2.COLOR_BGR2LAB).astype(np.float32)
    h,w = roi.shape[:2]
    n = max(2,int(min(h,w)*.04))
    border = np.concatenate((lab[:n].reshape(-1,3),lab[-n:].reshape(-1,3),lab[:,:n].reshape(-1,3),lab[:,-n:].reshape(-1,3)))
    background = np.median(border,axis=0)
    distance = np.linalg.norm(lab-background,axis=2)
    if stats is not None:
        stats.update(border_width_px=n,background_lab=background.tolist(),distance_p95=float(np.percentile(distance,95)),minimum_distance_p95=12)
    if np.percentile(distance,95) < 12:
        raise ValueError("Insufficient foreground contrast. Use a plain contrasting background.")
    scaled = np.clip(distance,0,255).astype(np.uint8)
    threshold,mask = cv2.threshold(scaled,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    if stats is not None:
        stats["otsu_threshold"]=float(threshold)
    return mask

def internal(contour,w,h):
    x,y,cw,ch = cv2.boundingRect(contour)
    return x>2 and y>2 and x+cw<w-2 and y+ch<h-2

def measure(data: bytes, geometry: Geometry, diagnostics=None):
    if diagnostics is None:
        diagnostics={"report":{},"images":{}}
    report=diagnostics["report"]
    report.update(stage="image_decode", candidates=[], selected_contour_id=None, selected_enclosing_circle=None)
    with Image.open(io.BytesIO(data)) as source:
        rgb = np.asarray(ImageOps.exif_transpose(source).convert("RGB"))
    image = cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR)
    h,w = image.shape[:2]
    report["upright_image_dimensions_px"]={"width":w,"height":h}
    report["stage"]="roi_mapping"
    report["mapping_status"]="failed"
    # A tentative crop is useful even when declared dimensions/aspect are wrong.
    # It is explicitly marked unsafe until the original mapping checks pass.
    try:
        tentative,bounds=crop(image,geometry.coin)
        diagnostics["images"]["coin-roi"]=tentative.copy()
        diagnostics["images"]["coin-contours"]=tentative.copy()
        report["coin_roi_image_px"]={"x":bounds[0],"y":bounds[1],"width":bounds[2]-bounds[0],"height":bounds[3]-bounds[1],"right_exclusive":bounds[2],"bottom_exclusive":bounds[3]}
        mapped=image.copy()
        cv2.rectangle(mapped,bounds[:2],bounds[2:],(255,160,0),3)
        diagnostics["images"]["mapped-guides"]=mapped
    except ValueError:
        report["coin_roi_image_px"]=None
    if (w,h)!=(geometry.image_width,geometry.image_height):
        raise ValueError("Captured dimensions do not match the upright image. Retake the photo.")
    if abs((w/h)/(geometry.preview_width/geometry.preview_height)-1) > .02:
        raise ValueError("Preview/image aspect ratios differ; guide mapping is unsafe.")
    coin,cb = crop(image,geometry.coin)
    report["mapping_status"]="dimension_and_aspect_checks_passed_physical_alignment_unverified"
    report["coin_roi_image_px"]={"x":cb[0],"y":cb[1],"width":cb[2]-cb[0],"height":cb[3]-cb[1],"right_exclusive":cb[2],"bottom_exclusive":cb[3]}
    diagnostics["images"]["coin-roi"]=coin.copy()
    diagnostics["images"]["coin-contours"]=coin.copy()
    mapped=image.copy()
    cv2.rectangle(mapped,cb[:2],cb[2:],(255,160,0),3)
    diagnostics["images"]["mapped-guides"]=mapped
    quill,qb = crop(image,geometry.quill)
    overlay = image.copy()
    ch,cw = coin.shape[:2]
    candidates=[]
    reports=[]
    accepted_ids=[]
    report["stage"]="coin_foreground"
    # Outer foreground contour avoids selecting the coin's inner inscriptions.
    report["foreground_statistics"]={}
    mask=cv2.morphologyEx(foreground(coin,report["foreground_statistics"]),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    diagnostics["images"]["coin-mask"]=mask.copy()
    report["foreground_fraction"]=float(np.count_nonzero(mask)/mask.size)
    report["stage"]="coin_contours"
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for index,contour in enumerate(contours):
        item=candidate_report(contour,cw,ch,index)
        reports.append(item)
        area=cv2.contourArea(contour)
        perimeter=cv2.arcLength(contour,True)
        if area < .08*cw*ch or not internal(contour,cw,ch) or perimeter==0:
            item["rejection_reason"]="area_below_existing_minimum" if area < .08*cw*ch else "contour_touches_roi_edge" if not internal(contour,cw,ch) else "zero_perimeter"
            continue
        circularity=4*np.pi*area/perimeter**2
        hull=cv2.convexHull(contour)
        if circularity < .65 or area/max(cv2.contourArea(hull),1)<.9 or len(contour)<5:
            item["rejection_reason"]="shape_convexity_rejection"
            continue
        _,axes,_=cv2.fitEllipse(contour)
        if min(axes)/max(axes)<.88:
            item["rejection_reason"]="ellipse_tilt_rejection"
            continue
        center,radius=cv2.minEnclosingCircle(hull)
        if area/(np.pi*radius**2)<.78:
            item["rejection_reason"]="circle_fill_rejection"
            continue
        candidates.append((contour,center,radius))
        item["accepted"]=True
        accepted_ids.append(index)
    finish_contours(diagnostics,coin,contours,reports,accepted_ids)
    if len(candidates)!=1:
        raise ValueError("Coin boundary is missing, clipped, tilted or ambiguous. Retake on a plain background.")
    contour,center,radius=candidates[0]
    coin_px=float(2*radius)
    report["stage"]="quill_measurement"
    ppm=coin_px/COIN_DIAMETER_MM
    qh,qw=quill.shape[:2]
    contours,_=cv2.findContours(foreground(quill),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    candidates=[]
    for c in contours:
        x,y,bw,bh=cv2.boundingRect(c)
        if internal(c,qw,qh) and bh>.4*qh and bh>2*bw and cv2.contourArea(c)>.04*qw*qh and x<=qw/2<=x+bw:
            candidates.append(c)
    if len(candidates)!=1:
        raise ValueError("One complete vertical quill could not be segmented. Keep it away from guide edges.")
    c=candidates[0]
    axis=cv2.fitLine(c,cv2.DIST_L2,0,.01,.01).ravel()
    if abs(float(axis[0]))/max(abs(float(axis[1])),1e-6)>.12:
        raise ValueError("Quill is tilted. Align it vertically and retake.")
    # Preserve original foreground holes; contour filling would conceal invalid rows.
    component=np.zeros((qh,qw),np.uint8)
    cv2.drawContours(component,[c],-1,255,-1)
    component=cv2.bitwise_and(component,foreground(quill))
    x,y,bw,bh=cv2.boundingRect(c)
    rows=[]
    start,end=y+int(.4*bh),y+int(.6*bh)
    for row in range(start,end):
        positions=np.flatnonzero(component[row])
        if len(positions)<5 or positions[0]<=2 or positions[-1]>=qw-3:
            continue
        if np.any(np.diff(positions)>1):
            continue
        rows.append((row,int(positions[0]),int(positions[-1])+1))
    if len(rows)<max(8,int((end-start)*.6)):
        raise ValueError("Too few valid central width rows. Improve lighting/background and retake.")
    widths=np.array([b-a for _,a,b in rows],dtype=float)
    median=float(np.median(widths))
    mad=float(np.median(np.abs(widths-median)))
    valid=np.abs(widths-median)<=max(2,3*mad)
    if valid.sum()<max(8,.7*len(rows)) or np.std(widths[valid])/median>.08:
        raise ValueError("Central quill width is unstable. Retake with a straighter sample.")
    rough_width=float(np.median(widths[valid]))
    refined_rows=refine_rows(quill,rows,valid)
    report["quill_refinement"]={"rough_width_px":rough_width,"rough_diameter_mm":rough_width/ppm,"rough_valid_rows":int(valid.sum()),"rows":refined_rows}
    diagnostics["images"]["quill-edges"]=edge_overlay(quill,refined_rows)
    accepted=[r for r in refined_rows if r["accepted"]]
    report["quill_refinement"].update(accepted_rows=len(accepted),overlay_legend="Red: rough edges; cyan: accepted refined edges; orange: located edge on a rejected row; green: accepted width rows.")
    if len(accepted)<max(8,int(.6*valid.sum())):
        raise ValueError("Too few clear quill edges after refinement. Use diffuse lighting and a contrasting background.")
    refined_widths=np.array([r["width_px"] for r in accepted])
    refined_median=float(np.median(refined_widths))
    refined_mad=float(np.median(np.abs(refined_widths-refined_median)))
    for record in accepted:
        if abs(record["width_px"]-refined_median)>max(2,3*refined_mad):
            record.update(accepted=False,rejection_reason="refined_width_outlier")
    accepted=[r for r in refined_rows if r["accepted"]]
    report["quill_refinement"]["accepted_rows"]=len(accepted)
    diagnostics["images"]["quill-edges"]=edge_overlay(quill,refined_rows)
    refined_widths=np.array([r["width_px"] for r in accepted])
    if len(accepted)<max(8,int(.6*valid.sum())) or np.std(refined_widths)/np.median(refined_widths)>.08:
        raise ValueError("Refined quill edges are unstable. Retake with clearer boundaries.")
    width=float(np.median(refined_widths))
    report["quill_refinement"].update(refined_width_px=width,refined_diameter_mm=width/ppm,accepted_rows=len(accepted),overlay_legend="Red: rough edges; cyan: refined edges; green: accepted measurement rows.")
    diameter=width/ppm
    for bounds in (cb,qb):
        cv2.rectangle(overlay,bounds[:2],bounds[2:],(255,160,0),2)
    shift=np.array([[[cb[0],cb[1]]]])
    cv2.drawContours(overlay,[contour+shift],-1,(0,255,0),2)
    cv2.circle(overlay,(round(center[0]+cb[0]),round(center[1]+cb[1])),round(radius),(0,255,255),2)
    cv2.rectangle(overlay,(qb[0]+x,qb[1]+start),(qb[0]+x+bw,qb[1]+end),(255,0,255),2)
    for index,record in enumerate(refined_rows):
        row=record["row"]
        for key in ("rough_left","rough_right"):
            cv2.circle(overlay,(qb[0]+round(record[key]),qb[1]+row),1,(0,0,255),-1)
        if record["accepted"]:
            a,b=record["refined_left"],record["refined_right"]
            if index % max(1,len(rows)//12)==0:
                cv2.line(overlay,(qb[0]+round(a),qb[1]+row),(qb[0]+round(b),qb[1]+row),(0,255,0),1)
            for position in (a,b):
                cv2.circle(overlay,(qb[0]+round(position),qb[1]+row),1,(255,255,0),-1)
    cv2.putText(overlay,f"{diameter:.2f} mm | prototype",(20,40),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,0,255),2)
    ok,png=cv2.imencode(".png",overlay)
    if not ok:
        raise RuntimeError("Overlay encoding failed")
    report["stage"]="complete"
    return dict(coin_diameter_px=coin_px,pixels_per_mm=ppm,quill_width_px=width,
        quill_diameter_mm=diameter,diameter_grade=diameter_grade(diameter),
        valid_rows=len(accepted),diagnostic_overlay="data:image/png;base64,"+base64.b64encode(png).decode()),png.tobytes()
