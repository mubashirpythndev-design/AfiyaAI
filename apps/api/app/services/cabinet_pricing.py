"""Price snapshots tied to the same stored pack used for quantity conversion."""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine, MedicinePrice
from app.models.schemas import CabinetPricingSchema, CabinetPriceOptionSchema
from app.services.cheapest_brand_service import parse_pack_units, get_cheapest_brands, MedicineNotFound

def price_option(price: Decimal, units: int) -> CabinetPriceOptionSchema:
    return CabinetPriceOptionSchema(pack_price_paisa=int((price * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP)), units_per_pack=units)

async def get_cabinet_pricing(db: AsyncSession, medicine: Medicine, row: MedicinePrice | None) -> CabinetPricingSchema | None:
    if row is None or row.currency != "PKR" or row.price < 0:
        return None
    units, known = parse_pack_units(row.package_size)
    if not known or units <= 0:
        return None
    current = price_option(Decimal(row.price), units)
    try:
        group = await get_cheapest_brands(db, medicine.id)
        alternatives = [current] + [price_option(o.price, o.units) for o in group.options if o.medicine_id != medicine.id and o.price >= 0]
        return CabinetPricingSchema(current=current, alternatives=alternatives, comparison_available=True)
    except MedicineNotFound:
        return CabinetPricingSchema(current=current)
