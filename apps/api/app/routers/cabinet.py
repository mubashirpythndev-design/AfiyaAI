"""My Digital Medicine Cabinet Router.

Endpoints:
  - POST /api/v1/cabinet: Add medicine to cabinet (Authenticated).
  - DELETE /api/v1/cabinet/{medicine_id}: Remove medicine from cabinet (Authenticated).
  - GET /api/v1/cabinet: Get user's cabinet (Authenticated).
  - GET /api/v1/cabinet/check/{medicine_id}: Check if medicine is in cabinet (Authenticated).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, UserCabinet, Medicine, User
from app.models.schemas import (
    CabinetAddRequest,
    CabinetUpdateRequest,
    CabinetItemSchema,
    CabinetResponse,
    MedicineSchema,
)
from app.services.auth_dependency import get_current_user
from app.services.cabinet_budget import calculate_budget
from app.services.cabinet_quantity import current_price, build_quantity_options, apply_quantity
from app.services.cabinet_pricing import get_cabinet_pricing

router = APIRouter(prefix="/api/v1/cabinet", tags=["Medicine Cabinet"])


def _to_medicine_schema(med: Medicine) -> MedicineSchema:
    return MedicineSchema(
        id=med.id,
        brand_name=med.brand_name,
        generic_name=med.generic_name,
        dosage_form=med.dosage_form,
        strength=med.strength,
        manufacturer=med.manufacturer or "",
        category=med.category or "",
        drap_reg_no=med.drap_reg_no,
        registration_info=med.registration_info,
        source_verification_status=med.source_verification_status or "needs_source_verification",
    )


async def _cabinet_schema(db: AsyncSession, item: UserCabinet, med: Medicine) -> CabinetItemSchema:
    price_row = await current_price(db, med.id)
    pack, options = build_quantity_options(med, price_row)
    pricing = await get_cabinet_pricing(db, med, price_row)
    return CabinetItemSchema(
        id=item.id, medicine_id=med.id, medicine=_to_medicine_schema(med),
        notified_mrp=pricing.current.pack_price_paisa / 100 if pricing else None,
        pricing=pricing,
        dosage_instruction=item.dosage_instruction,
        reminder_times=item.reminder_times or [], monthly_units=item.monthly_units,
        monthly_quantity=item.monthly_quantity, monthly_quantity_unit=item.monthly_quantity_unit,
        package_size=pack, quantity_options=options, created_at=item.created_at,
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
            dosage_instruction=payload.dosage_instruction,
            reminder_times=payload.reminder_times or [],
            monthly_units=payload.monthly_units,
        )
        try:
            await apply_quantity(db, med, existing, payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
    else:
        # Update instructions/reminders if provided
        updated = False
        if payload.dosage_instruction is not None:
            existing.dosage_instruction = payload.dosage_instruction
            updated = True
        if payload.reminder_times is not None:
            existing.reminder_times = payload.reminder_times
            updated = True
        if {"monthly_units", "monthly_quantity", "monthly_quantity_unit"} & payload.model_fields_set:
            try:
                await apply_quantity(db, med, existing, payload)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            updated = True
        if updated:
            await db.commit()
            await db.refresh(existing)

    return await _cabinet_schema(db, existing, med)


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
        items.append(await _cabinet_schema(db, cab_item, med))

    return CabinetResponse(
        total_items=len(items),
        items=items,
        budget=await calculate_budget(db, items),
    )


@router.patch("/{medicine_id}/reminder", response_model=CabinetItemSchema)
async def update_cabinet_reminder(
    medicine_id: str,
    payload: CabinetUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update dosage directions or reminder times on an active cabinet medication."""
    res = await db.execute(
        select(UserCabinet, Medicine)
        .join(Medicine, UserCabinet.medicine_id == Medicine.id)
        .where(
            UserCabinet.user_id == current_user.id,
            UserCabinet.medicine_id == medicine_id,
        )
    )
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medication not found in user cabinet.",
        )
    cab_item, med = row

    if payload.dosage_instruction is not None:
        cab_item.dosage_instruction = payload.dosage_instruction
    if payload.reminder_times is not None:
        cab_item.reminder_times = payload.reminder_times

    try:
        await apply_quantity(db, med, cab_item, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(cab_item)

    return await _cabinet_schema(db, cab_item, med)


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

