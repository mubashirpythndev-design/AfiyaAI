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


async def test_clerk_token_wrong_issuer_rejected(monkeypatch):
    """P0 Security: Clerk token with mismatched issuer must fail verification."""
    from unittest.mock import MagicMock
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    import jwt as pyjwt
    from app.services.auth_service import verify_token_payload

    # Generate a dummy RSA key pair
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_key = private_key.public_key()

    # Mock JWK client returning our test public key
    mock_jwk = MagicMock()
    mock_jwk.key = pub_key
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = mock_jwk
    monkeypatch.setattr("app.services.auth_service._get_clerk_jwk_client", lambda: mock_client)

    # Token signed with wrong issuer
    wrong_iss_token = pyjwt.encode(
        {"sub": "user_123", "iss": "https://malicious-issuer.example.com", "exp": 9999999999},
        pem,
        algorithm="RS256",
        headers={"kid": "test-key-id"},
    )
    payload = verify_token_payload(wrong_iss_token)
    assert payload is None, "Token with mismatched issuer must be rejected"


async def test_client_name_header_not_trusted(auth_db, monkeypatch):
    """P0 Security: Raw X-Clerk-User-Name header must not be trusted when provisioning user."""
    from unittest.mock import AsyncMock
    from app.services import auth_dependency
    from app.db.database import User
    from sqlalchemy import select

    # Mock token payload as verified Clerk token without name claim
    verified_payload = {
        "sub": "user_trust_test_456",
        "iss": "https://pro-alien-4201.clerk.accounts.dev",
        "exp": 9999999999,
    }
    monkeypatch.setattr(auth_dependency, "verify_token_payload", lambda t: verified_payload)
    monkeypatch.setattr(auth_dependency, "fetch_clerk_user_info", AsyncMock(return_value=None))

    async with auth_db() as db:
        user = await auth_dependency.get_current_user(
            authorization="Bearer mock_valid_clerk_token",
            x_clerk_user_name="Malicious Spoofed Name",
            db=db,
        )
        # Display name must default safely to 'User', NOT the browser header
        assert user.name == "User"
        assert user.name != "Malicious Spoofed Name"


async def test_clerk_user_collision_reconciled_with_existing_user(auth_db, monkeypatch):
    """Verify that when a Clerk token comes in for a user whose email matches an existing account,

    the accounts are reconciled without UNIQUE constraint errors, placeholder records are deleted,
    and child data is preserved.
    """
    from unittest.mock import AsyncMock
    from app.services import auth_dependency
    from app.db.database import User, Medicine, UserCabinet
    from sqlalchemy import select

    clerk_id = "user_3Ik5cE8TrOYCYLmtLXyHlmd7Ht1"
    existing_uuid = "01373079-6bde-4168-bc83-82b72c6c841e"
    user_email = "imforextrader991@gmail.com"

    async with auth_db() as db:
        # 1. Pre-populate existing user with email and a medicine in cabinet
        med = Medicine(
            id="test-panadol-id",
            brand_name="Panadol",
            generic_name="Paracetamol",
            dosage_form="Tablet",
            strength="500mg",
        )
        db.add(med)
        primary = User(
            id=existing_uuid,
            name="Mubashir",
            email=user_email,
            password_hash="hash123",
            is_verified=True,
            is_admin=True,
        )
        db.add(primary)
        # Orphaned placeholder created before Clerk email resolution
        placeholder = User(
            id=clerk_id,
            name="User",
            email=f"{clerk_id}@clerk.user",
            password_hash=None,
            is_verified=True,
            is_admin=False,
        )
        db.add(placeholder)
        cab = UserCabinet(
            id="cab-1",
            user_id=existing_uuid,
            medicine_id="test-panadol-id",
        )
        db.add(cab)
        await db.commit()

    # Mock Clerk token returning sub=clerk_id and verified user info
    token_payload = {
        "sub": clerk_id,
        "iss": "https://pro-alien-4201.clerk.accounts.dev",
        "exp": 9999999999,
    }
    monkeypatch.setattr(auth_dependency, "verify_token_payload", lambda t: token_payload)
    monkeypatch.setattr(
        auth_dependency,
        "fetch_clerk_user_info",
        AsyncMock(return_value={"email": user_email, "name": "Mubashir Khalid"}),
    )

    async with auth_db() as db:
        user = await auth_dependency.get_current_user(
            authorization="Bearer valid_clerk_token",
            db=db,
        )
        # Must resolve to the primary user row without crashing
        assert user.id == existing_uuid
        assert user.email == user_email
        assert user.name == "Mubashir Khalid"

        # The placeholder row must be reconciled and cleaned up
        res_place = await db.execute(select(User).where(User.id == clerk_id))
        assert res_place.scalar_one_or_none() is None

        # Cabinet item must still be intact on primary user
        res_cab = await db.execute(select(UserCabinet).where(UserCabinet.user_id == existing_uuid))
        assert res_cab.scalar_one_or_none() is not None


async def test_get_optional_current_user_safe_on_unexpected_error(auth_db, monkeypatch):
    """Optional auth dependency must never bubble unexpected exceptions to public routes."""
    from app.services import auth_dependency
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        auth_dependency,
        "get_current_user",
        AsyncMock(side_effect=RuntimeError("Database transient connection error")),
    )

    async with auth_db() as db:
        res = await auth_dependency.get_optional_current_user(
            authorization="Bearer some_token",
            db=db,
        )
        assert res is None
