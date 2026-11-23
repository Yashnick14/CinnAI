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
