"""Monthly shopping quantities; never infer a prescribed dosage."""
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine, MedicinePrice
from app.services.cheapest_brand_service import parse_pack_units

async def current_price(db: AsyncSession, medicine_id: str) -> MedicinePrice | None:
    return (await db.execute(select(MedicinePrice).where(
        MedicinePrice.medicine_id == medicine_id,
    ).order_by(MedicinePrice.collected_at.desc(), MedicinePrice.created_at.desc(), MedicinePrice.id.desc()).limit(1))).scalar_one_or_none()

def build_quantity_options(medicine: Medicine, row: MedicinePrice | None) -> tuple[str | None, list[dict]]:
    form = (medicine.dosage_form or "").lower()
    kind = "capsule" if "capsule" in form else "tablet" if "tablet" in form or "caplet" in form else "dose" if "inhal" in form else "unit"
    options = [{"unit": kind, "units_per_quantity": 1}]
    if row is None:
        return None, options
    pack = row.package_size or ""
    units, known = parse_pack_units(pack)
    if not known or units <= 0 or row.currency != "PKR":
        return pack, options
    # AxB represents blister strips only for tablets/capsules.
    match = re.fullmatch(r"\s*(\d+)\s*x\s*(\d+)\s*(?:['’]s|s)?\s*", pack, re.IGNORECASE)
    if kind in {"tablet", "capsule"} and match:
        per_strip = int(match.group(2))
        if per_strip > 0:
            options.append({"unit": "strip", "units_per_quantity": per_strip})
    options.append({"unit": "pack", "units_per_quantity": units})
    return pack, options

async def quantity_options(db: AsyncSession, medicine: Medicine) -> tuple[str | None, list[dict]]:
    return build_quantity_options(medicine, await current_price(db, medicine.id))

def normalize_quantity(quantity: int | None, unit: str | None, options: list[dict]) -> int | None:
    if quantity is None:
        return None
    choice = next((o for o in options if o["unit"] == unit), None)
    if choice is None:
        raise ValueError("This quantity unit is unavailable for this medicine or its stored pack size.")
    units = quantity * choice["units_per_quantity"]
    if units < 1 or units > 100000:
        raise ValueError("Monthly quantity must convert to between 1 and 100000 individual units.")
    return units

async def apply_quantity(db: AsyncSession, medicine: Medicine, item, payload) -> None:
    fields = payload.model_fields_set
    if "monthly_quantity" in fields or "monthly_quantity_unit" in fields:
        if "monthly_units" in fields:
            raise ValueError("Send either a quantity and unit or monthly_units, not both.")
        if not {"monthly_quantity", "monthly_quantity_unit"}.issubset(fields):
            raise ValueError("Send monthly_quantity and monthly_quantity_unit together.")
        _, options = await quantity_options(db, medicine)
        item.monthly_units = normalize_quantity(payload.monthly_quantity, payload.monthly_quantity_unit, options)
        item.monthly_quantity = payload.monthly_quantity
        item.monthly_quantity_unit = payload.monthly_quantity_unit if payload.monthly_quantity is not None else None
    elif "monthly_units" in fields:
        item.monthly_units = payload.monthly_units
        item.monthly_quantity = None
        item.monthly_quantity_unit = None
