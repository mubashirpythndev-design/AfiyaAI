"""Persist private prescription attachments independently of web instances."""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012_marketplace_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("prescription_attachments"):
        op.create_table(
            "prescription_attachments",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("media_type", sa.String(30), nullable=False),
            sa.Column("size_bytes", sa.Integer, nullable=False),
            sa.Column("content", sa.LargeBinary, nullable=False),
            sa.Column("created_at", sa.DateTime, nullable=False),
            sa.CheckConstraint("size_bytes > 0 AND size_bytes <= 10485760", name="ck_attachment_size"),
        )
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("prescription_attachments")}
    if "ix_prescription_attachments_user_id" not in indexes:
        op.create_index("ix_prescription_attachments_user_id", "prescription_attachments", ["user_id"])


def downgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("prescription_attachments"):
        op.drop_table("prescription_attachments")
