"""Price Gouging Overcharge Reports Router.

Endpoints:
  - POST /api/v1/overcharge-reports: Submit an overcharge report (Authenticated).
  - GET /api/admin/overcharge-reports: View summary and reports (Admin-only RBAC).
"""
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, OverchargeReport, Medicine, MrpReference, User
from app.models.schemas import (
    OverchargeReportCreate,
    OverchargeReportSchema,
    AdminOverchargeReportsResponse,
    AdminOverchargeReportsSummary,
)
from app.services.auth_dependency import get_current_user

router = APIRouter(tags=["Overcharge Reports"])


def _require_admin(user: User) -> User:
    """Raise HTTP 403 if the user is not an admin."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user



@router.post(
    "/api/v1/overcharge-reports",
    response_model=OverchargeReportSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a pharmacy overcharge report",
)
async def create_overcharge_report(
    payload: OverchargeReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log an overcharge report against a pharmacy.

    Server-side re-validates that the price paid exceeds official DRAP MRP.
    Rejects submissions if the price is at or below MRP or if no MRP data exists.
    """
    # 1. Fetch medicine
    res = await db.execute(select(Medicine).where(Medicine.id == payload.medicine_id))
    med = res.scalar_one_or_none()
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )

    # 2. Fetch MRP reference
    query = select(MrpReference).where(MrpReference.medicine_id == med.id)
    if payload.pack_size:
        query = query.where(MrpReference.pack_size == payload.pack_size)
    query = query.order_by(MrpReference.effective_date.desc().nulls_last())

    mrp_res = await db.execute(query)
    mrp_row = mrp_res.scalars().first()

    if not mrp_row or mrp_row.notified_mrp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No official DRAP MRP reference data found for this medicine.",
        )

    notified_mrp = Decimal(str(mrp_row.notified_mrp))
    price_paid = Decimal(str(payload.price_paid))

    if price_paid <= notified_mrp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report rejected: Paid price (Rs {price_paid}) is at or below official DRAP MRP (Rs {notified_mrp}).",
        )

    overcharge_amount = price_paid - notified_mrp

    # 3. Create report
    report = OverchargeReport(
        id=str(uuid.uuid4()),
        medicine_id=med.id,
        reported_by_user_id=current_user.id,
        pharmacy_name=payload.pharmacy_name.strip(),
        city=payload.city.strip(),
        price_paid=price_paid,
        notified_mrp=notified_mrp,
        mrp_effective_date=mrp_row.effective_date,
        overcharge_amount=overcharge_amount,
        currency="PKR",
        note=payload.note.strip() if payload.note else None,
        status="pending",
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return OverchargeReportSchema(
        id=report.id,
        medicine_id=report.medicine_id,
        medicine_name=f"{med.brand_name} ({med.generic_name} {med.strength})",
        reported_by_user_id=report.reported_by_user_id,
        reporter_name=current_user.name,
        reporter_email=current_user.email,
        pharmacy_name=report.pharmacy_name,
        city=report.city,
        price_paid=report.price_paid,
        notified_mrp=report.notified_mrp,
        mrp_effective_date=str(report.mrp_effective_date) if report.mrp_effective_date else None,
        overcharge_amount=report.overcharge_amount,
        currency=report.currency,
        note=report.note,
        status=report.status,
        created_at=report.created_at,
    )


@router.get(
    "/api/admin/overcharge-reports",
    response_model=AdminOverchargeReportsResponse,
    summary="List overcharge reports and summary stats (Admin only)",
)
async def list_admin_overcharge_reports(
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all logged pharmacy overcharge reports with summary statistics."""
    _require_admin(current_user)
    # 1. Total count & total overcharged sum
    total_res = await db.execute(select(func.count(OverchargeReport.id)))
    total_count = total_res.scalar() or 0

    sum_res = await db.execute(select(func.sum(OverchargeReport.overcharge_amount)))
    total_overcharge = sum_res.scalar() or Decimal("0.00")

    # 2. Top cities by count
    cities_res = await db.execute(
        select(OverchargeReport.city, func.count(OverchargeReport.id).label("count"))
        .group_by(OverchargeReport.city)
        .order_by(func.count(OverchargeReport.id).desc())
        .limit(5)
    )
    top_cities = [
        {"city": row[0], "count": row[1]} for row in cities_res.all()
    ]

    # 3. Reports list with medicine & user details
    query = (
        select(OverchargeReport, Medicine, User)
        .outerjoin(Medicine, OverchargeReport.medicine_id == Medicine.id)
        .outerjoin(User, OverchargeReport.reported_by_user_id == User.id)
        .order_by(OverchargeReport.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(query)
    rows = res.all()

    report_schemas = []
    for report, med, user in rows:
        report_schemas.append(
            OverchargeReportSchema(
                id=report.id,
                medicine_id=report.medicine_id,
                medicine_name=f"{med.brand_name} ({med.generic_name} {med.strength})" if med else "Unknown Medicine",
                reported_by_user_id=report.reported_by_user_id,
                reporter_name=user.name if user else "Anonymous",
                reporter_email=user.email if user else None,
                pharmacy_name=report.pharmacy_name,
                city=report.city,
                price_paid=report.price_paid,
                notified_mrp=report.notified_mrp,
                mrp_effective_date=str(report.mrp_effective_date) if report.mrp_effective_date else None,
                overcharge_amount=report.overcharge_amount,
                currency=report.currency,
                note=report.note,
                status=report.status,
                created_at=report.created_at,
            )
        )

    return AdminOverchargeReportsResponse(
        summary=AdminOverchargeReportsSummary(
            total_reports=total_count,
            total_overcharge_amount=Decimal(str(total_overcharge)),
            top_cities=top_cities,
        ),
        reports=report_schemas,
    )
