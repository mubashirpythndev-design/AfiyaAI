"""Price comparison service - queries stored DRAP prices from database."""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import Medicine, MedicinePrice, Source
from app.models.schemas import MedicineSchema, PriceEntry, PriceComparison, SourceSchema

logger = logging.getLogger(__name__)


def source_to_schema(s: Source, collected_at: str = None) -> SourceSchema:
    return SourceSchema(
        name=s.name,
        url=s.url,
        source_type=s.source_type,
        verification_status=s.verification_status or "needs_source_verification",
        collected_at=collected_at,
    )


async def get_price_comparison(medicine_id: str, db: AsyncSession) -> PriceComparison | None:
    """Get price comparison for a verified medicine."""
    # Get medicine
    result = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )
    medicine = result.scalar_one_or_none()
    if not medicine:
        return None

    # Get all prices with sources
    result = await db.execute(
        select(MedicinePrice)
        .where(MedicinePrice.medicine_id == medicine_id)
        .options(selectinload(MedicinePrice.source))
    )
    price_records = result.scalars().all()

    if not price_records:
        return None

    # Only compare current records of the same currency and pack size.
    price_records.sort(key=lambda p: p.collected_at or p.created_at, reverse=True)
    chosen_pack = price_records[0].package_size
    seen = set()
    current = []
    for record in price_records:
        key = (record.source_id, record.package_size, record.currency)
        if key not in seen and record.package_size == chosen_pack and record.currency == "PKR":
            seen.add(key)
            current.append(record)
    price_records = current
    if not price_records:
        return None
    prices = []
    for p in price_records:
        prices.append(PriceEntry(
            id=str(p.id),
            price=float(p.price),
            currency=p.currency or "PKR",
            package_size=p.package_size or "",
            package_description=p.package_description or "",
            source=source_to_schema(p.source, str(p.collected_at.date()) if p.collected_at else None),
            collected_at=str(p.collected_at.date()) if p.collected_at else "",
        ))

    prices_list = [float(p.price) for p in price_records]
    lowest = min(prices_list)
    highest = max(prices_list)

    med_schema = MedicineSchema(
        id=str(medicine.id),
        brand_name=medicine.brand_name,
        generic_name=medicine.generic_name,
        dosage_form=medicine.dosage_form,
        strength=medicine.strength,
        manufacturer=medicine.manufacturer or "",
        registration_info=medicine.registration_info,
        aliases=medicine.aliases or [],
        category=medicine.category or "",
    )

    return PriceComparison(
        medicine=med_schema,
        prices=prices,
        lowest_price=lowest,
        highest_price=highest,
        savings=round(highest - lowest, 2),
    )
