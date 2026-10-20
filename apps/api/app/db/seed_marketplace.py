"""Idempotent LOCAL demo inventory and synthetic historical order seeder."""
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine, MrpReference, PharmacySeller, StoreInventory, User, Order, OrderItem
from app.services.catalog_records import money
from app.services.marketplace_policy import DEMO_SELLERS, demo_id, requires_rx


async def seed_marketplace(db: AsyncSession) -> dict[str,int]:
    report = {"sellers_inserted":0,"inventory_inserted":0,"orders_inserted":0}
    try:
        for name,license_no,status in DEMO_SELLERS:
            if await db.scalar(select(PharmacySeller.id).where(PharmacySeller.drug_license_no == license_no)) is None:
                db.add(PharmacySeller(id=demo_id(license_no),pharmacy_name=name,city="Karachi",
                    address="Synthetic demo address; not a real fulfillment location",
                    drug_license_no=license_no,pharmacist_reg_no="DEMO-PHARM-"+license_no.rsplit("-",1)[-1],verification_status=status))
                report["sellers_inserted"] += 1
        await db.flush()
        central = await db.scalar(select(PharmacySeller).where(PharmacySeller.drug_license_no == DEMO_SELLERS[0][1]))
        medicines = list((await db.scalars(select(Medicine).order_by(Medicine.id))).all())
        references = {}
        for ref in (await db.scalars(select(MrpReference).order_by(MrpReference.effective_date.desc().nulls_last(),MrpReference.updated_at.desc()))).all():
            references.setdefault(ref.medicine_id,ref)
        inventory = {i.medicine_id:i for i in (await db.scalars(select(StoreInventory))).all()}
        for med in medicines:
            ref = references.get(med.id)
            price = money(ref.notified_mrp if ref else Decimal("250.00"))
            if med.id not in inventory:
                entry = StoreInventory(medicine_id=med.id,seller_id=central.id,selling_price=price,requires_prescription=requires_rx(med.category))
                db.add(entry); inventory[med.id] = entry
                report["inventory_inserted"] += 1
            elif ref and inventory[med.id].selling_price > ref.notified_mrp:
                inventory[med.id].selling_price = price
        if medicines and not (await db.scalar(select(func.count()).select_from(Order))):
            buyer = await db.scalar(select(User).where(User.email == "marketplace-demo@afiya.invalid"))
            if buyer is None:
                buyer = User(id=demo_id("buyer"),name="Demo Buyer (synthetic)",email="marketplace-demo@afiya.invalid",password_hash=None,is_admin=False)
                db.add(buyer); await db.flush()
            # Historical demo discounts are snapshots, not current stock sales.
            usable = [med for med in medicines if inventory[med.id].selling_price > 0]
            for index in range(5):
                med = usable[index % len(usable)] if usable else medicines[index % len(medicines)]
                reference = inventory[med.id].selling_price or Decimal("250.00")
                unit_price = min(money(reference*Decimal("0.90")), reference-Decimal("0.01"))
                order = Order(id=demo_id(f"historical-order-{index}"),user_id=buyer.id,
                    status="CONFIRMED" if index % 2 == 0 else "DELIVERED",verified_by_pharmacist=True,
                    customer_note="[DEMO] Synthetic historical order; no patient sale or actual licensed verification",
                    total_amount=unit_price,total_savings_pkr=money(reference-unit_price),created_at=datetime.utcnow()-timedelta(hours=index))
                db.add(order); await db.flush()
                db.add(OrderItem(order_id=order.id,medicine_id=med.id,quantity=1,unit_price=unit_price))
                report["orders_inserted"] += 1
        await db.commit()
    except Exception:
        await db.rollback(); raise
    return report
