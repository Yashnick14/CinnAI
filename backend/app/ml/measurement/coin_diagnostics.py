"""Temporary coin instrumentation. These checks do not accept/reject measurements."""
import cv2
import numpy as np


def candidate_report(contour, width, height, index):
    area = float(cv2.contourArea(contour))
    perimeter = float(cv2.arcLength(contour, True))
    hull = cv2.convexHull(contour)
    hull_area = float(cv2.contourArea(hull))
    x, y, w, h = cv2.boundingRect(contour)
    moments = cv2.moments(contour)
    centroid = (moments["m10"] / moments["m00"], moments["m01"] / moments["m00"]) if moments["m00"] else (x+w/2, y+h/2)
    center, radius = cv2.minEnclosingCircle(hull)
    ellipse_ratio = None
    if len(contour) >= 5:
        try:
            _, axes, _ = cv2.fitEllipse(contour)
            ellipse_ratio = float(min(axes)/max(axes)) if max(axes) else 0.0
        except cv2.error:
            pass  # Diagnostic fitting of rejected degeneracies must not affect selection.
    return dict(
        id=index, area_px2=area, bounding_box_roi_px=dict(x=x,y=y,width=w,height=h),
        centroid_roi_px=list(centroid), distance_from_roi_centre_px=float(np.hypot(centroid[0]-width/2,centroid[1]-height/2)),
        is_convex=bool(cv2.isContourConvex(contour)), solidity=area/max(hull_area,1),
        touches_roi_border=bool(x<=0 or y<=0 or x+w>=width or y+h>=height),
        violates_existing_border_margin=not (x>2 and y>2 and x+w<width-2 and y+h<height-2),
        enclosing_circle_center_roi_px=list(center), enclosing_circle_radius_px=float(radius),
        circle_extends_outside_roi=bool(center[0]-radius<0 or center[1]-radius<0 or center[0]+radius>width or center[1]+radius>height),
        circle_diameter_fraction_of_guide=float(2*radius/min(width,height)),
        circularity=4*np.pi*area/perimeter**2 if perimeter else 0.0,
        perimeter_px=perimeter, ellipse_axis_ratio=ellipse_ratio,
        circle_fill_ratio=area/(np.pi*radius**2) if radius else 0.0,
        accepted=False, rejection_reason=None,
    )


def finish_contours(diagnostics, coin, contours, reports, accepted_ids):
    canvas=coin.copy()
    for contour,report in zip(contours,reports):
        color=(0,180,0) if report["accepted"] else (0,0,255)
        cv2.drawContours(canvas,[contour],-1,color,2)
        x,y,_,_=cv2.boundingRect(contour)
        cv2.putText(canvas,str(report["id"]),(x,max(15,y)),cv2.FONT_HERSHEY_SIMPLEX,.5,color,1)
        center=report["enclosing_circle_center_roi_px"]
        cv2.circle(canvas,tuple(round(v) for v in center),round(report["enclosing_circle_radius_px"]),(255,160,0),1)
    diagnostics["images"]["coin-contours"]=canvas
    diagnostics["report"]["candidates"]=reports
    selected=accepted_ids[0] if len(accepted_ids)==1 else None
    diagnostics["report"]["selected_contour_id"]=selected
    diagnostics["report"]["accepted_candidate_ids"]=accepted_ids
    diagnostics["report"]["selection_rejection_reason"]="multiple_ambiguous_candidates" if len(accepted_ids)>1 else "no_accepted_candidate" if not accepted_ids else None
    diagnostics["report"]["overlay_legend"]="Red: rejected contour; green: accepted contour; blue: diagnostic enclosing circle; numbers: candidate IDs. Selected image uses green contour/yellow circle. Unannotated image means this stage was not reached."
    if selected is not None:
        report=reports[selected]
        chosen=coin.copy()
        cv2.drawContours(chosen,[contours[selected]],-1,(0,255,0),2)
        cv2.circle(chosen,tuple(round(v) for v in report["enclosing_circle_center_roi_px"]),round(report["enclosing_circle_radius_px"]),(0,255,255),2)
        diagnostics["images"]["coin-selected"]=chosen
        diagnostics["report"]["selected_enclosing_circle"]=dict(center_roi_px=report["enclosing_circle_center_roi_px"],radius_px=report["enclosing_circle_radius_px"])
    reasons={report["rejection_reason"] for report in reports}
    categories=[]
    if len(accepted_ids)>1: categories.append("multiple_ambiguous_candidates")
    if any(r["violates_existing_border_margin"] for r in reports): categories.append("contour_touches_roi_edge")
    if reasons & {"shape_convexity_rejection","ellipse_tilt_rejection","circle_fill_rejection"}: categories.append("shape_convexity_rejection")
    if not contours: categories.append("no_foreground_separation")
    if "area_below_existing_minimum" in reasons: categories.append("foreground_components_below_existing_minimum_area")
    diagnostics["report"]["coin_failure_categories"]=categories if len(accepted_ids)!=1 else []
    diagnostics["report"]["guide_size_check"]={
        "status":"diagnostic_only_no_existing_circle_size_acceptance_threshold",
        "candidate_ids_with_circle_outside_roi":[r["id"] for r in reports if r["circle_extends_outside_roi"]],
        "note":"No guide-size rejection has been added. Circle size is reported separately from existing contour tests.",
    }
