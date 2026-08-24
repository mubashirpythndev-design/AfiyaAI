"""Add canonical DRAP registration key to medicines (additive only).

Phase-0 enriched-data integration. Adds a nullable ``drap_reg_no`` column
(canonical DRAP Registration_No key) plus a unique index on ``medicines``.

Existing columns (``generic_name``, ``strength``, ``dosage_form`` already
cover the enriched Generic/Strength/Form fields) are NOT dropped, renamed,
or retyped. Prices and all existing data stay untouched.

The migration is idempotent: safe to run against databases where the
column/index already exist (e.g. freshly created via ``Base.metadata
.create_all`` after the ORM model picked up the new column).

Revision ID: 0001
Revises:
Create Date: 2026-08-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "medicines"
COLUMN = "drap_reg_no"
INDEX = "uq_medicines_drap_reg_no"


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        raise RuntimeError(
            f"Table '{TABLE}' not found. Create the schema first "
            "(app startup init_db / db/migrations/001_initial_schema.sql), "
            "then run this migration."
        )

    columns = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN not in columns:
        op.add_column(
            TABLE,
            sa.Column(COLUMN, sa.String(length=64), nullable=True),
        )

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX not in index_names:
        op.create_index(INDEX, TABLE, [COLUMN], unique=True)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if not inspector.has_table(TABLE):
        return

    index_names = {ix["name"] for ix in inspector.get_indexes(TABLE)}
    if INDEX in index_names:
        op.drop_index(INDEX, table_name=TABLE)

    columns = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN in columns:
        # batch mode: required for DROP COLUMN on SQLite; native ALTER on Postgres
        with op.batch_alter_table(TABLE) as batch_op:
            batch_op.drop_column(COLUMN)
