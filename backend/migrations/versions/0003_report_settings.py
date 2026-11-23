"""Persist administrator report branding separately from role memberships."""
from alembic import op
import sqlalchemy as sa

revision = "0003_report_settings"
down_revision = "0002_admins"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("cloud_report_settings",
        sa.Column("user_uid", sa.String(128), sa.ForeignKey("cloud_users.uid"), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False))
    if op.get_bind().dialect.name == "postgresql":
        op.execute("""DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cinnai_runtime') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON cloud_report_settings TO cinnai_runtime;
          END IF;
        END $$;""")


def downgrade():
    op.drop_table("cloud_report_settings")
