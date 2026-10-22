"""Preview/apply database release tasks without exposing credentials.

Defaults to process environment only. --database-env-file explicitly permits
loading only the connection value from a user-selected file. Application
Settings dotenv loading stays disabled in both modes. No Git operations.
"""
import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps/api"


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--database-env-file", type=Path)
    result.add_argument("--apply-migrations", action="store_true")
    result.add_argument("--sync-reference-data", action="store_true")
    result.add_argument("--seed-demo", action="store_true")
    result.add_argument("--snapshot-before-migrate", action="store_true", help="Copy affected rows to a separate schema on PostgreSQL (not an independent backup)")
    result.add_argument("--verify-marketplace", action="store_true", help="Read catalog and analytics through the new service code")
    result.add_argument("--allow-sqlite", action="store_true", help="Permit isolated local verification")
    return result


def database_url(args: argparse.Namespace) -> str:
    from sqlalchemy.engine import make_url

    raw = os.environ.get("AFIYA_ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if args.database_env_file:
        from dotenv import dotenv_values
        values = dotenv_values(args.database_env_file.resolve(strict=True), interpolate=False)
        raw = values.get("AFIYA_ALEMBIC_DATABASE_URL") or values.get("DATABASE_URL")
    if not raw:
        raise ValueError("No database connection configured")
    url = make_url(raw)
    if url.drivername in {"postgres", "postgresql", "postgresql+asyncpg"}:
        url = url.set(drivername="postgresql+asyncpg")
        query = dict(url.query)
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        # libpq's channel_binding is not an asyncpg connect argument.
        query.pop("channel_binding", None)
        url = url.set(query=query)
    elif not (args.allow_sqlite and url.drivername == "sqlite+aiosqlite"):
        raise ValueError("Use PostgreSQL, or explicitly allow local SQLite verification")
    return url.render_as_string(hide_password=False)


def configure(url: str) -> None:
    from pydantic_settings import BaseSettings

    sys.path.insert(0, str(API))
    os.environ["DATABASE_URL"] = url
    os.environ["AFIYA_ALEMBIC_DATABASE_URL"] = url
    # This command does not authenticate users or call an AI service.
    os.environ.setdefault("JWT_SECRET", "release-task-only-not-an-application-secret")
    original = BaseSettings.__init__

    def without_dotenv(self: BaseSettings, *args: object, **kwargs: object) -> None:
        if self.__class__.__module__ == "app.config":
            kwargs["_env_file"] = None
        original(self, *args, **kwargs)

    BaseSettings.__init__ = without_dotenv


async def inspect_database() -> dict:
    from alembic.migration import MigrationContext
    from sqlalchemy import inspect, text
    from app.db.database import Base, engine

    try:
        async with engine.connect() as connection:
            def summary(sync):
                inspector = inspect(sync)
                tables = set(inspector.get_table_names())
                missing = []
                for table in Base.metadata.sorted_tables:
                    if table.name not in tables:
                        missing.append(table.name)
                    else:
                        columns = {column["name"] for column in inspector.get_columns(table.name)}
                        missing.extend(f"{table.name}.{column.name}" for column in table.columns if column.name not in columns)
                duplicates = 0
                if "user_cabinet" in tables:
                    duplicates = sync.scalar(text("SELECT COUNT(*) FROM (SELECT user_id, medicine_id FROM user_cabinet GROUP BY user_id, medicine_id HAVING COUNT(*) > 1) AS duplicates"))
                return {"revisions": list(MigrationContext.configure(sync).get_current_heads()),
                        "missing_schema": missing, "has_base_catalog": "medicines" in tables,
                        "duplicate_cabinet_pairs": duplicates, "table_count": len(tables)}
            result = await connection.run_sync(summary)
            result["counts"] = {}
            for table in Base.metadata.sorted_tables:
                if table.name in {"medicines", "mrp_reference", "store_inventory", "orders", "prescription_attachments"} and table.name not in result["missing_schema"]:
                    result["counts"][table.name] = await connection.scalar(text(f'SELECT COUNT(*) FROM "{table.name}"'))
            if result["has_base_catalog"]:
                dataset = json.loads((ROOT / "afiya_medicine_comparison_dataset_clean.json").read_text(encoding="utf-8-sig"))
                if isinstance(dataset, dict):
                    dataset = dataset.get("medicines", [])
                keys = {str(row.get("Registration_No") or row.get("registration_no") or "").strip() for row in dataset}
                keys.discard("")
                existing = set((await connection.execute(text("SELECT drap_reg_no FROM medicines WHERE drap_reg_no IS NOT NULL"))).scalars())
                result["bundled_registration_count"] = len(keys)
                result["bundled_registrations_present"] = len(keys & existing)
            return result
    finally:
        await engine.dispose()


async def snapshot() -> str:
    """Copy affected rows inside PostgreSQL, with a consistent read snapshot.

    This intentionally makes no claim to be a full pg_dump/independent backup.
    Identifiers are fixed table names or generated hexadecimal UUIDs.
    """
    from sqlalchemy import inspect, text
    from app.db.database import engine
    schema = "afiya_release_snapshot_" + uuid4().hex[:12]
    try:
        async with engine.connect() as connection:
            connection = await connection.execution_options(isolation_level="REPEATABLE READ")
            async with connection.begin():
                if connection.dialect.name != "postgresql":
                    raise ValueError("Safety snapshots require PostgreSQL")
                source = await connection.scalar(text("SELECT current_schema()"))
                quote = connection.dialect.identifier_preparer.quote
                await connection.execute(text(f"CREATE SCHEMA {quote(schema)}"))
                await connection.execute(text(f"REVOKE ALL ON SCHEMA {quote(schema)} FROM PUBLIC"))
                present = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
                for name in ("medicines", "sources", "embeddings", "user_cabinet", "alembic_version"):
                    if name in present:
                        await connection.execute(text(f"CREATE TABLE {quote(schema)}.{quote(name)} AS TABLE {quote(source)}.{quote(name)}"))
        return schema
    finally:
        await engine.dispose()


async def seed(args: argparse.Namespace) -> None:
    from app.db.database import async_session, engine
    try:
        if args.sync_reference_data:
            from app.db.seed_data import seed_if_empty
            from app.db.seed_mrp import seed_mrp_reference
            from app.db.seed_knowledge import seed_knowledge_chunks
            await seed_if_empty()
            async with async_session() as db:
                await seed_mrp_reference(db)
                await seed_knowledge_chunks(db)
        if args.seed_demo:
            from app.db.seed_alerts import seed_drap_alerts
            from app.db.seed_marketplace import seed_marketplace
            async with async_session() as db:
                await seed_drap_alerts(db)
                report = await seed_marketplace(db)
                print(json.dumps({"demo_seed": report}))
    finally:
        await engine.dispose()


async def verify_marketplace() -> dict:
    from app.db.database import async_session, engine
    from app.services.store_catalog import load_catalog, catalog_row
    from app.services.marketplace_admin_service import analytics
    try:
        async with async_session() as db:
            entries = await load_catalog(db)
            rows = [catalog_row(entry, entries) for entry in entries.values()]
            report = await analytics(db)
            return {"catalog_rows": len(rows),
                    "stocked_catalog_rows": sum(row["stock_quantity"] > 0 for row in rows),
                    "demo_orders": report["demo_metrics"]["total_orders_count"],
                    "non_demo_orders": report["real_metrics"]["total_orders_count"],
                    "demo_revenue_pkr": str(report["demo_metrics"]["monthly_revenue_pkr"]),
                    "non_demo_revenue_pkr": str(report["real_metrics"]["monthly_revenue_pkr"])}
    finally:
        await engine.dispose()


def main() -> int:
    args = parser().parse_args()
    try:
        if (args.sync_reference_data or args.seed_demo) and not args.apply_migrations:
            raise ValueError("Data imports require --apply-migrations")
        configure(database_url(args))
        from alembic import command
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        config = Config(str(API / "alembic.ini"))
        config.set_main_option("script_location", str(API / "alembic"))
        head = ScriptDirectory.from_config(config).get_current_head()
        before = asyncio.run(inspect_database())
        print(json.dumps({"mode": "apply" if args.apply_migrations else "preview", "target_head": head, "before": before}, indent=2))
        if not args.apply_migrations:
            if args.verify_marketplace:
                if before["missing_schema"]:
                    raise ValueError("Apply missing schema before verifying marketplace")
                print(json.dumps({"marketplace_verification": asyncio.run(verify_marketplace())}, indent=2))
            return 0
        if not before["has_base_catalog"]:
            raise ValueError("Base catalog schema is absent; review initial provisioning separately")
        if before["duplicate_cabinet_pairs"]:
            raise ValueError("Duplicate cabinet entries need review before migration")
        if args.snapshot_before_migrate and before["revisions"] != [head]:
            print(json.dumps({"same_database_safety_snapshot": asyncio.run(snapshot())}))
        command.upgrade(config, "head")
        after = asyncio.run(inspect_database())
        if after["missing_schema"] or after["revisions"] != [head]:
            raise ValueError("Schema verification failed; no seeders were run")
        asyncio.run(seed(args))
        print(json.dumps({"after": asyncio.run(inspect_database())}, indent=2))
        if args.verify_marketplace:
            print(json.dumps({"marketplace_verification": asyncio.run(verify_marketplace())}, indent=2))
        return 0
    except Exception as exc:
        # DB exceptions may contain connection strings or row contents.
        print(f"Database release stopped ({type(exc).__name__}). No credentials or database row contents printed.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(main())
