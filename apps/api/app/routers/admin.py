"""Admin-only router — registered-users view.

Every endpoint in this router requires a valid JWT AND is_admin == True on
the resolved user row. Non-admins receive HTTP 403. password_hash is NEVER
included in any response schema.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import User, UserFeedback, get_db
from app.models.schemas import (
    AdminUserSchema,
    AdminUsersResponse,
    AdminFeedbackListResponse,
    AdminFeedbackSummarySchema,
    FeedbackResponseSchema,
)
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


@router.get("/feedbacks", response_model=AdminFeedbackListResponse)
async def list_feedbacks(
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    primary_need: str | None = Query(default=None),
    rating: int | None = Query(default=None, ge=1, le=5),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminFeedbackListResponse:
    """Return user feedbacks and aggregated summary stats. Admin-only."""
    _require_admin(current_user)

    # Base query for stats
    total_submissions = await db.scalar(select(func.count()).select_from(UserFeedback)) or 0

    if total_submissions > 0:
        avg_rating = float(await db.scalar(select(func.avg(UserFeedback.rating))) or 5.0)
        rec_count = await db.scalar(
            select(func.count()).select_from(UserFeedback).where(UserFeedback.would_recommend.is_(True))
        ) or 0
        recommend_percentage = round((rec_count / total_submissions) * 100, 1)

        # Top primary need
        top_need_res = await db.execute(
            select(UserFeedback.primary_need, func.count(UserFeedback.id).label("cnt"))
            .group_by(UserFeedback.primary_need)
            .order_by(func.count(UserFeedback.id).desc())
            .limit(1)
        )
        top_need_row = top_need_res.first()
        top_primary_need = top_need_row[0] if top_need_row else None
    else:
        avg_rating = 5.0
        recommend_percentage = 100.0
        top_primary_need = None

    summary = AdminFeedbackSummarySchema(
        total_submissions=total_submissions,
        average_rating=round(avg_rating, 2),
        recommend_percentage=recommend_percentage,
        top_primary_need=top_primary_need,
    )

    # Parameter sanitization for direct unit testing & FastAPI calls
    limit_val = limit if isinstance(limit, int) else 500
    offset_val = offset if isinstance(offset, int) else 0
    search_val = search.strip() if isinstance(search, str) and search.strip() else None
    primary_need_val = primary_need.strip() if isinstance(primary_need, str) and primary_need.strip() else None
    rating_val = rating if isinstance(rating, int) else None

    # Filtered list query
    query = select(UserFeedback)
    if search_val:
        s = f"%{search_val.lower()}%"
        query = query.where(
            func.lower(UserFeedback.name).like(s)
            | func.lower(UserFeedback.email).like(s)
            | func.lower(UserFeedback.city).like(s)
            | func.lower(UserFeedback.feedback).like(s)
        )
    if primary_need_val:
        query = query.where(UserFeedback.primary_need == primary_need_val)
    if rating_val:
        query = query.where(UserFeedback.rating == rating_val)

    query = query.order_by(UserFeedback.created_at.desc()).limit(limit_val).offset(offset_val)
    result = await db.execute(query)
    rows = result.scalars().all()

    feedbacks = [
        FeedbackResponseSchema(
            id=f.id,
            user_id=f.user_id,
            name=f.name,
            email=f.email,
            age=f.age,
            city=f.city,
            primary_need=f.primary_need,
            frequency_of_medicine_purchase=f.frequency_of_medicine_purchase,
            rating=f.rating,
            ease_of_use=f.ease_of_use,
            feedback=f.feedback,
            would_recommend=f.would_recommend,
            created_at=f.created_at,
        )
        for f in rows
    ]

    return AdminFeedbackListResponse(summary=summary, feedbacks=feedbacks)


@router.delete("/feedbacks/{feedback_id}", status_code=204)
async def delete_feedback(
    feedback_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a feedback entry. Admin-only."""
    _require_admin(current_user)
    result = await db.execute(select(UserFeedback).where(UserFeedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    await db.delete(feedback)
    await db.commit()
    return None


# Marketplace routes are additive; existing user/feedback handlers stay intact.
from app.models.marketplace_schemas import BuildCartRequest, InventoryPatch, SellerVerifyRequest, CatalogSyncRequest
from app.db.database import Order, PharmacySeller
from app.services import marketplace_admin_service, store_service
from app.services.store_catalog import load_catalog, catalog_row


@router.get("/analytics")
async def marketplace_analytics(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await marketplace_admin_service.analytics(db)


@router.get("/orders")
async def marketplace_orders(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    _require_admin(current_user)
    orders = list((await db.scalars(select(Order).order_by(Order.created_at.desc(),Order.id))).all())
    return await store_service.order_payloads(db,orders,include_buyer=True)


@router.post("/orders/{order_id}/build-cart")
async def build_marketplace_cart(order_id: str, req: BuildCartRequest, db: AsyncSession = Depends(get_db),
                                  current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await store_service.build_cart(db,order_id,req.items)


@router.post("/orders/{order_id}/approve-rx")
async def approve_marketplace_rx(order_id: str, db: AsyncSession = Depends(get_db),
                                 current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await store_service.approve_rx(db,order_id)


@router.get("/inventory")
async def marketplace_inventory(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    _require_admin(current_user)
    entries = await load_catalog(db)
    return [catalog_row(entry,entries) for entry in entries.values() if entry.inventory]


@router.patch("/inventory/{medicine_id}")
async def patch_marketplace_inventory(medicine_id: str, req: InventoryPatch, db: AsyncSession = Depends(get_db),
                                       current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await marketplace_admin_service.patch_inventory(db,medicine_id,req)


@router.get("/sellers")
async def marketplace_sellers(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    _require_admin(current_user)
    return [marketplace_admin_service.seller_payload(s) for s in
        (await db.scalars(select(PharmacySeller).order_by(PharmacySeller.pharmacy_name))).all()]


@router.post("/sellers/{seller_id}/verify")
async def verify_marketplace_seller(seller_id: str, req: SellerVerifyRequest, db: AsyncSession = Depends(get_db),
                                    current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await marketplace_admin_service.verify_seller(db,seller_id,req.verification_status)


@router.post("/catalog-sync")
async def marketplace_catalog_sync(req: CatalogSyncRequest, db: AsyncSession = Depends(get_db),
                                    current_user: User = Depends(get_current_user)) -> dict:
    _require_admin(current_user)
    return await marketplace_admin_service.catalog_sync(db,req.records,req.dry_run)
