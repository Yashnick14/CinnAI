"""Local image-gradient refinement of rough quill boundaries, without calibration offsets."""
import cv2
import numpy as np


def edge_overlay(roi, records):
    canvas=roi.copy()
    for index,record in enumerate(records):
        row=record["row"]
        for key in ("rough_left","rough_right"):
            cv2.circle(canvas,(round(record[key]),row),1,(0,0,255),-1)
        if record["accepted"] and index % max(1,len(records)//12)==0:
            cv2.line(canvas,(round(record["refined_left"]),row),(round(record["refined_right"]),row),(0,255,0),1)
        for key in ("refined_left","refined_right"):
            if record[key] is not None:
                cv2.circle(canvas,(round(record[key]),row),1,(255,255,0) if record["accepted"] else (0,165,255),-1)
    return canvas


def edge_position(profile, rough, radius):
    """Return a subpixel edge between pixel centres, or an explicit rejection."""
    gradient = np.linalg.norm(np.diff(profile, axis=0), axis=1)
    lo = max(1, int(np.floor(rough-radius)))
    hi = min(len(gradient)-2, int(np.ceil(rough+radius)))
    if hi <= lo:
        return None, "search_window_clipped"
    values = gradient[lo:hi+1]
    noise = float(np.median(values))
    mad = float(np.median(np.abs(values-noise)))
    peaks = [i for i in range(lo, hi+1)
             if gradient[i] >= gradient[i-1] and gradient[i] > gradient[i+1]]
    peaks.sort(key=lambda i: float(gradient[i]), reverse=True)
    if not peaks or gradient[peaks[0]] < max(2.0, noise+3*mad):
        return None, "no_clear_transition"
    peak = peaks[0]
    if peak in (lo, hi):
        return None, "peak_at_search_limit"
    if any(abs(i-peak)>3 and gradient[i]>=.75*gradient[peak] for i in peaks[1:]):
        return None, "multiple_ambiguous_edges"
    # Reject weak/noisy gradients without imposing a preferred edge colour.
    outside, inside = max(0,peak-3), min(len(profile)-1,peak+4)
    if np.linalg.norm(profile[inside]-profile[outside]) < 8:
        return None, "insufficient_edge_contrast"
    before, middle, after = map(float, gradient[peak-1:peak+2])
    curvature = before-2*middle+after
    delta = .5*(before-after)/curvature if abs(curvature)>1e-9 else 0.0
    return float(peak+.5+np.clip(delta,-.5,.5)), None


def refine_rows(roi, rows, rough_valid):
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)
    # Gentle horizontal smoothing suppresses pixel noise, preserving edge position.
    typical_width=float(np.median([b-a for _,a,b in rows]))
    sigma=max(.8,.005*typical_width)
    kernel=2*int(np.ceil(3*sigma))+1
    lab = cv2.GaussianBlur(lab, (kernel,1), sigma)
    records = []
    for keep, (row,left,right) in zip(rough_valid,rows):
        record = dict(row=int(row),rough_left=float(left-.5),rough_right=float(right-.5),
                      refined_left=None,refined_right=None,accepted=False,rejection_reason=None)
        records.append(record)
        if not keep:
            record["rejection_reason"]="rough_width_outlier"
            continue
        profile=np.median(lab[max(0,row-2):row+3],axis=0)
        # A local window proportional to apparent width works across resolutions.
        radius=max(4,int(round(.10*(right-left))))
        record["search_radius_px"]=radius
        a,why_left=edge_position(profile,left-.5,radius)
        b,why_right=edge_position(profile,right-.5,radius)
        record.update(refined_left=a,refined_right=b)
        if why_left or why_right:
            record["rejection_reason"]="; ".join(s for s in (
                f"left:{why_left}" if why_left else None,
                f"right:{why_right}" if why_right else None) if s)
        elif b <= a:
            record["rejection_reason"]="invalid_refined_width"
        else:
            record.update(accepted=True,width_px=float(b-a))
    # Compare to nearby rows using physical row distance, not a reordered width list.
    eligible=[r for r in records if r["accepted"]]
    for record in eligible:
        neighbours=[r["width_px"] for r in eligible if r is not record and abs(r["row"]-record["row"])<=5]
        if len(neighbours)>=3:
            median=float(np.median(neighbours))
            mad=float(np.median(np.abs(np.asarray(neighbours)-median)))
            if abs(record["width_px"]-median)>max(2.0,3*mad):
                record.update(accepted=False,rejection_reason="neighbour_width_outlier")
    return records
