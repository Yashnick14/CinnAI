from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

def now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "cloud_users"
    uid: Mapped[str] = mapped_column(String(128), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Device(Base):
    __tablename__ = "cloud_devices"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    credential_hash: Mapped[str] = mapped_column(String(64))
    revoked: Mapped[bool] = mapped_column(default=False)
    pair_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    pair_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_pair_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Ownership(Base):
    __tablename__ = "cloud_device_owners"
    device_id: Mapped[str] = mapped_column(ForeignKey("cloud_devices.id"), primary_key=True)
    user_uid: Mapped[str] = mapped_column(ForeignKey("cloud_users.uid"), index=True)
    paired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Reading(Base):
    __tablename__ = "cloud_readings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("cloud_devices.id"))
    event_id: Mapped[str] = mapped_column(String(80))
    adc: Mapped[int] = mapped_column(Integer)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("device_id", "event_id"),
                     Index("ix_cloud_readings_latest", "device_id", "received_at"))

class History(Base):
    __tablename__ = "cloud_history"
    user_uid: Mapped[str] = mapped_column(ForeignKey("cloud_users.uid"), primary_key=True)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    deleted: Mapped[bool] = mapped_column(default=False)
    provenance: Mapped[str] = mapped_column(String(32), default="client_saved_assessment")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("ix_cloud_history_owner_date", "user_uid", "created_at", "id"),)
