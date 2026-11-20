"""Verify administrator authorization and report filtering with an isolated database."""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.cloud.auth import admin_uid
from app.cloud.database import Base
from app.cloud.models import User, Admin, History
from app.cloud.routes import permissions, report_records, report_users, router


def test_admin_reports_guard_and_filters():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        s.add_all([User(uid="admin", display_name="Admin"), User(uid="grader", display_name="Grader")])
        s.flush()
        s.add(Admin(user_uid="admin"))
        s.add(History(user_uid="grader", id="record", payload={"id":"record"}))
        s.commit()
        with pytest.raises(HTTPException) as denied:
            admin_uid("grader", s)
        assert denied.value.status_code == 403
        assert admin_uid("admin", s) == "admin"
        assert permissions("grader", s) == {"can_generate_reports": False}
        assert permissions("admin", s) == {"can_generate_reports": True}
        assert len(report_users("admin", s)) == 2
        assert report_records("admin", s, "grader", 0, 100)[0]["user_uid"] == "grader"
        assert report_records("admin", s, "admin", 0, 100) == []
        for route in router.routes:
            if route.path.startswith("/cloud/admin/"):
                assert any(dep.call is admin_uid for dep in route.dependant.dependencies)
