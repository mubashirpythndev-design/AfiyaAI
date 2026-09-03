"""Auth service: bcrypt password hashing + JWT bearer tokens.

bcrypt is used DIRECTLY (no passlib) to avoid the passlib/bcrypt>=4.1
incompatibility. Tokens are stateless HS256 JWTs: the frontend stores the
token and sends it as ``Authorization: Bearer <token>``; logout is simply
the client dropping the token.
"""

from datetime import datetime, timedelta, timezone

import base64
import json
import time
import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (UTF-8)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time bcrypt check; malformed hashes never raise."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except ValueError:
        return False


def create_access_token(user_id: str) -> str:
    """Issue a JWT with sub=user.id and the configured expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


import logging
import httpx
from jwt.exceptions import PyJWTError

logger = logging.getLogger(__name__)

_clerk_jwk_client: jwt.PyJWKClient | None = None


def _get_clerk_jwk_client() -> jwt.PyJWKClient:
    """Lazy initialize and cache PyJWKClient for Clerk's JWKS."""
    global _clerk_jwk_client
    if _clerk_jwk_client is None:
        _clerk_jwk_client = jwt.PyJWKClient(
            settings.clerk_jwks_url,
            cache_jwk_set=True,
            lifespan=3600,
        )
    return _clerk_jwk_client


def verify_token_payload(token: str) -> dict | None:
    """Cryptographically verify an Afiya (HS256) or Clerk (RS256) JWT.

    Returns the verified payload dict, or None if invalid or untrusted.
    Fake or unsigned tokens are strictly rejected.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        return None

    alg = header.get("alg")

    # 1. Standard Afiya HS256 JWT
    if alg == "HS256" or alg == settings.jwt_algorithm:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256", settings.jwt_algorithm],
                options={"verify_exp": True},
                leeway=60,
            )
            return payload
        except PyJWTError:
            return None

    # 2. Clerk RS256 JWT
    if alg == "RS256":
        try:
            jwk_client = _get_clerk_jwk_client()
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_exp": True, "verify_signature": True},
                leeway=60,
            )
            return payload
        except Exception as e:
            logger.warning(f"Clerk RS256 token verification failed: {e}")
            return None

    return None


def decode_access_token(token: str) -> str | None:
    """Decode and verify token, returning verified user_id (sub) or None."""
    payload = verify_token_payload(token)
    if payload:
        user_id = payload.get("sub") or payload.get("user_id")
        if user_id and isinstance(user_id, str):
            return user_id
    return None


async def fetch_clerk_user_info(user_id: str) -> dict | None:
    """Fetch verified user profile from Clerk API if CLERK_SECRET_KEY is configured."""
    if not settings.clerk_secret_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {settings.clerk_secret_key}",
                    "User-Agent": "AfiyaAI-Backend/1.0",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                email = None
                emails = data.get("email_addresses", [])
                primary_id = data.get("primary_email_address_id")
                for em in emails:
                    if em.get("id") == primary_id or not email:
                        email = em.get("email_address")
                name = (
                    f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
                    or data.get("username")
                    or "Clerk User"
                )
                return {"email": email, "name": name}
    except Exception as e:
        logger.warning(f"Failed to fetch Clerk user info for {user_id}: {e}")
    return None

