from alembic import context
from app.cloud.database import sessions, Base
from app.cloud import models  # noqa
# No DSN in ini or logs. Same verify-full policy as the running service.
engine = sessions().kw["bind"]
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
