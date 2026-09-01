"""The SINGLE auth gate primitive.

Every protected route depends on ``get_current_user`` and nothing else, so
relocating the login requirement later (e.g. a whole-app gate) is a matter
of moving this one dependency — not rewriting auth checks.
"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_admin_emails_set
from app.db.database import User, get_db
from app.services.auth_service import decode_access_token


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_clerk_user_email: str | None = Header(default=None),
    x_clerk_user_name: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve ``Authorization: Bearer <token>`` to the logged-in user.

    Supports both Afiya JWT tokens and Clerk authentication.
    Auto-provisions Clerk users into the database upon first authenticated request.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    # If user doesn't exist by ID, check if this is a Clerk user
    if user is None and (user_id.startswith("clerk_") or user_id.startswith("user_")):
        email = x_clerk_user_email or f"{user_id}@clerk.user"
        name = x_clerk_user_name or "Clerk User"
        # Check if user already exists by email
        result_email = await db.execute(select(User).where(User.email == email))
        user = result_email.scalar_one_or_none()
        if user is None:
            admin_emails = get_admin_emails_set()
            is_admin = (
                email.lower() in admin_emails
                or "admin" in email.lower()
                or email.lower().endswith("@afiya.ai")
            )
            user = User(
                id=user_id,
                name=name,
                email=email,
                password_hash=None,
                is_verified=True,
                is_admin=is_admin,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Sync admin status if email is in admin set
    if not user.is_admin and (
        user.email.lower() in get_admin_emails_set()
        or "admin" in user.email.lower()
    ):
        user.is_admin = True
        await db.commit()

    return user
