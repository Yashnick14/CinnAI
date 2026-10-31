"""Operator-only provisioning: python -m app.cloud.manage --help.
Use a migration/operator DB identity; never expose this command as HTTP.
"""
import argparse
import json
import secrets
import re
from datetime import timedelta
from pathlib import Path
from sqlalchemy import delete
from .auth import digest
from .database import sessions
from .models import Device, Reading, now

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["provision", "rotate", "revoke", "prune"])
    parser.add_argument("--device")
    parser.add_argument("--output", type=Path, help="New private credential JSON file, never stdout")
    args = parser.parse_args()
    if args.operation != "prune" and not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", args.device or ""):
        parser.error("Supply a valid device ID")
    if args.operation in ["provision", "rotate"] and (not args.output or args.output.exists()):
        parser.error("Supply a NEW private --output file; existing files are never overwritten")
    with sessions()() as s:
        d = s.get(Device, args.device) if args.device else None
        if args.operation == "prune":
            # Telemetry only. Never remove user history or the latest fresh reading.
            s.execute(delete(Reading).where(Reading.received_at < now() - timedelta(days=7)))
        elif args.operation == "revoke":
            if not d: parser.error("Device not found")
            d.revoked = True; d.pair_hash = None; d.pair_expires_at = None
        else:
            if (args.operation == "provision") == bool(d):
                parser.error("Use provision for a new device or rotate for an existing device")
            secret = secrets.token_urlsafe(32)
            if not d:
                d = Device(id=args.device, name="CinnamonGradingSensor", credential_hash=digest(secret))
                s.add(d)
            d.credential_hash = digest(secret); d.revoked = False
            d.pair_hash = None; d.pair_expires_at = None
            # File created exclusively; protect this location with OS user ACLs.
            with args.output.open("x", encoding="utf-8") as f:
                json.dump({"device_id": args.device, "device_token": args.device + "." + secret}, f)
            args.output.chmod(0o600)
        s.commit()
    print("Operation completed. No credentials printed.")

if __name__ == "__main__": main()
