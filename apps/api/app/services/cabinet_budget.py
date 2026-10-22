"""Consumption budget from user-confirmed monthly units and stored comparable prices."""
from decimal import Decimal, ROUND_CEILING
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import CabinetBudgetSchema
from app.services.cheapest_brand_service import get_cheapest_brands, MedicineNotFound

async def calculate_budget(db: AsyncSession, items) -> CabinetBudgetSchema:
    cost = Decimal(0)
    savings = Decimal(0)
    missing = []
    for item in items:
        if not item.monthly_units:
            missing.append(item.medicine_id)
            continue
        # API items already carry the exact price snapshot used by the UI.
        # Reuse it so totals cannot switch to another row or pack mid-request.
        if hasattr(item, "pricing"):
            pricing = item.pricing
            if pricing is None or not pricing.comparison_available or not pricing.alternatives:
                missing.append(item.medicine_id)
                continue
            def snapshot_cost(option):
                packs = (Decimal(item.monthly_units) / Decimal(option.units_per_pack)).to_integral_value(rounding=ROUND_CEILING)
                return packs * Decimal(option.pack_price_paisa) / 100
            current_cost = snapshot_cost(pricing.current)
            cheapest_cost = min(snapshot_cost(o) for o in pricing.alternatives)
            cost += current_cost
            savings += max(Decimal(0), current_cost - cheapest_cost)
            continue
        try:
            group = await get_cheapest_brands(db, item.medicine_id)
            current = next((o for o in group.options if o.medicine_id == item.medicine_id), None)
            if current is None:
                missing.append(item.medicine_id)
                continue
            # Whole packs needed to buy the confirmed monthly quantity.
            def pack_cost(option):
                packs = (Decimal(item.monthly_units) / Decimal(option.units)).to_integral_value(rounding=ROUND_CEILING)
                return packs * option.price
            current_cost = pack_cost(current)
            cheapest_cost = min(pack_cost(o) for o in group.options)
            cost += current_cost
            savings += max(Decimal(0), current_cost - cheapest_cost)
        except MedicineNotFound:
            missing.append(item.medicine_id)
    if missing:
        return CabinetBudgetSchema(missing_medicine_ids=missing)
    return CabinetBudgetSchema(monthly_cost=float(cost), monthly_savings=float(savings), annual_savings=float(savings * 12))
