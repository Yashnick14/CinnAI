"""Opt-in cloud storage. No connection or schema changes at application startup."""
import os
from functools import lru_cache
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

class Base(DeclarativeBase):
    pass

def enabled():
    return os.getenv("CLOUD_STORAGE_ENABLED", "false").lower() == "true"

@lru_cache
def sessions():
    url = os.getenv("CLOUD_DATABASE_URL", "")
    if not url:
        raise RuntimeError("Cloud database configuration is missing")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+psycopg" or parsed.query.get("sslmode") != "verify-full":
        raise RuntimeError("Cloud database requires PostgreSQL with sslmode=verify-full")
    engine = create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=2,
                           pool_timeout=10, pool_recycle=300, hide_parameters=True,
                           connect_args={"connect_timeout": 10})
    return sessionmaker(engine, expire_on_commit=False)

def get_session():
    if not enabled():
        raise HTTPException(503, "Cloud storage is not enabled yet.")
    from sqlalchemy.exc import SQLAlchemyError
    try:
        with sessions()() as session:
            yield session
    except (SQLAlchemyError, RuntimeError):
        # Never reflect DSNs, query parameters or database errors to clients.
        raise HTTPException(503, "Cloud storage is temporarily unavailable.") from None
