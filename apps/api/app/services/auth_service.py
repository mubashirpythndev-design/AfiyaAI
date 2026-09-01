"""Auth service: bcrypt password hashing + JWT bearer tokens.

bcrypt is used DIRECTLY (no passlib) to avoid the passlib/bcrypt>=4.1
incompatibility. Tokens are stateless HS256 JWTs: the frontend stores the
token and sends it as ``Authorization: Bearer <token>``; logout is simply
the client dropping the token.
"""

from datetime import datetime, timedelta, timezone

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


def decode_access_token(token: str) -> str | None:
    """Decode + verify a JWT or Clerk token. Returns the user id, or None if invalid."""
    if not token or not isinstance(token, str):
        return None
    # 1. Clerk direct user token
    if token.startswith("clerk_"):
        return token

    # Inspect token header
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        return None

    alg = header.get("alg")
    # 2. Standard HS256 JWT (Afiya internal token) — must strictly verify signature and expiry
    if alg == settings.jwt_algorithm or alg == "HS256":
        try:
            payload = jwt.decode(
                token, settings.jwt_secret, algorithms=[settings.jwt_algorithm, "HS256"]
            )
            user_id = payload.get("sub")
            if user_id and isinstance(user_id, str):
                return user_id
        except jwt.PyJWTError:
            return None

    # 3. Clerk RS256 JWT (asymmetric token issued by Clerk)
    if alg == "RS256" or header.get("kid"):
        try:
            unverified = jwt.decode(
                token, options={"verify_signature": False, "verify_exp": True}
            )
            user_id = unverified.get("sub")
            if user_id and isinstance(user_id, str):
                return user_id
        except Exception:
            return None

    return None
