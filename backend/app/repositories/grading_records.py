from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.grading_record import GradingRecord
from app.schemas.grading import GradingResult

class GradingRecordRepository:
    def __init__(self, session: Session):
        self.session = session

    def save(self, result: GradingResult, image_filename: str, content_type: str) -> GradingRecord:
        payload = result.model_dump(mode="json")
        record = GradingRecord(
            id=str(result.id), timestamp=result.timestamp, is_mock=result.is_mock,
            final_grade=result.final_grade, visual_prediction=result.visual_prediction,
            diameter_mm=result.diameter_mm, moisture_percent=result.moisture_percent,
            final_status=result.final_status,
            detected_quill_count=result.detected_quill_count,
            image_filename=image_filename, image_content_type=content_type,
            result_payload=payload,
        )
        try:
            self.session.add(record)
            self.session.commit()
            self.session.refresh(record)
        except Exception:
            self.session.rollback()
            raise
        return record

    def get(self, record_id: UUID) -> GradingRecord | None:
        return self.session.get(GradingRecord, str(record_id))

    def list(self, limit: int = 100, offset: int = 0) -> list[GradingRecord]:
        statement = (
            select(GradingRecord)
            .order_by(GradingRecord.timestamp.desc())
            .offset(offset).limit(limit)
        )
        return list(self.session.scalars(statement))
