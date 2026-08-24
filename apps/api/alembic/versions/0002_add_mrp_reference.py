"""Add mrp_reference table for Phase-1 Feature A (MRP / Overcharge Checker).

Spec 09 §7.2 — versioned DRAP-notified MRP baseline per (medicine, pack_size).

Purely additive: creates ONE new table plus ONE index. No existing table or
column is altered, dropped, or renamed (§16 rollback stays clean).

Adaptations from the spec DDL to the actual schema (spec 02):
- ``medicines.id`` / ``sources.id`` are String(36) UUIDs here (not INT), so
  ``medicine_id`` / ``source_id`` are String(36) FKs.
- ``id SERIAL PRIMARY KEY`` -> String(36) UUID primary key, matching every
  other table in this repo (works on both PostgreSQL and SQLite).

Idempotent upgrade (safe to re-run); downgrade drops the index and the table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "mrp_reference"
INDEX = "idx_mrp_medicine"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    for dep in ("medicines", "sources"):
        if not inspector.has_table(dep):
            raise RuntimeError(
                f"Table '{dep}' not found. Create the base schema first "
                "(app startup init_db), then run this migration."
            )

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
            sa.Column("pack_size", sa.Text(), nullable=False),
            sa.Column("notified_mrp", sa.Numeric(10, 2), nullable=False),
            sa.Column(
                "currency", sa.Text(), nullable=False, server_default="PKR"
            ),
            sa.Column("sro_ref", sa.Text(), nullable=True),
            sa.Column("effective_date", sa.Date(), nullable=True),
            sa.Column(
                "source_id",
                sa.String(length=36),
                sa.ForeignKey("sources.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX not in index_names:
        # Latest-MRP lookup: (medicine_id, pack_size, effective_date DESC)
        op.create_index(
            INDEX,
            TABLE,
            ["medicine_id", "pack_size", sa.text("effective_date DESC")],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX in index_names:
        op.drop_index(INDEX, table_name=TABLE)

    op.drop_table(TABLE)
