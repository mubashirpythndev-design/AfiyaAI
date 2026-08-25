"""Add drap_alerts table for Phase-1 Feature B (Authenticity / Alert Checker).

Spec 09 §7.2 — DRAP recall / spurious / substandard / quality alerts.

Purely additive: creates ONE new table plus TWO indexes. No existing table
or column is altered, dropped, or renamed — in particular ``mrp_reference``
(Feature A) and ``medicines`` are untouched, so the §16 rollback stays clean.

Adaptations from the spec DDL to the actual schema (spec 02):
- The spec's DDL calls the table ``drug_alerts``; Phase-1 build prompt §B
  names it ``drap_alerts`` — the prompt name is used here.
- ``medicines.id`` / ``sources.id`` are String(36) UUIDs here (not INT), so
  ``medicine_id`` / ``source_id`` are String(36) FKs.
- ``id SERIAL PRIMARY KEY`` -> String(36) UUID primary key, matching every
  other table in this repo (works on both PostgreSQL and SQLite).
- ``medicine_id`` stays NULLABLE (spec: name-only alerts without a resolved
  medicine row).
- EXTRA column ``is_demo`` (Boolean NOT NULL, server_default TRUE): every
  seeded row is DEMO DATA — never a fabricated real recall, batch, or DRAP
  notice. The default is TRUE on purpose: a future real ingestion pipeline
  must EXPLICITLY set it to FALSE, so nothing can silently surface as a real
  DRAP alert.

Idempotent upgrade (safe to re-run); downgrade drops the indexes and table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "drap_alerts"
INDEX_MEDICINE = "idx_alert_medicine"
INDEX_BATCH = "idx_alert_batch"


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
                nullable=True,  # nullable: name-only alerts (spec 09 §7.2)
            ),
            sa.Column("medicine_name_raw", sa.Text(), nullable=True),
            sa.Column("batch_no", sa.Text(), nullable=True),
            sa.Column("alert_type", sa.Text(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column(
                "source_id",
                sa.String(length=36),
                sa.ForeignKey("sources.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("issued_at", sa.Date(), nullable=True),
            sa.Column(
                "resolved", sa.Boolean(), nullable=False, server_default=sa.false()
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
    if INDEX_MEDICINE not in index_names:
        op.create_index(INDEX_MEDICINE, TABLE, ["medicine_id"])
    if INDEX_BATCH not in index_names:
        op.create_index(INDEX_BATCH, TABLE, ["batch_no"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX_MEDICINE in index_names:
        op.drop_index(INDEX_MEDICINE, table_name=TABLE)
    if INDEX_BATCH in index_names:
        op.drop_index(INDEX_BATCH, table_name=TABLE)

    op.drop_table(TABLE)
