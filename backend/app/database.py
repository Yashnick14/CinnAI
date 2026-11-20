from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


# Create the legacy database tables; cloud schema migrations are managed separately.
def create_tables() -> None:
    from app.models.grading_record import GradingRecord  # noqa: F401

    Base.metadata.create_all(engine)


# Yield a legacy database session and close it after the request.
def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
