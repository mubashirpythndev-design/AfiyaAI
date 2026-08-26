"""Admin-only router — registered-users view.

Every endpoint in this router requires a valid JWT AND is_admin == True on
the resolved user row. Non-admins receive HTTP 403. password_hash is NEVER
included in any response schema.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import User, get_db
from app.models.schemas import AdminUserSchema, AdminUsersResponse
from app.services.auth_dependency import get_current_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _require_admin(user: User) -> User:
    """Raise HTTP 403 if the user is not an admin."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/users", response_model=AdminUsersResponse)
async def list_users(
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersResponse:
    """Return all registered users ordered by created_at DESC.

    Only accessible to admins. Never exposes password_hash.
    """
    _require_admin(current_user)

    total = await db.scalar(select(func.count()).select_from(User))

    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()

    users = [
        AdminUserSchema(
            id=u.id,
            name=u.name,
            email=u.email,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
            is_admin=u.is_admin,
        )
        for u in rows
    ]
    return AdminUsersResponse(total=total, users=users)
