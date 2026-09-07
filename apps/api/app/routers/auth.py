"""Auth router — email + password sign-up / sign-in (JWT bearer tokens).

Scope: email + password ONLY. No Google sign-in and no email verification
in this build; the User model reserves nullable password_hash and an
is_verified flag so both can be added later as small, additive changes.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import User, get_db
from app.config import get_admin_emails_set
from app.models.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserSchema,
)
from app.services.auth_dependency import get_current_user
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def user_to_schema(user: User) -> UserSchema:
    return UserSchema(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create an account and auto-login (returns a fresh access token)."""
    email = req.email.strip().lower()
    name = req.name.strip()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(req.password),
        # RBAC: ADMIN_EMAILS is the single source of truth for is_admin.
        is_admin=email in get_admin_emails_set(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=user_to_schema(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify credentials and issue a token.

    The failure message is deliberately GENERIC — it must never reveal
    whether the email exists.
    """
    email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    # RBAC: re-sync is_admin from ADMIN_EMAILS on every login so adding or
    # removing an email promotes/demotes the user on their next sign-in.
    user.is_admin = email in get_admin_emails_set()
    await db.commit()
    await db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=user_to_schema(user))


@router.get("/me", response_model=UserSchema)
async def me(current_user: User = Depends(get_current_user)):
    """Return the logged-in user (public fields only, never the hash)."""
    return user_to_schema(current_user)
