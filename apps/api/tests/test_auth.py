"""Auth tests (Phase 1): bcrypt hashing, JWT issue/verify, and the
register / login / me handlers + get_current_user gate.

Router handlers are called directly with an async session — the same style
as test_price_check.py / test_alert_check.py — against a temp SQLite DB
whose schema comes from Base.metadata.create_all (the dev startup path).
No live LLM is involved anywhere in this module.
"""

from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pytest
import pytest_asyncio
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.db.database import Base, User
from app.models.schemas import LoginRequest, RegisterRequest
from app.routers.auth import login, me, register
from app.services.auth_dependency import get_current_user
from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest_asyncio.fixture
async def auth_db(tmp_path):
    """Fresh SQLite DB with the full ORM schema (incl. users)."""
    db_file = tmp_path / "afiya_auth.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


# ---------------------------------------------------------------------------
# bcrypt: hash != plaintext, verify round-trip (bcrypt used directly)
# ---------------------------------------------------------------------------


def test_bcrypt_hash_is_not_plaintext():
    hashed = hash_password("supersecret1")
    assert hashed != "supersecret1"
    assert hashed.startswith("$2")  # bcrypt marker


def test_bcrypt_verify_round_trip_and_reject():
    hashed = hash_password("supersecret1")
    assert verify_password("supersecret1", hashed)
    assert not verify_password("wrong-password", hashed)
    assert not verify_password("supersecret1", "")  # empty hash never raises


# ---------------------------------------------------------------------------
# JWT: encode/decode round-trip, expiry, tamper rejection
# ---------------------------------------------------------------------------


def test_jwt_encode_decode_round_trip():
    token = create_access_token("u-123")
    assert decode_access_token(token) == "u-123"


def test_jwt_expired_token_rejected():
    payload = {
        "sub": "u-123",
        "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    assert decode_access_token(token) is None


def test_jwt_wrong_secret_rejected():
    payload = {
        "sub": "u-123",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    forged = pyjwt.encode(payload, "not-the-real-secret", algorithm="HS256")
    assert decode_access_token(forged) is None


def test_jwt_garbage_rejected():
    assert decode_access_token("not.a.jwt") is None


# ---------------------------------------------------------------------------
# Request schema validation
# ---------------------------------------------------------------------------


def test_register_rejects_short_password():
    with pytest.raises(ValidationError):
        RegisterRequest(name="Ayesha", email="a@example.com", password="short")


def test_register_rejects_bad_email():
    with pytest.raises(ValidationError):
        RegisterRequest(name="Ayesha", email="not-an-email", password="longenough1")


def test_register_trims_blank_name():
    with pytest.raises(ValidationError):
        RegisterRequest(name="   ", email="a@example.com", password="longenough1")
    req = RegisterRequest(name="  Ayesha  ", email="a@example.com", password="longenough1")
    assert req.name == "Ayesha"


# ---------------------------------------------------------------------------
# register handler
# ---------------------------------------------------------------------------


async def test_register_success_returns_token_and_public_user(auth_db):
    async with auth_db() as db:
        resp = await register(
            RegisterRequest(name="Ayesha", email="Ayesha@Example.com", password="longenough1"),
            db,
        )
    assert resp.token_type == "bearer"
    assert resp.access_token
    assert decode_access_token(resp.access_token) == resp.user.id
    assert resp.user.name == "Ayesha"
    assert resp.user.email == "ayesha@example.com"  # normalized to lowercase
    assert resp.user.created_at is not None
    assert "password_hash" not in resp.user.model_dump()  # never exposed


async def test_register_duplicate_email_409(auth_db):
    req = RegisterRequest(name="Ayesha", email="dup@example.com", password="longenough1")
    async with auth_db() as db:
        await register(req, db)
        with pytest.raises(HTTPException) as exc:
            await register(req, db)
    assert exc.value.status_code == 409
    assert exc.value.detail == "Email already registered"


async def test_register_stores_bcrypt_hash_not_plaintext(auth_db):
    async with auth_db() as db:
        await register(
            RegisterRequest(name="Ayesha", email="h@example.com", password="longenough1"),
            db,
        )
        from sqlalchemy import select
        user = (await db.execute(select(User))).scalar_one()
    assert user.password_hash != "longenough1"
    assert verify_password("longenough1", user.password_hash)
    assert user.is_verified is False  # reserved flag, default False


# ---------------------------------------------------------------------------
# login handler
# ---------------------------------------------------------------------------


async def test_login_success_updates_last_login_at(auth_db):
    async with auth_db() as db:
        await register(
            RegisterRequest(name="Bilal", email="b@example.com", password="longenough1"),
            db,
        )
        resp = await login(LoginRequest(email="b@example.com", password="longenough1"), db)
    assert resp.access_token
    assert resp.user.email == "b@example.com"
    assert resp.user.last_login_at is not None


async def test_login_wrong_password_generic_401(auth_db):
    async with auth_db() as db:
        await register(
            RegisterRequest(name="Bilal", email="b@example.com", password="longenough1"),
            db,
        )
        with pytest.raises(HTTPException) as exc:
            await login(LoginRequest(email="b@example.com", password="WRONGpass99"), db)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid email or password"


async def test_login_unknown_email_same_generic_401(auth_db):
    """Must NEVER reveal whether an email exists: identical message."""
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await login(LoginRequest(email="ghost@example.com", password="longenough1"), db)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid email or password"


# ---------------------------------------------------------------------------
# get_current_user gate + /me
# ---------------------------------------------------------------------------


async def _registered_user(factory):
    async with factory() as db:
        resp = await register(
            RegisterRequest(name="Sana", email="s@example.com", password="longenough1"),
            db,
        )
    return resp


async def test_me_with_valid_token(auth_db):
    resp = await _registered_user(auth_db)
    async with auth_db() as db:
        user = await get_current_user(
            authorization=f"Bearer {resp.access_token}", db=db
        )
        assert user.id == resp.user.id
        view = await me(current_user=user)
    assert view.email == "s@example.com"
    assert "password_hash" not in view.model_dump()


async def test_get_current_user_missing_header_401(auth_db):
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization=None, db=db)
    assert exc.value.status_code == 401


async def test_get_current_user_garbage_token_401(auth_db):
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization="Bearer garbage.token.here", db=db)
    assert exc.value.status_code == 401


async def test_get_current_user_expired_token_401(auth_db):
    payload = {
        "sub": "any-user-id",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    expired = pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization=f"Bearer {expired}", db=db)
    assert exc.value.status_code == 401


async def test_get_current_user_unknown_user_401(auth_db):
    """Valid signature but the user row does not exist."""
    token = create_access_token("does-not-exist-id")
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization=f"Bearer {token}", db=db)
    assert exc.value.status_code == 401


async def test_fake_clerk_token_rejected_401(auth_db):
    """P0 Security: Fake clerk tokens or unsigned RS256 JWTs must be strictly rejected."""
    async with auth_db() as db:
        # 1. Plain string token bypass attempt
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization="Bearer clerk_user_fake123", db=db)
        assert exc.value.status_code == 401

        # 2. Unsigned / spoofed RS256 JWT attempt
        fake_jwt = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJzdWIiOiJ1c2VyX2JhZGd1eSJ9.ZmFrZXNpZ25hdHVyZQ"
        with pytest.raises(HTTPException) as exc2:
            await get_current_user(authorization=f"Bearer {fake_jwt}", db=db)
        assert exc2.value.status_code == 401


async def test_spoofed_headers_cannot_grant_admin(auth_db):
    """P0 Security: Unverified client headers like X-Clerk-User-Email cannot bypass auth or grant admin."""
    async with auth_db() as db:
        with pytest.raises(HTTPException) as exc:
            await get_current_user(
                authorization="Bearer clerk_user_fake",
                x_clerk_user_email="admin@afiya.ai",
                x_clerk_user_name="Fake Admin",
                db=db,
            )
        assert exc.value.status_code == 401

