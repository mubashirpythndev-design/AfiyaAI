"""Add overcharge_reports table for pharmacy price gouging reports.

Purely additive: creates ONE new table `overcharge_reports` with indexes on
`medicine_id` and `city`. FKs point to `medicines.id` (CASCADE) and
`users.id` (SET NULL).

No existing table or column is altered, dropped, or renamed — medicines,
mrp_reference, drap_alerts, users, and every other table are untouched.

Idempotent upgrade (safe to re-run); downgrade drops ONLY the
`overcharge_reports` table.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "overcharge_reports"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column(
                "medicine_id",
                sa.String(length=36),
                sa.ForeignKey("medicines.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "reported_by_user_id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("pharmacy_name", sa.String(length=255), nullable=False),
            sa.Column("city", sa.String(length=100), nullable=False),
            sa.Column("price_paid", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("notified_mrp", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("mrp_effective_date", sa.Date(), nullable=True),
            sa.Column("overcharge_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=10), nullable=False, server_default="PKR"),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("idx_overcharge_medicine", TABLE, ["medicine_id"])
        op.create_index("idx_overcharge_city", TABLE, ["city"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if inspector.has_table(TABLE):
        op.drop_index("idx_overcharge_city", table_name=TABLE)
        op.drop_index("idx_overcharge_medicine", table_name=TABLE)
        op.drop_table(TABLE)
