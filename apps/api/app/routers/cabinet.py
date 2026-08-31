"""My Digital Medicine Cabinet Router.

Endpoints:
  - POST /api/v1/cabinet: Add medicine to cabinet (Authenticated).
  - DELETE /api/v1/cabinet/{medicine_id}: Remove medicine from cabinet (Authenticated).
  - GET /api/v1/cabinet: Get user's cabinet (Authenticated).
  - GET /api/v1/cabinet/check/{medicine_id}: Check if medicine is in cabinet (Authenticated).
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, UserCabinet, Medicine, MrpReference, User
from app.models.schemas import (
    CabinetAddRequest,
    CabinetItemSchema,
    CabinetResponse,
    MedicineSchema,
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

    # 3. Fetch MRP
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
    """Retrieve user's cabinet list."""
    res = await db.execute(
        select(UserCabinet, Medicine)
        .join(Medicine, UserCabinet.medicine_id == Medicine.id)
        .where(UserCabinet.user_id == current_user.id)
        .order_by(UserCabinet.created_at.desc())
    )
    rows = res.all()

    items = []
    for cab_item, med in rows:
        # Check MRP
        mrp_res = await db.execute(
            select(MrpReference)
            .where(MrpReference.medicine_id == med.id)
            .order_by(MrpReference.effective_date.desc().nulls_last())
        )
        mrp_row = mrp_res.scalars().first()

        items.append(
            CabinetItemSchema(
                id=cab_item.id,
                medicine_id=med.id,
                medicine=_to_medicine_schema(med),
                notified_mrp=Decimal(str(mrp_row.notified_mrp)) if mrp_row else None,
                created_at=cab_item.created_at,
            )
        )

    return CabinetResponse(
        total_items=len(items),
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

