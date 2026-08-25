"""Add ``embedding vector(768)`` column to ``embeddings`` (chat RAG, pgvector).

Step 2 of the chat-RAG plan: on PostgreSQL (Neon), ``rag_service``
retrieves chunks via cosine distance ``e.embedding <=> query::vector``.
Until now the ``embeddings`` table (created by ``init_db`` create_all,
never by a migration) had NO vector column, so that query could never
work — not even on Neon. This migration adds it.

Purely additive: ONE new nullable column on ONE table. No existing
table or column is altered, dropped, or renamed. No index is created —
the MVP set has ~40 embedding rows, a sequential scan is fine, and an
empty ivfflat/hnsw index would raise lists/row-count issues.

Dialect-guarded (reversible + SQLite-safe):
- PostgreSQL: ``CREATE EXTENSION IF NOT EXISTS vector`` (idempotent),
  then add ``embedding vector(768)`` only if absent.
- SQLite / any other dialect: NO-OP. SQLite cannot host pgvector; local
  dev uses rag_service's plain-SQL fallback, which never reads this
  column.

Downgrade: PostgreSQL drops ONLY the ``embedding`` column (extension
and table are left in place); SQLite NO-OP. Cleanly returns to 0003.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-25

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect, text

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "embeddings"
COLUMN = "embedding"
DIMENSIONS = 768


def _is_postgres(conn) -> bool:
    return conn.dialect.name == "postgresql"


def upgrade() -> None:
    conn = op.get_bind()

    if not _is_postgres(conn):
        # SQLite (local dev) and any other dialect: NO-OP by design.
        return

    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

    inspector = inspect(conn)
    if not inspector.has_table(TABLE):
        raise RuntimeError(
            f"Table '{TABLE}' not found. Create the base schema first "
            "(app startup init_db), then run this migration."
        )

    existing = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN not in existing:
        # Direct DDL: sa has no portable vector type without the pgvector
        # package, and this runs only on PostgreSQL (guarded above).
        conn.execute(
            text(
                f"ALTER TABLE {TABLE} "
                f"ADD COLUMN {COLUMN} vector({DIMENSIONS});"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()

    if not _is_postgres(conn):
        return

    inspector = inspect(conn)
    if not inspector.has_table(TABLE):
        return

    existing = {c["name"] for c in inspector.get_columns(TABLE)}
    if COLUMN in existing:
        op.drop_column(TABLE, COLUMN)
    # The vector extension and the embeddings table are deliberately kept.
