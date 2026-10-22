"""Admin marketplace operations; stored data, Decimal arithmetic and SQL only."""
from datetime import datetime
from decimal import Decimal
from typing import Any
from fastapi import HTTPException
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine, MrpReference, PharmacySeller, StoreInventory, DrapAlert, Order, OrderItem
from app.models.marketplace_schemas import InventoryPatch
from app.services.catalog_records import money, record_fields, new_medicine_fields
from app.services.marketplace_policy import requires_rx, demo_seller, demo_order
from app.services.store_catalog import load_catalog, catalog_row
from app.services.mrp_refresh import refresh_reference


async def patch_inventory(db: AsyncSession, medicine_id: str, req: InventoryPatch) -> dict:
    try:
        inventory = await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id == medicine_id).with_for_update())
        if not inventory: raise HTTPException(404,"Inventory not found")
        catalog = await load_catalog(db)
        entry = catalog[medicine_id]
        changes = req.model_dump(exclude_unset=True)
        price = changes.get("selling_price",inventory.selling_price)
        if entry.mrp and price > entry.mrp.notified_mrp:
            raise HTTPException(422,"Regulatory Violation: Selling price cannot exceed DRAP Notified MRP")
        batch = changes.get("active_batch_no",inventory.active_batch_no)
        alert = await db.scalar(select(DrapAlert.id).where(DrapAlert.medicine_id == medicine_id,
            func.lower(func.trim(DrapAlert.batch_no)) == batch.casefold().strip(),DrapAlert.resolved.is_(False)).limit(1))
        if alert:
            raise HTTPException(422,"DRAP Alert Violation: Batch is flagged as recalled/substandard")
        for key,value in changes.items(): setattr(inventory,key,value)
        inventory.updated_at = datetime.utcnow()
        await db.commit()
        entries = await load_catalog(db)
        return catalog_row(entries[medicine_id],entries)
    except Exception:
        await db.rollback(); raise


def seller_payload(seller: PharmacySeller) -> dict:
    return {"id":seller.id,"pharmacy_name":seller.pharmacy_name,"city":seller.city,"address":seller.address,
        "drug_license_no":seller.drug_license_no,"pharmacist_reg_no":seller.pharmacist_reg_no,
        "license_doc_url":seller.license_doc_url,"verification_status":seller.verification_status,
        "created_at":seller.created_at,"is_demo":demo_seller(seller.id)}


async def verify_seller(db: AsyncSession, seller_id: str, status: str) -> dict:
    seller = await db.get(PharmacySeller,seller_id)
    if seller is None: raise HTTPException(404,"Seller not found")
    if status not in {"VERIFIED","REJECTED"}: raise HTTPException(422,"Invalid verification status")
    seller.verification_status = status
    try: await db.commit()
    except Exception:
        await db.rollback(); raise
    return seller_payload(seller)


async def analytics(db: AsyncSession) -> dict[str,Any]:
    now = datetime.utcnow()
    today, month = now.replace(hour=0,minute=0,second=0,microsecond=0), now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    orders = list((await db.scalars(select(Order))).all())
    revenue_orders = [o for o in orders if o.status in {"CONFIRMED","DELIVERED"}]
    rows = (await db.execute(select(Medicine.category,func.count(distinct(Order.id)),func.sum(OrderItem.unit_price*OrderItem.quantity))
        .select_from(OrderItem).join(Order,Order.id == OrderItem.order_id).join(Medicine,Medicine.id == OrderItem.medicine_id)
        .where(Order.status.in_(["CONFIRMED","DELIVERED"])).group_by(Medicine.category)
        .order_by(func.sum(OrderItem.unit_price*OrderItem.quantity).desc(),Medicine.category))).all()
    catalog = await load_catalog(db)
    combined = {"today_revenue_pkr":money(sum((o.total_amount for o in revenue_orders if o.created_at.replace(tzinfo=None) >= today),Decimal(0))),
        "monthly_revenue_pkr":money(sum((o.total_amount for o in revenue_orders if o.created_at.replace(tzinfo=None) >= month),Decimal(0))),
        "total_orders_count":len(orders),"pending_rx_count":sum(o.status == "PENDING_RX_REVIEW" for o in orders),
        "concierge_queue_count":sum(o.status == "AWAITING_PHARMACIST_CART" for o in orders),
        "total_patient_savings_pkr":money(sum((o.total_savings_pkr for o in revenue_orders),Decimal(0))),
        "low_stock_items":[catalog_row(e,catalog) for e in catalog.values() if e.inventory and e.inventory.stock_quantity < 10],
        "top_categories":[{"category":category or "Uncategorized","order_count":count,"revenue_pkr":money(amount)} for category,count,amount in rows],
        "includes_demo_orders":any(o.customer_note and o.customer_note.startswith("[DEMO]") for o in orders),
        "revenue_basis":"CONFIRMED and DELIVERED order snapshots"}
    items = list((await db.scalars(select(OrderItem))).all())
    by_order: dict[str, list[OrderItem]] = {}
    for item in items:
        by_order.setdefault(item.order_id, []).append(item)
    demo_ids = {o.id for o in orders if demo_order(o, [i.medicine_id for i in by_order.get(o.id, [])], catalog)}
    combined["includes_demo_orders"] = bool(demo_ids)

    def metrics(is_demo: bool) -> dict[str, Any]:
        selected = [o for o in orders if (o.id in demo_ids) == is_demo]
        paid = [o for o in selected if o.status in {"CONFIRMED", "DELIVERED"}]
        categories: dict[str, dict[str, Any]] = {}
        for order in paid:
            for item in by_order.get(order.id, []):
                entry = catalog.get(item.medicine_id)
                category = entry.medicine.category if entry else "Uncategorized"
                group = categories.setdefault(category or "Uncategorized", {"orders": set(), "revenue": Decimal(0)})
                group["orders"].add(order.id)
                group["revenue"] += item.unit_price * item.quantity
        return {
            "today_revenue_pkr": money(sum((o.total_amount for o in paid if o.created_at.replace(tzinfo=None) >= today), Decimal(0))),
            "monthly_revenue_pkr": money(sum((o.total_amount for o in paid if o.created_at.replace(tzinfo=None) >= month), Decimal(0))),
            "total_orders_count": len(selected),
            "pending_rx_count": sum(o.status == "PENDING_RX_REVIEW" for o in selected),
            "concierge_queue_count": sum(o.status == "AWAITING_PHARMACIST_CART" for o in selected),
            "total_patient_savings_pkr": money(sum((o.total_savings_pkr for o in paid), Decimal(0))),
            "low_stock_items": [row for row in combined["low_stock_items"] if row["is_demo_seller"] == is_demo],
            "top_categories": [{"category": name, "order_count": len(value["orders"]), "revenue_pkr": money(value["revenue"])}
                               for name, value in sorted(categories.items(), key=lambda pair: (-pair[1]["revenue"], pair[0]))],
            "includes_demo_orders": is_demo and bool(selected),
            "revenue_basis": "Simulated demo orders; no payments collected" if is_demo else "Non-demo order snapshots; not payment receipts",
        }
    combined["real_metrics"] = metrics(False)
    combined["demo_metrics"] = metrics(True)
    return combined


async def catalog_sync(db: AsyncSession, records: list[dict], dry_run: bool = True) -> dict:
    catalog = await load_catalog(db)
    by_reg = {entry.medicine.drap_reg_no:entry for entry in catalog.values() if entry.medicine.drap_reg_no}
    seen, plan, diffs = set(), [], []
    counts = {"inserted_count":0,"updated_count":0,"unchanged_count":0}
    for index,raw in enumerate(records):
        try:
            fields = record_fields(raw)
            reg = fields["drap_reg_no"]
            if reg in seen: raise ValueError("Duplicate registration number in one sync")
            seen.add(reg)
            entry = by_reg.get(reg)
            new_fields = new_medicine_fields(fields) if entry is None else None
        except (ValueError,TypeError) as exc:
            raise HTTPException(422,f"Catalog record {index}: {exc}") from exc
        old = entry.mrp if entry else None
        changed = old is None or (old.notified_mrp,old.effective_date,old.pack_size) != (fields["notified_mrp"],fields["effective_date"],fields["pack_size"])
        action = "inserted" if entry is None or old is None else ("updated" if changed else "unchanged")
        counts[action+"_count"] += 1
        diffs.append({"product_name":fields["product_name"] or (entry.medicine.brand_name if entry else ""),
            "drap_reg_no":reg,"old_mrp":money(old.notified_mrp) if old else None,"new_mrp":fields["notified_mrp"],
            "effective_date":fields["effective_date"],"action":action})
        plan.append((entry,fields,new_fields,action))
    if dry_run: return {**counts,"dry_run":True,"diffs":diffs}
    from app.db.seed_mrp import ensure_price_portal_source
    try:
        source = await ensure_price_portal_source(db,None) if plan else None
        seller = await db.scalar(select(PharmacySeller).where(PharmacySeller.verification_status == "VERIFIED").order_by(PharmacySeller.id).limit(1))
        for entry,fields,new_fields,action in plan:
            if action == "unchanged": continue
            medicine = entry.medicine if entry else Medicine(**new_fields)
            if entry is None:
                db.add(medicine); await db.flush()
            reference = entry.mrp if entry else None
            if reference is None:
                reference = MrpReference(medicine_id=medicine.id,currency="PKR")
                db.add(reference)
                reference.pack_size,reference.effective_date,reference.notified_mrp = fields["pack_size"],fields["effective_date"],fields["notified_mrp"]
                reference.source_id = source.id
            else:
                refresh_reference(db,reference,fields,source.id)
            inventory = entry.inventory if entry else None
            if inventory is None:
                db.add(StoreInventory(medicine_id=medicine.id,seller_id=seller.id if seller else None,
                    selling_price=fields["notified_mrp"],requires_prescription=requires_rx(medicine.category)))
            elif inventory.selling_price > fields["notified_mrp"]:
                inventory.selling_price = fields["notified_mrp"]
        await db.commit()
    except Exception:
        await db.rollback(); raise
    return {**counts,"dry_run":False,"diffs":diffs}
