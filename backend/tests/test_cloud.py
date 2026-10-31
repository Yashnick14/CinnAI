import importlib.util
from datetime import timedelta
from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, inspect
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.cloud import auth
from app.cloud.routes import router
from app.cloud.database import get_session, Base
from app.cloud.models import Device, Reading, Ownership, now

@pytest.fixture
def cloud(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # Execute the actual versioned migration, not create_all.
    spec = importlib.util.spec_from_file_location("cloud_migration", "migrations/versions/0001_cloud.py")
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    app = FastAPI(); app.include_router(router)
    def db():
        with Session(engine, expire_on_commit=False) as session: yield session
    app.dependency_overrides[get_session] = db
    def verify(token):
        if token not in ["alice", "bob"]: raise ValueError("invalid/expired")
        return token
    monkeypatch.setattr(auth, "verify_firebase", verify)
    with Session(engine) as s:
        s.add(Device(id="probe", name="Probe", credential_hash=auth.digest("secret"))); s.commit()
    yield TestClient(app), engine
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)): migration.downgrade()
        assert not inspect(connection).get_table_names()

def headers(token): return {"Authorization": "Bearer " + token}
def pair(client, user="alice"):
    code = client.post("/cloud/device/pair-code", headers=headers("probe.secret")).json()["code"]
    return client.post("/cloud/devices/pair", headers=headers(user), json={"code": code})

def test_authorization_and_disabled():
    app = FastAPI(); app.include_router(router); c = TestClient(app)
    assert c.get("/cloud/history").status_code == 401
    assert c.post("/cloud/telemetry", json={}).status_code == 503

def test_migration_pair_ownership_and_replay(cloud):
    c, engine = cloud
    assert c.get("/cloud/history", headers=headers("forged")).status_code == 401
    assert pair(c).status_code == 200
    assert len(c.get("/cloud/devices", headers=headers("alice")).json()) == 1
    assert c.get("/cloud/devices", headers=headers("bob")).json() == []
    assert c.get("/cloud/devices/probe/latest", headers=headers("bob")).status_code == 404
    assert c.post("/cloud/devices/probe/revoke", headers=headers("bob")).status_code == 404
    assert c.post("/cloud/device/pair-code", headers=headers("probe.secret")).status_code == 409

@pytest.mark.parametrize("adc,status", [(2842,"PASS_PROVISIONAL"),(2910,"PASS_PROVISIONAL"),(2841,"FAIL_PROVISIONAL")])
def test_telemetry_roundtrip_and_idempotency(cloud, adc, status):
    c, engine = cloud; pair(c)
    body = {"device_id":"probe", "event_id":"boot_1", "adc":adc}
    r = c.post("/cloud/telemetry", headers=headers("probe.secret"), json=body)
    assert r.status_code == 200
    assert r.json()["status"] == status and r.json()["percentage"] is None
    assert c.post("/cloud/telemetry", headers=headers("probe.secret"), json=body).json()["received_at"] == r.json()["received_at"]
    latest = c.get("/cloud/devices/probe/latest", headers=headers("alice"))
    assert latest.json()["reading"]["adc"] == adc
    assert latest.headers["cache-control"] == "no-store"
    assert c.post("/cloud/telemetry", headers=headers("probe.secret"), json={**body,"event_id":"boot_2"}).status_code == 429
    with Session(engine) as s: assert len(s.scalars(select(Reading)).all()) == 1

@pytest.mark.parametrize("adc", [-1,4096,1.5,"2910",True])
def test_invalid_adc(cloud, adc):
    c,_ = cloud
    assert c.post("/cloud/telemetry", headers=headers("probe.secret"), json={"device_id":"probe","event_id":"1","adc":adc}).status_code == 422

def test_missing_stale_revoke_rotation(cloud):
    c,engine = cloud; pair(c)
    assert c.get("/cloud/devices/probe/latest",headers=headers("alice")).json()["reading"] is None
    with Session(engine) as s:
        s.get(Ownership,"probe").paired_at=now()-timedelta(minutes=5)
        s.add(Reading(id=str(uuid4()),device_id="probe",event_id="old",adc=2910,received_at=now()-timedelta(seconds=31))); s.commit()
    assert c.get("/cloud/devices/probe/latest",headers=headers("alice")).json()["reading"]["stale"]
    assert c.post("/cloud/devices/probe/revoke",headers=headers("alice")).status_code == 200
    body={"device_id":"probe","event_id":"2","adc":2910}
    assert c.post("/cloud/telemetry",headers=headers("probe.secret"),json=body).status_code == 401
    with Session(engine) as s:
        d=s.get(Device,"probe");d.credential_hash=auth.digest("rotated");d.revoked=False;s.commit()
    assert c.post("/cloud/telemetry",headers=headers("probe.secret"),json=body).status_code == 401
    assert c.post("/cloud/telemetry",headers=headers("probe.rotated"),json=body).status_code == 200

def test_bad_device_credentials_id_and_expired_pair(cloud):
    c,engine=cloud
    assert c.post("/cloud/device/pair-code",headers=headers("probe.wrong")).status_code == 401
    body={"device_id":"other","event_id":"1","adc":2910}
    assert c.post("/cloud/telemetry",headers=headers("probe.secret"),json=body).status_code == 403
    code=c.post("/cloud/device/pair-code",headers=headers("probe.secret")).json()["code"]
    with Session(engine) as s:
        s.get(Device,"probe").pair_expires_at=now()-timedelta(seconds=1);s.commit()
    assert c.post("/cloud/devices/pair",headers=headers("alice"),json={"code":code}).status_code == 400

def test_history_isolation_idempotent_delete_and_local_photo_strip(cloud):
    c,_=cloud; record={"id":str(uuid4()),"finalGrade":"M4","imageUri":"file:///private.jpg"}
    assert c.post("/cloud/history",headers=headers("alice"),json={"record":record}).status_code == 200
    assert c.get("/cloud/history",headers=headers("bob")).json() == []
    data=c.get("/cloud/history",headers=headers("alice")).json()
    assert len(data)==1 and "imageUri" not in data[0]
    c.post("/cloud/history",headers=headers("alice"),json={"record":{**record,"finalGrade":"H2"}})
    assert c.get("/cloud/history",headers=headers("alice")).json()[0]["finalGrade"] == "M4"
    c.post(f"/cloud/history/{record['id']}/delete",headers=headers("bob"))
    assert c.get("/cloud/history",headers=headers("alice")).json()[0]["finalGrade"] == "M4"
    c.post(f"/cloud/history/{record['id']}/delete",headers=headers("alice"))
    assert c.get("/cloud/history",headers=headers("alice")).json() == [{"id":record["id"],"_deleted":True}]

def test_tls_configuration_rejects_unverified_connection(monkeypatch):
    from app.cloud.database import sessions
    sessions.cache_clear()
    monkeypatch.setenv("CLOUD_DATABASE_URL","postgresql+psycopg://x:y@localhost/db?sslmode=require")
    with pytest.raises(RuntimeError, match="verify-full"): sessions()


def test_new_owner_cannot_read_previous_owners_telemetry(cloud):
    c,engine=cloud; pair(c)
    c.post("/cloud/telemetry",headers=headers("probe.secret"),json={"device_id":"probe","event_id":"1","adc":2910})
    c.post("/cloud/devices/probe/unpair",headers=headers("alice"))
    with Session(engine) as s:
        s.get(Device,"probe").last_pair_at=now()-timedelta(minutes=2);s.commit()
    assert pair(c,"bob").status_code == 200
    assert c.get("/cloud/devices/probe/latest",headers=headers("bob")).json()["reading"] is None
    assert c.get("/cloud/devices/probe/latest",headers=headers("alice")).status_code == 404


def test_postgresql_ddl_compiles_with_constraints():
    from sqlalchemy.schema import CreateTable
    from sqlalchemy.dialects.postgresql import dialect
    for table in Base.metadata.sorted_tables:
        assert "CREATE TABLE" in str(CreateTable(table).compile(dialect=dialect()))


def test_real_postgresql_migration_crud_if_configured(monkeypatch):
    import os
    from sqlalchemy import text
    url = os.getenv("TEST_CLOUD_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_CLOUD_DATABASE_URL for an isolated local PostgreSQL test service")
    engine = create_engine(url)
    schema = "cinnai_test_" + uuid4().hex
    spec = importlib.util.spec_from_file_location("pg_migration", "migrations/versions/0001_cloud.py")
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    with engine.connect() as connection:
        try:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET search_path TO "{schema}"'))
            connection.commit()
            with Operations.context(MigrationContext.configure(connection)): migration.upgrade()
            connection.commit()
            with Session(bind=connection) as s:
                d=Device(id="pg-probe",name="probe",credential_hash=auth.digest("test"))
                s.add(d); s.flush()
                s.add(Reading(id=str(uuid4()),device_id=d.id,event_id="1",adc=2842,received_at=now()));s.commit()
                assert s.scalar(select(Reading.adc)) == 2842
            with Operations.context(MigrationContext.configure(connection)): migration.downgrade()
            connection.commit()
            assert inspect(connection).get_table_names(schema=schema) == []
        finally:
            connection.rollback()
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')); connection.commit()
    engine.dispose()


def test_cloud_json_body_limit():
    from app.cloud.limits import CloudBodyLimit
    app=FastAPI(); app.add_middleware(CloudBodyLimit); app.include_router(router)
    assert TestClient(app).post("/cloud/history",content=b"x"*131073).status_code == 413
