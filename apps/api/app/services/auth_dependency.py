import asyncio
"""The SINGLE auth gate primitive.

Every protected route depends on ``get_current_user`` and nothing else, so
relocating the login requirement later (e.g. a whole-app gate) is a matter
of moving this one dependency — not rewriting auth checks.
"""

import logging
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_admin_emails_set, settings
from app.db.database import User, UserCabinet, OverchargeReport, UserFeedback, get_db
from app.services.auth_service import verify_token_payload, fetch_clerk_user_info

logger = logging.getLogger(__name__)


async def _reconcile_clerk_user(
    db: AsyncSession,
    placeholder_user: User,
    primary_user: User,
) -> None:
    """Reconcile orphaned placeholder Clerk user into primary email user account."""
    if placeholder_user.id == primary_user.id:
        return

    try:
        # 1. Migrate user_cabinet items, avoiding uq_user_medicine collisions
        cabinet_res = await db.execute(
            select(UserCabinet).where(UserCabinet.user_id == placeholder_user.id)
        )
        cabinet_items = cabinet_res.scalars().all()
        for item in cabinet_items:
            existing = (
                await db.execute(
                    select(UserCabinet).where(
                        UserCabinet.user_id == primary_user.id,
                        UserCabinet.medicine_id == item.medicine_id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                await db.delete(item)
            else:
                item.user_id = primary_user.id

        # 2. Migrate overcharge reports
        overcharge_res = await db.execute(
            select(OverchargeReport).where(OverchargeReport.reported_by_user_id == placeholder_user.id)
        )
        for rep in overcharge_res.scalars().all():
            rep.reported_by_user_id = primary_user.id

        # 3. Migrate feedback
        feedback_res = await db.execute(
            select(UserFeedback).where(UserFeedback.user_id == placeholder_user.id)
        )
        for fb in feedback_res.scalars().all():
            fb.user_id = primary_user.id

        # 4. Delete the orphaned placeholder user
        await db.delete(placeholder_user)
        await db.flush()
    except Exception as e:
        logger.warning(f"Error during Clerk user reconciliation: {e}")


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
    payload = await asyncio.to_thread(verify_token_payload, token)
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

    expected_issuer = settings.clerk_issuer or settings.clerk_jwks_url.replace("/.well-known/jwks.json", "").rstrip("/")
    is_clerk = payload.get("_auth_provider") == "clerk" or ("_auth_provider" not in payload and payload.get("iss") == expected_issuer)
    verified_email: str | None = None
    verified_name: str | None = None

    if is_clerk:
        # 1. Check verified claims inside the signed JWT
        if payload.get("email") and payload.get("email_verified") is True:
            verified_email = str(payload["email"]).strip()
        elif payload.get("primary_email") and payload.get("email_verified") is True:
            verified_email = str(payload["primary_email"]).strip()

        if payload.get("name"):
            verified_name = str(payload["name"]).strip()

        # 2. If email not in JWT claims and server secret key is configured, verify via Clerk API
        if not verified_email:
            clerk_info = await fetch_clerk_user_info(user_id)
            if clerk_info:
                if clerk_info.get("email"):
                    verified_email = str(clerk_info["email"]).strip()
                if clerk_info.get("name") and not verified_name:
                    verified_name = str(clerk_info["name"]).strip()

    # Query existing records
    res_id = await db.execute(select(User).where(User.id == user_id))
    user_by_id = res_id.scalar_one_or_none()

    user_by_email: User | None = None
    if verified_email:
        res_email = await db.execute(
            select(User).where(func.lower(User.email) == verified_email.lower())
        )
        user_by_email = res_email.scalar_one_or_none()
        if user_by_email and user_by_email.id != user_id and not user_by_email.is_verified:
            raise HTTPException(status_code=409, detail="Unverified local account uses this email. Account linking requires trusted review.")

    user: User | None = None

    # Handle reconciliation & selection
    if user_by_id and user_by_email:
        if user_by_id.id == user_by_email.id:
            user = user_by_id
        else:
            # Duplicate collision: reconcile placeholder into primary email user
            await _reconcile_clerk_user(db, placeholder_user=user_by_id, primary_user=user_by_email)
            user = user_by_email
    elif user_by_email:
        user = user_by_email
    elif user_by_id:
        user = user_by_id
        if verified_email and user.email != verified_email.lower():
            user.email = verified_email.lower()
    else:
        # User not found by id or verified email
        if is_clerk:
            email = (verified_email or f"{user_id}@clerk.user").lower()
            name = verified_name or "User"
            is_admin = bool(verified_email and verified_email.lower() in get_admin_emails_set())
            user = User(
                id=user_id,
                name=name,
                email=email,
                password_hash=None,
                is_verified=bool(verified_email),
                is_admin=is_admin,
            )
            db.add(user)
        else:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Sync verified display name from provider
    if verified_name:
        user.name = verified_name

    # Only verified ownership can grant privileges; revoke removed admins immediately.
    if is_clerk:
        user.is_verified = bool(verified_email)
    admin_set = get_admin_emails_set()
    user.is_admin = bool(user.is_verified and user.email and user.email.lower() in admin_set)

    # Safely commit updates with rollback recovery
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as ie:
        await db.rollback()
        logger.warning(f"IntegrityError during user sync, recovering: {ie}")
        if verified_email:
            res_rec = await db.execute(
                select(User).where(func.lower(User.email) == verified_email.lower())
            )
            recovered = res_rec.scalar_one_or_none()
            if recovered:
                if recovered.id != user_id and not recovered.is_verified:
                    raise HTTPException(status_code=409, detail="Account linking requires trusted review")
                recovered.is_admin = bool(recovered.is_verified and recovered.email.lower() in get_admin_emails_set())
                await db.commit()
                user = recovered
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.warning("User authorization sync failed")
        raise HTTPException(status_code=503, detail="Unable to verify account permissions") from exc

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
    except Exception as exc:
        logger.warning(f"Optional auth resolution encountered non-fatal error: {exc}")
        return None
