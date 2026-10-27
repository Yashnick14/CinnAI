from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class GradingRecord(Base):
    __tablename__ = "grading_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False)
    final_grade: Mapped[str | None] = mapped_column(String(32), index=True)
    visual_prediction: Mapped[str | None] = mapped_column(String(32))
    diameter_mm: Mapped[float | None] = mapped_column(Float)
    moisture_percent: Mapped[float | None] = mapped_column(Float)
    final_status: Mapped[str] = mapped_column(String(40), index=True)
    detected_quill_count: Mapped[int] = mapped_column(Integer)
    image_filename: Mapped[str] = mapped_column(String(80), unique=True)
    image_content_type: Mapped[str] = mapped_column(String(32))
    result_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
