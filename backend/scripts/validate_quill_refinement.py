"""Replay a saved capture; physical reference is for reporting only, never inference."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.api.routes.diameter import process, DiagnosticFailure
from app.ml.measurement.controlled import measure as legacy_measure

parser=argparse.ArgumentParser()
parser.add_argument("image",type=Path)
parser.add_argument("geometry",type=Path)
parser.add_argument("--physical-mm",type=float,required=True)
parser.add_argument("--output",type=Path,required=True)
args=parser.parse_args()
if args.physical_mm<=0:
    parser.error("Physical diameter must be positive")
data=args.image.read_bytes()
result=None
try:
    result=process(data,args.geometry.read_text(encoding="utf-8"),measurement=legacy_measure)
    report=result["coin_diagnostics"]
except DiagnosticFailure as error:
    report=error.diagnostics
q=report.get("quill_refinement",{})
old=q.get("rough_diameter_mm")
new=result["quill_diameter_mm"] if result else None
summary=dict(source_image=str(args.image.resolve()),sha256=hashlib.sha256(data).hexdigest(),
    physical_diameter_mm=args.physical_mm,old_width_px=q.get("rough_width_px"),
    refined_width_px=result["quill_width_px"] if result else None,old_diameter_mm=old,
    refined_diameter_mm=new,old_absolute_error_mm=abs(old-args.physical_mm) if old else None,
    old_percentage_error=100*abs(old-args.physical_mm)/args.physical_mm if old else None,
    refined_absolute_error_mm=abs(new-args.physical_mm) if new else None,
    refined_percentage_error=100*abs(new-args.physical_mm)/args.physical_mm if new else None,
    rough_valid_rows=q.get("rough_valid_rows"),accepted_refined_rows=q.get("accepted_rows"),
    rejection_counts=dict(Counter(r["rejection_reason"] for r in q.get("rows",[]) if r["rejection_reason"])),
    status=report["status"],error=report.get("error"),artifacts=report["artifacts"])
args.output.write_text(json.dumps(summary,indent=2),encoding="utf-8")
print(json.dumps(summary,indent=2))
