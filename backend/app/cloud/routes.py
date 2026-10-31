"""New authenticated, opt-in API. Existing inference contracts are untouched."""
import json
import secrets
from datetime import timedelta, timezone
from typing import Annotated, Any
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, StrictInt, field_validator
from sqlalchemy import select
from .auth import user_uid, device_auth, digest
from .database import get_session
from .models import User, Device, Ownership, Reading, History, now

router = APIRouter(prefix="/cloud", tags=["cloud"])

def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

def ensure_user(s, uid):
    user = s.get(User, uid)
    if not user:
        # PostgreSQL concurrency-safe insert; sqlite is only used by unit tests.
        if s.bind.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
            s.execute(insert(User).values(uid=uid, display_name="", created_at=now()).on_conflict_do_nothing())
        else:
            s.add(User(uid=uid)); s.flush()
    return s.get(User, uid)

def owned(s, uid, device_id):
    owner = s.get(Ownership, device_id)
    if not owner or owner.user_uid != uid:
        raise HTTPException(404, "Device not found.")
    return s.get(Device, device_id)

class ProfileInput(BaseModel):
    display_name: str = Field(max_length=100)

@router.post("/profile")
def profile(body: ProfileInput, uid=Depends(user_uid), s=Depends(get_session)):
    user = ensure_user(s, uid)
    user.display_name = body.display_name.strip()
    s.commit()
    return {"uid": uid, "display_name": user.display_name}

class Telemetry(BaseModel):
    device_id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    event_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    adc: StrictInt = Field(ge=0, le=4095)

def reading_json(r, at=None):
    at = at or now()
    age = max(0, (at - aware(r.received_at)).total_seconds())
    return {"id": r.id, "device_id": r.device_id, "adc": r.adc, "percentage": None,
            "status": "PASS_PROVISIONAL" if r.adc >= 2842 else "FAIL_PROVISIONAL",
            "received_at": aware(r.received_at).isoformat(), "server_time": at.isoformat(),
            "age_ms": int(age * 1000), "stale": age > 30}

@router.post("/telemetry")
def telemetry(body: Telemetry, device=Depends(device_auth), s=Depends(get_session)):
    if body.device_id != device.id:
        raise HTTPException(403, "Device ID does not match credential.")
    d = s.scalar(select(Device).where(Device.id == device.id).with_for_update())
    s.refresh(d)  # Recheck revocation after obtaining row lock.
    if d.revoked:
        raise HTTPException(401, "Device credential revoked.")
    existing = s.scalar(select(Reading).where(Reading.device_id == d.id, Reading.event_id == body.event_id))
    if existing:
        if existing.adc != body.adc:
            raise HTTPException(409, "Event ID already used.")
        return reading_json(existing)
    timestamp = now()
    if d.last_received_at and (timestamp - aware(d.last_received_at)).total_seconds() < 2:
        raise HTTPException(429, "Send at most one reading every two seconds.", headers={"Retry-After": "2"})
    r = Reading(id=str(uuid4()), device_id=d.id, event_id=body.event_id, adc=body.adc, received_at=timestamp)
    d.last_received_at = timestamp
    s.add(r); s.commit()
    return reading_json(r)

@router.post("/device/pair-code")
def pair_code(device=Depends(device_auth), s=Depends(get_session)):
    d = s.scalar(select(Device).where(Device.id == device.id).with_for_update())
    s.refresh(d)
    if d.revoked:
        raise HTTPException(401, "Device credential revoked.")
    if s.get(Ownership, d.id):
        raise HTTPException(409, "Device already paired. Owner must unpair first.")
    if d.last_pair_at and (now() - aware(d.last_pair_at)).total_seconds() < 60:
        raise HTTPException(429, "Wait before requesting another code.", headers={"Retry-After": "60"})
    code = secrets.token_hex(16)
    d.pair_hash = digest(code)
    d.last_pair_at = now(); d.pair_expires_at = now() + timedelta(minutes=10)
    s.commit()
    return {"code": code, "expires_at": d.pair_expires_at}

class PairInput(BaseModel):
    code: str = Field(pattern="^[a-f0-9]{32}$")

@router.post("/devices/pair")
def pair(body: PairInput, uid=Depends(user_uid), s=Depends(get_session)):
    d = s.scalar(select(Device).where(Device.pair_hash == digest(body.code)).with_for_update())
    if not d or d.revoked or not d.pair_expires_at or aware(d.pair_expires_at) < now():
        raise HTTPException(400, "Pairing code is invalid or expired.")
    if s.get(Ownership, d.id):
        raise HTTPException(409, "Device already paired.")
    ensure_user(s, uid)
    s.add(Ownership(device_id=d.id, user_uid=uid))
    d.pair_hash = None; d.pair_expires_at = None
    s.commit()
    return {"id": d.id, "name": d.name}

@router.get("/devices")
def devices(uid=Depends(user_uid), s=Depends(get_session)):
    rows = s.scalars(select(Device).join(Ownership, Device.id == Ownership.device_id)
                     .where(Ownership.user_uid == uid).order_by(Device.id)).all()
    return [{"id": d.id, "name": d.name, "revoked": d.revoked} for d in rows]

@router.get("/devices/{device_id}/latest")
def latest(device_id: str, response: Response, uid=Depends(user_uid), s=Depends(get_session)):
    d = owned(s, uid, device_id)
    response.headers["Cache-Control"] = "no-store"
    if d.revoked:
        return {"reading": None, "state": "revoked"}
    ownership = s.get(Ownership, device_id)
    r = s.scalar(select(Reading).where(Reading.device_id == device_id, Reading.received_at >= ownership.paired_at).order_by(Reading.received_at.desc()).limit(1))
    return {"reading": reading_json(r) if r else None, "state": "available" if r else "missing"}

@router.post("/devices/{device_id}/unpair")
def unpair(device_id: str, uid=Depends(user_uid), s=Depends(get_session)):
    d = owned(s, uid, device_id)
    d.pair_hash = None; d.pair_expires_at = None
    s.delete(s.get(Ownership, device_id)); s.commit()
    return {"status": "unpaired"}

@router.post("/devices/{device_id}/revoke")
def revoke(device_id: str, uid=Depends(user_uid), s=Depends(get_session)):
    d = owned(s, uid, device_id)
    d.revoked = True; d.pair_hash = None; d.pair_expires_at = None
    s.commit()
    return {"status": "revoked"}

class HistoryInput(BaseModel):
    record: dict[str, Any]

    @field_validator("record")
    @classmethod
    def validate_record(cls, r):
        UUID(r.get("id", ""))
        if len(json.dumps(r, allow_nan=False).encode()) > 65536:
            raise ValueError("Record exceeds 64 KiB")
        # Photos remain local; do not leak sandbox paths or embed large data URIs.
        r.pop("imageUri", None)
        return r

@router.post("/history")
def save_history(body: HistoryInput, uid=Depends(user_uid), s=Depends(get_session)):
    ensure_user(s, uid)
    key = (uid, body.record["id"])
    record = s.get(History, key)
    if not record:
        # Immutable/idempotent save, scoped by owner. Metadata is a client-saved
        # assessment, NOT a server-attested grading certificate.
        if s.bind.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
            s.execute(insert(History).values(user_uid=uid, id=key[1], payload=body.record,
                provenance="client_saved_assessment", created_at=now()).on_conflict_do_nothing())
        else:
            s.add(History(user_uid=uid, id=key[1], payload=body.record))
        s.commit(); record = s.get(History, key)
    return {"id": record.id, "_deleted": True} if record.deleted else record.payload

@router.get("/history")
def list_history(uid=Depends(user_uid), s=Depends(get_session),
                 offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)):
    records = s.scalars(select(History).where(History.user_uid == uid)
                        .order_by(History.created_at.desc(), History.id).offset(offset).limit(limit)).all()
    return [{"id": r.id, "_deleted": True} if r.deleted else r.payload for r in records]

@router.post("/history/{record_id}/delete")
def delete_history(record_id: UUID, uid=Depends(user_uid), s=Depends(get_session)):
    record = s.get(History, (uid, str(record_id)))
    if record:
        record.deleted = True
    else:
        ensure_user(s, uid)
        s.add(History(user_uid=uid, id=str(record_id), payload={"id": str(record_id)}, deleted=True))
    s.commit()
    return {"status": "deleted"}
