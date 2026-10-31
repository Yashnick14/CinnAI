"""Cloud profiles, devices, ownership, telemetry and immutable saved metadata."""
from alembic import op
import sqlalchemy as sa
revision = "0001_cloud"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("cloud_users", sa.Column("uid", sa.String(128), primary_key=True),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("cloud_devices", sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("credential_hash", sa.String(64), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("pair_hash", sa.String(64), unique=True),
        sa.Column("pair_expires_at", sa.DateTime(timezone=True)),
        sa.Column("last_pair_at", sa.DateTime(timezone=True)),
        sa.Column("last_received_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("cloud_device_owners",
        sa.Column("device_id", sa.String(64), sa.ForeignKey("cloud_devices.id"), primary_key=True),
        sa.Column("user_uid", sa.String(128), sa.ForeignKey("cloud_users.uid"), nullable=False),
        sa.Column("paired_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_cloud_device_owners_user_uid", "cloud_device_owners", ["user_uid"])
    op.create_table("cloud_readings", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("device_id", sa.String(64), sa.ForeignKey("cloud_devices.id"), nullable=False),
        sa.Column("event_id", sa.String(80), nullable=False), sa.Column("adc", sa.Integer(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("device_id", "event_id"))
    op.create_index("ix_cloud_readings_latest", "cloud_readings", ["device_id", "received_at"])
    op.create_table("cloud_history",
        sa.Column("user_uid", sa.String(128), sa.ForeignKey("cloud_users.uid"), primary_key=True),
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False),
        sa.Column("provenance", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_cloud_history_owner_date", "cloud_history", ["user_uid", "created_at", "id"])

def downgrade():
    for table in ["cloud_history", "cloud_readings", "cloud_device_owners", "cloud_devices", "cloud_users"]:
        op.drop_table(table)
