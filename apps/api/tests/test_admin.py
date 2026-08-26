"""Admin endpoint + RBAC promotion logic tests.

Covers:
- Migration 0006 up/down (is_admin column add/drop on SQLite).
- GET /api/admin/users: 401 without token, 403 non-admin, 200 admin.
- password_hash never appears in the response body.
- Promotion: ADMIN_EMAILS drives is_admin on register and login.
- Demotion: removing an email from ADMIN_EMAILS demotes on next login.
- Idempotent re-run of migration 0006 (upgrade head twice).

All tests use temp SQLite DBs — no side-effects on any real database.
"""

import asyncio
import json
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from tests.conftest import create_pre_migration_db, run_alembic

from app.config import settings
from app.db.database import Base, User
from app.models.schemas import LoginRequest, RegisterRequest
from app.routers.auth import login, register
from app.services.auth_dependency import get_current_user
from app.services.auth_service import create_access_token


# ───────────────────────────────────────────────────────────────────────────
# Migration 0006: upgrade / downgrade reversibility
# ───────────────────────────────────────────────────────────────────────────


def test_migration_0006_upgrade_adds_is_admin(tmp_path):
    """Upgrade head creates the is_admin column on the users table."""
    db_file = tmp_path / "admin_mig.db"
    asyncio.run(create_pre_migration_db(db_file))
    run_alembic(db_file, "upgrade", "head")

    import sqlite3

    conn = sqlite3.connect(db_file)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert "users" in tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        assert "is_admin" in cols
        assert "is_verified" in cols  # existing column untouched
    finally:
        conn.close()


def test_migration_0006_downgrade_drops_only_is_admin(tmp_path):
    """Downgrade to 0005 removes ONLY is_admin; users table stays."""
    db_file = tmp_path / "admin_mig_down.db"
    asyncio.run(create_pre_migration_db(db_file))
    run_alembic(db_file, "upgrade", "head")
    run_alembic(db_file, "downgrade", "0005")

    import sqlite3

    conn = sqlite3.connect(db_file)
    try:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert "users" in tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        assert "is_admin" not in cols
        # Other users columns are all intact
        assert {"id", "name", "email", "password_hash", "created_at",
                "last_login_at", "is_verified"}.issubset(cols)
    finally:
        conn.close()


def test_migration_0006_re_upgrade_idempotent(tmp_path):
    """Running upgrade head twice doesn't raise (idempotency guard)."""
    db_file = tmp_path / "admin_mig_idem.db"
    asyncio.run(create_pre_migration_db(db_file))
    run_alembic(db_file, "upgrade", "head")
    run_alembic(db_file, "upgrade", "head")  # must not error


# ───────────────────────────────────────────────────────────────────────────
# Fresh DB fixture (full ORM schema via Base.metadata.create_all)
# ───────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def admin_db(tmp_path):
    db_file = tmp_path / "afiya_admin.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


# ───────────────────────────────────────────────────────────────────────────
# Admin endpoint: 401 / 403 / 200 tests (direct handler calls)
# ───────────────────────────────────────────────────────────────────────────


async def _create_user(factory, email: str, name: str = "Test", is_admin: bool = False) -> tuple:
    """Register a user directly and return (user, token)."""
    async with factory() as db:
        user = User(
            name=name,
            email=email.lower(),
            password_hash="unused",
            is_admin=is_admin,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        token = create_access_token(user.id)
        return user, token


async def test_admin_endpoint_401_without_token(admin_db):
    """No Authorization header → 401."""
    async with admin_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization=None, db=db)
    assert exc.value.status_code == 401


async def test_admin_endpoint_403_non_admin(admin_db):
    """Valid token for a non-admin user → 403."""
    user, token = await _create_user(admin_db, "regular@example.com")
    assert user.is_admin is False

    from app.routers.admin import list_users

    async with admin_db() as db:
        current_user = await get_current_user(
            authorization=f"Bearer {token}", db=db
        )
        with pytest.raises(HTTPException) as exc:
            await list_users(limit=500, offset=0, current_user=current_user, db=db)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin access required"


async def test_admin_endpoint_200_with_admin(admin_db):
    """Admin user sees the user list."""
    await _create_user(admin_db, "user1@example.com", name="User One")
    admin, token = await _create_user(
        admin_db, "admin@example.com", name="Admin", is_admin=True
    )

    from app.routers.admin import list_users

    async with admin_db() as db:
        current_user = await get_current_user(
            authorization=f"Bearer {token}", db=db
        )
        resp = await list_users(limit=500, offset=0, current_user=current_user, db=db)

    assert resp.total == 2
    assert len(resp.users) == 2
    emails = {u.email for u in resp.users}
    assert "user1@example.com" in emails
    assert "admin@example.com" in emails


async def test_admin_endpoint_never_exposes_password_hash(admin_db):
    """password_hash must NEVER appear in the serialized response."""
    _, token = await _create_user(
        admin_db, "admin2@example.com", name="Admin2", is_admin=True
    )

    from app.routers.admin import list_users

    async with admin_db() as db:
        current_user = await get_current_user(
            authorization=f"Bearer {token}", db=db
        )
        resp = await list_users(limit=500, offset=0, current_user=current_user, db=db)

    # Serialize the full response to JSON and assert no hash leakage.
    body = resp.model_dump_json()
    assert "password_hash" not in body
    assert "unused" not in body  # the literal hash value


async def test_admin_endpoint_pagination(admin_db):
    """limit and offset work correctly."""
    for i in range(5):
        await _create_user(admin_db, f"page{i}@example.com", name=f"P{i}")
    _, token = await _create_user(
        admin_db, "pageadmin@example.com", name="PageAdmin", is_admin=True
    )

    from app.routers.admin import list_users

    async with admin_db() as db:
        current_user = await get_current_user(
            authorization=f"Bearer {token}", db=db
        )
        resp = await list_users(limit=2, offset=0, current_user=current_user, db=db)
    assert resp.total == 6  # 5 + admin
    assert len(resp.users) == 2  # only 2 returned


# ───────────────────────────────────────────────────────────────────────────
# RBAC promotion / demotion logic
# ───────────────────────────────────────────────────────────────────────────


async def test_register_promotes_admin_email(admin_db):
    """An email in ADMIN_EMAILS gets is_admin=True on register."""
    with patch("app.routers.auth.get_admin_emails_set", return_value={"boss@example.com"}):
        async with admin_db() as db:
            resp = await register(
                RegisterRequest(name="Boss", email="Boss@Example.com", password="longenough1"),
                db,
            )
    # Check the row directly.
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "boss@example.com"))).scalar_one()
    assert user.is_admin is True


async def test_register_non_admin_email_stays_non_admin(admin_db):
    """An email NOT in ADMIN_EMAILS stays is_admin=False on register."""
    with patch("app.routers.auth.get_admin_emails_set", return_value={"other@example.com"}):
        async with admin_db() as db:
            resp = await register(
                RegisterRequest(name="Normal", email="normal@example.com", password="longenough1"),
                db,
            )
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "normal@example.com"))).scalar_one()
    assert user.is_admin is False


async def test_login_promotes_on_admin_email_addition(admin_db):
    """Adding an email to ADMIN_EMAILS promotes the user on next login."""
    # Register without admin privilege.
    with patch("app.routers.auth.get_admin_emails_set", return_value=set()):
        async with admin_db() as db:
            await register(
                RegisterRequest(name="Later", email="later@example.com", password="longenough1"),
                db,
            )
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "later@example.com"))).scalar_one()
    assert user.is_admin is False

    # Now login with the email in ADMIN_EMAILS → promoted.
    with patch("app.routers.auth.get_admin_emails_set", return_value={"later@example.com"}):
        async with admin_db() as db:
            await login(LoginRequest(email="later@example.com", password="longenough1"), db)
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "later@example.com"))).scalar_one()
    assert user.is_admin is True


async def test_login_demotes_on_admin_email_removal(admin_db):
    """Removing an email from ADMIN_EMAILS demotes the user on next login."""
    # Register as admin.
    with patch("app.routers.auth.get_admin_emails_set", return_value={"ex@example.com"}):
        async with admin_db() as db:
            await register(
                RegisterRequest(name="ExAdmin", email="ex@example.com", password="longenough1"),
                db,
            )
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "ex@example.com"))).scalar_one()
    assert user.is_admin is True

    # Login with the email REMOVED from ADMIN_EMAILS → demoted.
    with patch("app.routers.auth.get_admin_emails_set", return_value=set()):
        async with admin_db() as db:
            await login(LoginRequest(email="ex@example.com", password="longenough1"), db)
    async with admin_db() as db:
        user = (await db.execute(select(User).where(User.email == "ex@example.com"))).scalar_one()
    assert user.is_admin is False
