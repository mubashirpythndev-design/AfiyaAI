"""Alembic environment — supports async engines (aiosqlite / asyncpg).

Database URL resolution priority:
  1. sqlalchemy.url already set on the Config (tests set this explicitly)
  2. AFIYA_ALEMBIC_DATABASE_URL environment variable
  3. Application settings DATABASE_URL (apps/api/.env)
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure the apps/api directory is importable regardless of invocation style.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Migrations in this project are hand-written and idempotent; autogenerate
# is not used, so no target metadata is required.
target_metadata = None


def resolve_database_url() -> str:
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url
    url = os.environ.get("AFIYA_ALEMBIC_DATABASE_URL")
    if url:
        return url
    from app.config import settings

    return settings.database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = resolve_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,  # required for column drops on SQLite
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations(url: str) -> None:
    engine = create_async_engine(url, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = resolve_database_url()

    if "+aiosqlite" in url or "+asyncpg" in url:
        asyncio.run(run_async_migrations(url))
        return

    # Plain sync URL (used by the test-suite with sqlite://)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, poolclass=pool.NullPool, connect_args=connect_args)
    with engine.connect() as connection:
        do_run_migrations(connection)
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
