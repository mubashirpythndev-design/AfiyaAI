"""Add user_cabinet table for digital medicine cabinet & recall watchdog.

Purely additive: creates ONE new table `user_cabinet` with unique constraint
`uq_user_medicine` on (user_id, medicine_id) and indexes on `user_id` and
`medicine_id`. FKs point to `users.id` (CASCADE) and `medicines.id` (CASCADE).

No existing table or column is altered, dropped, or renamed — medicines,
users, overcharge_reports, drap_alerts, mrp_reference, and every other table
are untouched.

Idempotent upgrade (safe to re-run); downgrade drops ONLY the `user_cabinet` table.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "user_cabinet"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column(
                "user_id",
                sa.String(length=36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "medicine_id",
                sa.String(length=36),
                sa.ForeignKey("medicines.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "medicine_id", name="uq_user_medicine"),
        )
        op.create_index("idx_cabinet_user", TABLE, ["user_id"])
        op.create_index("idx_cabinet_medicine", TABLE, ["medicine_id"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if inspector.has_table(TABLE):
        op.drop_index("idx_cabinet_medicine", table_name=TABLE)
        op.drop_index("idx_cabinet_user", table_name=TABLE)
        op.drop_table(TABLE)
