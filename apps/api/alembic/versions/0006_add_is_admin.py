"""Add is_admin RBAC flag to the users table.

Purely additive: ONE new NOT NULL column with server default false on the
existing users table. No other table or column is altered, dropped, or
renamed — medicines, medicine_prices, mrp_reference, drap_alerts,
knowledge_chunks, embeddings, sources, and every other users column are
all untouched.

The flag is synced from the ADMIN_EMAILS env var on register/login (the
env var is the single source of truth); it is never accepted from client
input. ``op.batch_alter_table`` is used so the migration behaves
identically on SQLite (dev/tests) and PostgreSQL/Neon (production).

Idempotent upgrade (safe to re-run); downgrade drops ONLY the is_admin
column.

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "users"
COLUMN = "is_admin"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    existing = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN not in existing:
        with op.batch_alter_table(TABLE) as batch_op:
            batch_op.add_column(
                sa.Column(
                    COLUMN,
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    existing = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN in existing:
        with op.batch_alter_table(TABLE) as batch_op:
            batch_op.drop_column(COLUMN)
