"""Report branding authorization, persistence and upload validation."""
import base64
import io
import pytest
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.cloud.database import Base
from app.cloud.models import User
from app.cloud.report_settings import ReportSettingsInput
from app.cloud.routes import get_report_settings, save_report_settings


def test_branding_isolated_and_removable():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all([User(uid='a'), User(uid='b')])
        session.commit()
        assert get_report_settings('a', session)['company_name'] == ''
        body = ReportSettingsInput(company_name=' Cinnamon Co ')
        save_report_settings(body, 'a', session)
        assert get_report_settings('a', session)['company_name'] == 'Cinnamon Co'
        assert get_report_settings('b', session)['company_name'] == ''
        save_report_settings(ReportSettingsInput(), 'a', session)
        assert get_report_settings('a', session)['logo_data_url'] is None


def test_logo_resized_and_reencoded():
    raw = io.BytesIO()
    Image.new('RGB', (1600, 800), 'brown').save(raw, format='JPEG')
    value = 'data:image/jpeg;base64,' + base64.b64encode(raw.getvalue()).decode()
    result = ReportSettingsInput(logo_data_url=value).logo_data_url
    assert result.startswith('data:image/png;base64,')
    with Image.open(io.BytesIO(base64.b64decode(result.split(',')[1]))) as image:
        assert image.size == (800, 400)


@pytest.mark.parametrize('value', ['https://example.com/logo.png', 'data:image/svg+xml;base64,abcd', 'data:image/png;base64,abcd'])
def test_invalid_logo_rejected(value):
    with pytest.raises(ValidationError):
        ReportSettingsInput(logo_data_url=value)

def test_migration_upgrade_and_downgrade():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect

    engine = create_engine('sqlite://')
    path = Path(__file__).parents[1] / 'migrations/versions/0003_report_settings.py'
    spec = importlib.util.spec_from_file_location('branding_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.begin() as connection:
        User.__table__.create(connection)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert 'cloud_report_settings' in inspect(connection).get_table_names()
        migration.downgrade()
        assert 'cloud_report_settings' not in inspect(connection).get_table_names()


def test_visibility_defaults_and_roundtrip():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    assert ReportSettingsInput(company_name='Existing').show_company_name is True
    with Session(engine) as session:
        session.add(User(uid='admin'))
        session.commit()
        body = ReportSettingsInput(company_name='Retained company', show_company_name=False,
            show_logo=False, show_address=False, show_phone=False, show_email=False)
        save_report_settings(body, 'admin', session)
        saved = get_report_settings('admin', session)
        assert saved['company_name'] == 'Retained company'
        for key in ('logo', 'company_name', 'address', 'phone', 'email'):
            assert saved['show_' + key] is False
        save_report_settings(ReportSettingsInput(**{**saved, 'show_company_name': True}), 'admin', session)
        assert get_report_settings('admin', session)['show_company_name'] is True
    with pytest.raises(ValidationError):
        ReportSettingsInput(show_logo='false')


def test_export_quality_preference_persists():
    assert ReportSettingsInput().include_non_export_quality is False
    engine = create_engine('sqlite://')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(User(uid='admin'))
        session.commit()
        for enabled in (True, False):
            save_report_settings(ReportSettingsInput(include_non_export_quality=enabled), 'admin', session)
            assert get_report_settings('admin', session)['include_non_export_quality'] is enabled


def test_ten_mb_logo_limit_and_email_roundtrip():
    from app.cloud.report_settings import MAX_LOGO_BYTES
    raw = io.BytesIO()
    Image.new('RGB', (20, 20), 'brown').save(raw, format='PNG')
    data = raw.getvalue().ljust(MAX_LOGO_BYTES, b'\0')
    value = 'data:image/png;base64,' + base64.b64encode(data).decode()
    body = ReportSettingsInput(email='quality@example.com', logo_data_url=value)
    assert body.email == 'quality@example.com'
    assert len(body.logo_data_url) < 1000
    with pytest.raises(ValidationError):
        ReportSettingsInput(logo_data_url='data:image/png;base64,' + base64.b64encode(data+b'0').decode())


def test_report_upload_body_limit_is_scoped_and_counts_chunks():
    from app.cloud.limits import CloudBodyLimit
    from app.cloud.report_settings import MAX_LOGO_DATA_URL_LENGTH

    async def run(path, size):
        messages = []
        chunks = iter([{'type': 'http.request', 'body': b'x' * (size//2), 'more_body': True},
                       {'type': 'http.request', 'body': b'x' * (size-size//2), 'more_body': False}])
        async def receive():
            return next(chunks)
        async def send(message):
            messages.append(message)
        async def app(scope, receive, send):
            assert len((await receive())['body']) == size
            await send({'type': 'http.response.start', 'status': 204, 'headers': []})
        await CloudBodyLimit(app)({'type': 'http', 'path': path, 'method': 'PUT'}, receive, send)
        return messages[0]['status']
    def execute(coroutine):
        # These in-memory ASGI mocks never suspend on I/O, so no socket-based
        # event loop is needed for this middleware unit test on Windows.
        try:
            coroutine.send(None)
        except StopIteration as completed:
            return completed.value
        finally:
            coroutine.close()
        raise AssertionError("Unexpected I/O suspension in in-memory ASGI test")

    assert execute(run('/cloud/admin/report-settings', MAX_LOGO_DATA_URL_LENGTH + 1000)) == 204
    assert execute(run('/cloud/admin/report-settings', MAX_LOGO_DATA_URL_LENGTH + 16385)) == 413
    assert execute(run('/cloud/history', 131073)) == 413
