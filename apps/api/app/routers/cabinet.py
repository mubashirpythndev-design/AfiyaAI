"""My Digital Medicine Cabinet & Automated Recall Watchdog Router.

Endpoints:
  - POST /api/v1/cabinet: Add medicine to cabinet (Authenticated).
  - DELETE /api/v1/cabinet/{medicine_id}: Remove medicine from cabinet (Authenticated).
  - GET /api/v1/cabinet: Get user's cabinet with active DRAP recall alerts (Authenticated).
  - GET /api/v1/cabinet/check/{medicine_id}: Check if medicine is in cabinet (Authenticated).
"""
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db, UserCabinet, Medicine, MrpReference, DrapAlert, Source, User
from app.models.schemas import (
    CabinetAddRequest,
    CabinetItemSchema,
    CabinetResponse,
    MedicineSchema,
    AlertSchema,
    SourceSchema,
)
from app.services.auth_dependency import get_current_user

router = APIRouter(prefix="/api/v1/cabinet", tags=["Medicine Cabinet"])


def _to_medicine_schema(med: Medicine) -> MedicineSchema:
    return MedicineSchema(
        id=med.id,
        brand_name=med.brand_name,
        generic_name=med.generic_name,
        dosage_form=med.dosage_form,
        strength=med.strength,
        manufacturer=med.manufacturer,
        category=med.category,
        drap_reg_no=med.drap_reg_no,
        registration_info=med.registration_info,
    )


def _to_alert_schema(alert: DrapAlert) -> AlertSchema:
    source_schema = None
    if alert.source:
        source_schema = SourceSchema(
            id=alert.source.id,
            name=alert.source.name,
            url=alert.source.url,
            source_type=alert.source.source_type,
        )
    return AlertSchema(
        alert_type=alert.alert_type,
        description=alert.description,
        batch_no=alert.batch_no,
        issued_at=str(alert.issued_at) if alert.issued_at else None,
        match_basis="name_only" if not alert.batch_no else "batch_no",
        is_demo=alert.is_demo,
        source=source_schema,
    )


@router.post("", response_model=CabinetItemSchema, status_code=status.HTTP_201_CREATED)
async def add_to_cabinet(
    payload: CabinetAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a medicine to the logged-in user's cabinet."""
    # 1. Verify medicine exists
    med_res = await db.execute(select(Medicine).where(Medicine.id == payload.medicine_id))
    med = med_res.scalar_one_or_none()
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )

    # 2. Check if already in cabinet
    existing_res = await db.execute(
        select(UserCabinet).where(
            UserCabinet.user_id == current_user.id,
            UserCabinet.medicine_id == med.id,
        )
    )
    existing = existing_res.scalar_one_or_none()

    if not existing:
        existing = UserCabinet(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            medicine_id=med.id,
        )
        db.add(existing)
        await db.commit()
        await db.refresh(existing)

    # 3. Check active alerts for this medicine
    alerts_res = await db.execute(
        select(DrapAlert)
        .options(selectinload(DrapAlert.source))
        .where(
            DrapAlert.medicine_id == med.id,
            DrapAlert.resolved == False,
        )
    )
    alert_rows = alerts_res.scalars().all()
    active_alerts = [_to_alert_schema(a) for a in alert_rows]

    # 4. Fetch MRP
    mrp_res = await db.execute(
        select(MrpReference)
        .where(MrpReference.medicine_id == med.id)
        .order_by(MrpReference.effective_date.desc().nulls_last())
    )
    mrp_row = mrp_res.scalars().first()

    return CabinetItemSchema(
        id=existing.id,
        medicine_id=med.id,
        medicine=_to_medicine_schema(med),
        notified_mrp=Decimal(str(mrp_row.notified_mrp)) if mrp_row else None,
        active_alerts=active_alerts,
        has_recall_alert=len(active_alerts) > 0,
        created_at=existing.created_at,
    )


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_cabinet(
    medicine_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a medicine from the logged-in user's cabinet."""
    res = await db.execute(
        select(UserCabinet).where(
            UserCabinet.user_id == current_user.id,
            UserCabinet.medicine_id == medicine_id,
        )
    )
    item = res.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=CabinetResponse)
async def get_user_cabinet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve user's cabinet list with automated DRAP recall watchdog alerts."""
    res = await db.execute(
        select(UserCabinet, Medicine)
        .join(Medicine, UserCabinet.medicine_id == Medicine.id)
        .where(UserCabinet.user_id == current_user.id)
        .order_by(UserCabinet.created_at.desc())
    )
    rows = res.all()

    items = []
    recalled_count = 0

    for cab_item, med in rows:
        # Check MRP
        mrp_res = await db.execute(
            select(MrpReference)
            .where(MrpReference.medicine_id == med.id)
            .order_by(MrpReference.effective_date.desc().nulls_last())
        )
        mrp_row = mrp_res.scalars().first()

        # Automated Recall Watchdog Join with drap_alerts
        alerts_res = await db.execute(
            select(DrapAlert)
            .options(selectinload(DrapAlert.source))
            .where(
                DrapAlert.medicine_id == med.id,
                DrapAlert.resolved == False,
            )
        )
        alert_rows = alerts_res.scalars().all()
        active_alerts = [_to_alert_schema(a) for a in alert_rows]
        has_recall = len(active_alerts) > 0
        if has_recall:
            recalled_count += 1

        items.append(
            CabinetItemSchema(
                id=cab_item.id,
                medicine_id=med.id,
                medicine=_to_medicine_schema(med),
                notified_mrp=Decimal(str(mrp_row.notified_mrp)) if mrp_row else None,
                active_alerts=active_alerts,
                has_recall_alert=has_recall,
                created_at=cab_item.created_at,
            )
        )

    return CabinetResponse(
        total_items=len(items),
        recalled_items_count=recalled_count,
        items=items,
    )


@router.get("/check/{medicine_id}")
async def check_in_cabinet(
    medicine_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a specific medicine is in the user's cabinet."""
    res = await db.execute(
        select(UserCabinet).where(
            UserCabinet.user_id == current_user.id,
            UserCabinet.medicine_id == medicine_id,
        )
    )
    return {"in_cabinet": res.scalar_one_or_none() is not None}
