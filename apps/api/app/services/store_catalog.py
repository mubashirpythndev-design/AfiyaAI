"""Stored-price catalog snapshots and pack-aware comparisons. No clinical inference."""
from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
import re
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine, StoreInventory, PharmacySeller, MrpReference, DrapAlert
from app.services.catalog_records import money
from app.services.duplication_service import normalized, medicine_info
from app.services.marketplace_policy import demo_seller


def strength_key(value: str) -> str:
    clean = re.sub(r"\s+", "", value.casefold())
    match = re.fullmatch(r"(\d+(?:\.\d+)?)g",clean)
    return f"{Decimal(match[1])*1000:g}mg" if match else clean


def pack_units(pack: str) -> int | None:
    text = (pack or "").casefold().strip()
    # Count solid units only; do not compare ml, grams or device doses as packs.
    match = re.fullmatch(r"(\d+)\s*x\s*(\d+)\s*(?:'s|s|tablets?|capsules?)?",text)
    if match:
        total = int(match[1])*int(match[2])
        return total if total > 0 else None
    match = re.fullmatch(r"(\d+)\s*(?:'s|s|tablets?|capsules?)",text)
    return int(match[1]) if match and int(match[1]) > 0 else None


@dataclass
class CatalogEntry:
    medicine: Medicine
    inventory: StoreInventory | None
    seller: PharmacySeller | None
    mrp: MrpReference | None
    recalled: bool = False

    @property
    def pack(self) -> str:
        return self.mrp.pack_size if self.mrp else ""

    @property
    def units(self) -> int | None:
        return pack_units(self.pack)

    @property
    def available(self) -> bool:
        return bool(self.inventory and self.inventory.stock_quantity > 0 and self.seller
            and self.seller.verification_status == "VERIFIED" and not self.recalled
            and (self.mrp is None or self.inventory.selling_price <= self.mrp.notified_mrp))

    @property
    def unit_price(self) -> Decimal | None:
        return Decimal(self.inventory.selling_price)/self.units if self.inventory and self.units else None


async def load_catalog(db: AsyncSession) -> dict[str,CatalogEntry]:
    medicines = (await db.scalars(select(Medicine).order_by(Medicine.brand_name,Medicine.id))).all()
    inventories = {i.medicine_id:i for i in (await db.scalars(select(StoreInventory))).all()}
    sellers = {s.id:s for s in (await db.scalars(select(PharmacySeller))).all()}
    references: dict[str,MrpReference] = {}
    for ref in (await db.scalars(select(MrpReference).order_by(MrpReference.effective_date.desc().nulls_last(),MrpReference.updated_at.desc(),MrpReference.id))).all():
        references.setdefault(ref.medicine_id,ref)
    alerts = {(a.medicine_id,(a.batch_no or "").casefold().strip()) for a in
              (await db.scalars(select(DrapAlert).where(DrapAlert.resolved.is_(False)))).all()}
    result = {}
    for medicine in medicines:
        inv = inventories.get(medicine.id)
        result[medicine.id] = CatalogEntry(medicine,inv,sellers.get(inv.seller_id) if inv else None,
            references.get(medicine.id), bool(inv and (medicine.id,inv.active_batch_no.casefold().strip()) in alerts))
    return result


def equivalent(a: CatalogEntry, b: CatalogEntry) -> bool:
    return bool(normalized(a.medicine.generic_name) not in {"", "unknown", "unspecified", "na"} and strength_key(a.medicine.strength)
        and normalized(a.medicine.dosage_form) and normalized(a.medicine.generic_name) == normalized(b.medicine.generic_name)
        and strength_key(a.medicine.strength) == strength_key(b.medicine.strength)
        and normalized(a.medicine.dosage_form) == normalized(b.medicine.dosage_form))


def alternative(entry: CatalogEntry, catalog: dict[str,CatalogEntry], quantity: int = 1,
                excluded: set[str] | None = None, *, whole_packs: bool = False) -> dict[str,Any] | None:
    if not entry.inventory:
        return None
    choices = []
    for other in catalog.values():
        if other.medicine.id == entry.medicine.id or other.medicine.id in (excluded or set()) or not other.available or not equivalent(entry,other):
            continue
        if entry.units and other.units and normalized(entry.medicine.dosage_form) in {"tablet","capsule","tablets","capsules"}:
            if other.unit_price >= entry.unit_price:
                continue
            target_quantity = int((Decimal(quantity*entry.units)/other.units).to_integral_value(rounding=ROUND_CEILING))
            comparable = other.unit_price*entry.units*quantity
        elif entry.pack and entry.pack.casefold() == other.pack.casefold():
            target_quantity = quantity
            comparable = other.inventory.selling_price*quantity
        else:
            continue
        if other.inventory.stock_quantity < target_quantity:
            continue
        cost = other.inventory.selling_price*target_quantity if whole_packs else comparable
        savings = money(max(Decimal(0),entry.inventory.selling_price*quantity-cost))
        if savings <= 0:
            continue
        choices.append({"medicine_id":other.medicine.id,"brand_name":other.medicine.brand_name,
            "selling_price":money(other.inventory.selling_price),"pack_size":other.pack,
            "unit_price":other.unit_price.quantize(Decimal("0.0001")) if other.unit_price is not None else None,
            "savings_pkr":savings,"savings_pct":(savings/(entry.inventory.selling_price*quantity)*100).quantize(Decimal("0.01")),
            "target_quantity":target_quantity,"quantity_unit":"pack","comparison_basis":"whole_packs" if whole_packs else "equivalent_units",
            "pharmacist_confirmation_required":True})
    return max(choices,key=lambda item:(item["savings_pkr"],item["medicine_id"])) if choices else None


def catalog_row(entry: CatalogEntry, catalog: dict[str,CatalogEntry]) -> dict[str,Any]:
    inv = entry.inventory
    return {**medicine_info(entry.medicine),"id":entry.medicine.id,
        "selling_price":money(inv.selling_price) if inv else None,
        "notified_mrp":money(entry.mrp.notified_mrp) if entry.mrp else None,
        "pack_size":entry.pack,"stock_quantity":inv.stock_quantity if inv else 0,
        "active_batch_no":inv.active_batch_no if inv else None,
        "requires_prescription":inv.requires_prescription if inv else None,
        "seller_name":entry.seller.pharmacy_name if entry.seller else None,
        "seller_verification_status":entry.seller.verification_status if entry.seller else None,
        "is_demo_seller":demo_seller(entry.seller.id if entry.seller else None),
        "available":entry.available,"batch_recalled":entry.recalled,
        "quantity_unit":"pack","price_origin":"stored_mrp" if entry.mrp else "demo_fallback_unverified",
        "cheapest_alternative":alternative(entry,catalog)}
