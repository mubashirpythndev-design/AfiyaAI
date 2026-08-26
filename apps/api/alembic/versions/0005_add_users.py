"""Add users table for email + password auth.

Purely additive: creates ONE new table plus ONE unique index on email.
No existing table or column is altered, dropped, or renamed — medicines,
medicine_prices, mrp_reference, drap_alerts, knowledge_chunks, embeddings,
and sources are all untouched.

Design notes (future-proofing, nothing built yet):
- ``password_hash`` is NULLABLE to leave room for OAuth providers
  (Google sign-in later via a future additive auth_accounts table).
- ``is_verified`` is reserved for future email verification / password
  reset flows; it is not enforced anywhere in this build.
- ``id`` is a String(36) UUID primary key, matching every other table in
  this repo (works on both PostgreSQL and SQLite).

Idempotent upgrade (safe to re-run); downgrade drops the index and table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "users"
INDEX_EMAIL = "ix_users_email"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "is_verified", sa.Boolean(), nullable=False, server_default=sa.false()
            ),
        )

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX_EMAIL not in index_names:
        op.create_index(INDEX_EMAIL, TABLE, ["email"], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX_EMAIL in index_names:
        op.drop_index(INDEX_EMAIL, table_name=TABLE)

    op.drop_table(TABLE)
