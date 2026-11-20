"""Add explicitly provisioned administrator memberships."""
from alembic import op
import sqlalchemy as sa

revision = "0002_admins"
down_revision = "0001_cloud"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cloud_admins",
        sa.Column("user_uid", sa.String(128), sa.ForeignKey("cloud_users.uid"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("cloud_admins")
