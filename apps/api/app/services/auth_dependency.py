"""The SINGLE auth gate primitive.

Every protected route depends on ``get_current_user`` and nothing else, so
relocating the login requirement later (e.g. a whole-app gate) is a matter
of moving this one dependency — not rewriting auth checks.
"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_admin_emails_set, settings
from app.db.database import User, get_db
from app.services.auth_service import verify_token_payload, fetch_clerk_user_info


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_clerk_user_email: str | None = Header(default=None),
    x_clerk_user_name: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve ``Authorization: Bearer <token>`` to the logged-in user.

    Strictly verifies cryptographic signatures (Afiya HS256 or Clerk RS256 JWKS).
    Unverified client headers are NEVER trusted for authentication or admin rights.
    Admin rights are strictly gated by exact match against ADMIN_EMAILS.
    """
    auth = authorization if isinstance(authorization, str) else None

    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth.split(" ", 1)[1].strip()
    payload = verify_token_payload(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    # If user doesn't exist by ID, handle verified Clerk token auto-provisioning
    if user is None and (user_id.startswith("user_") or "clerk" in payload.get("iss", "")):
        verified_email: str | None = None
        verified_name: str | None = None

        # 1. Check verified claims inside the signed JWT
        if payload.get("email"):
            verified_email = str(payload["email"]).strip()
        elif payload.get("primary_email"):
            verified_email = str(payload["primary_email"]).strip()

        if payload.get("name"):
            verified_name = str(payload["name"]).strip()

        # 2. If email not in JWT claims and server secret key is configured, verify via Clerk API
        if not verified_email and settings.clerk_secret_key:
            clerk_info = await fetch_clerk_user_info(user_id)
            if clerk_info:
                verified_email = clerk_info.get("email")
                verified_name = clerk_info.get("name")

        email = (verified_email or f"{user_id}@clerk.user").lower()
        name = verified_name or "User"

        # Check if user already exists by verified email
        result_email = await db.execute(select(User).where(User.email == email))
        user = result_email.scalar_one_or_none()
        if user is None:
            # Strictly verify admin: exact match in get_admin_emails_set() only
            is_admin = bool(verified_email and verified_email.lower() in get_admin_emails_set())
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

    # Sync verified email & admin status for existing Clerk users if placeholder or newly granted admin
    if (user.email.endswith("@clerk.user") or not user.is_admin) and (user.id.startswith("user_") or "clerk" in payload.get("iss", "")):
        verified_email = None
        if payload.get("email"):
            verified_email = str(payload["email"]).strip()
        elif settings.clerk_secret_key:
            clerk_info = await fetch_clerk_user_info(user.id)
            if clerk_info and clerk_info.get("email"):
                verified_email = clerk_info["email"]
                if clerk_info.get("name"):
                    user.name = clerk_info["name"]

        if verified_email:
            user.email = verified_email.lower()
            if user.email in get_admin_emails_set():
                user.is_admin = True
            await db.commit()
            await db.refresh(user)

    # Sync admin status: Promote if exact email is in get_admin_emails_set()
    admin_set = get_admin_emails_set()
    if not user.is_admin and user.email and user.email.lower() in admin_set:
        user.is_admin = True
        await db.commit()

    return user


async def get_optional_current_user(
    authorization: str | None = Header(default=None),
    x_clerk_user_email: str | None = Header(default=None),
    x_clerk_user_name: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional auth dependency: returns User if valid Bearer token provided, None otherwise.

    Allows public endpoints (such as medicine info and price comparison) to remain
    accessible to guest visitors and judges without failing on expired or missing tokens.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return await get_current_user(
            authorization=authorization,
            x_clerk_user_email=x_clerk_user_email,
            x_clerk_user_name=x_clerk_user_name,
            db=db,
        )
    except HTTPException:
        return None
