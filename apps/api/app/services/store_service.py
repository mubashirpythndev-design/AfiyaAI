"""Cart gates, immutable price snapshots and transactional order transitions."""
from datetime import datetime
from decimal import Decimal
from typing import Any
from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Order, OrderItem, StoreInventory, User
from app.models.marketplace_schemas import CartItem, CheckoutRequest, ConciergeRequest
from app.services.catalog_records import money
from app.services.duplication_service import check_duplications
from app.services.store_catalog import CatalogEntry, load_catalog, alternative, equivalent, medicine_info


async def evaluate_cart(db: AsyncSession, items: list[CartItem], prescription_attached: bool = False,
                        lang: str = "en", catalog: dict[str,CatalogEntry] | None = None) -> dict[str,Any]:
    catalog = catalog if catalog is not None else await load_catalog(db)
    identifiers = [item.medicine_id for item in items]
    if len(set(identifiers)) != len(identifiers):
        raise HTTPException(422,"Duplicate medicine_id; combine quantities")
    rx, shortages, invalid, unavailable, suggestions, lines = [], [], [], [], [], []
    total, savings = Decimal(0), Decimal(0)
    for item in items:
        entry = catalog.get(item.medicine_id)
        if not entry or not entry.inventory:
            invalid.append(item.medicine_id)
            continue
        inv = entry.inventory
        cost = money(inv.selling_price*item.quantity)
        if cost > Decimal("99999999.99"):
            raise HTTPException(422,"Cart amount exceeds supported order limit")
        total += cost
        baseline = entry.mrp.notified_mrp*item.quantity if entry.mrp else cost
        if item.switched_from_medicine_id:
            previous = catalog.get(item.switched_from_medicine_id)
            if not previous or not previous.inventory or previous.medicine.id == item.medicine_id or not equivalent(entry,previous):
                raise HTTPException(422,"Switch requires a different stored medicine with identical generic, strength and dosage form")
            if entry.pack and entry.pack.casefold() == previous.pack.casefold():
                baseline = max(baseline,previous.inventory.selling_price*item.quantity)
            elif entry.units and previous.units and (entry.units*item.quantity) % previous.units == 0:
                baseline = max(baseline,previous.inventory.selling_price*((entry.units*item.quantity)//previous.units))
            # No fractional-pack savings are credited for unprovable conversions.
        line_savings = money(max(Decimal(0),baseline-cost))
        savings += line_savings
        if inv.requires_prescription:
            rx.append(medicine_info(entry.medicine))
        if inv.stock_quantity < item.quantity:
            shortages.append({"medicine_id":item.medicine_id,"requested":item.quantity,"available":inv.stock_quantity})
        if not entry.available:
            unavailable.append({"medicine_id":item.medicine_id,"batch_recalled":entry.recalled,
                "seller_verified":bool(entry.seller and entry.seller.verification_status == "VERIFIED"),
                "mrp_cap_valid":entry.mrp is None or inv.selling_price <= entry.mrp.notified_mrp})
        suggestion = alternative(entry,catalog,item.quantity,set(identifiers),whole_packs=True)
        if suggestion:
            suggestions.append({"from_medicine_id":item.medicine_id,"quantity":item.quantity,**suggestion})
        lines.append({**medicine_info(entry.medicine),"quantity":item.quantity,"quantity_unit":"pack",
            "unit_price":money(inv.selling_price),"line_total_pkr":cost,"savings_pkr":line_savings,
            "switched_from_medicine_id":item.switched_from_medicine_id})
    duplication = await check_duplications(db,[{"medicine_id":i} for i in identifiers],lang)
    duplication_lock = duplication["has_duplication"] and not prescription_attached
    rx_gate_lock = bool(rx) and not prescription_attached
    reasons = []
    if total > Decimal("99999999.99") or savings > Decimal("99999999.99"):
        raise HTTPException(422,"Cart amount exceeds supported order limit")
    if not items: reasons.append("EMPTY_CART")
    if invalid: reasons.append("UNKNOWN_OR_UNLISTED_MEDICINE")
    if shortages: reasons.append("INSUFFICIENT_STOCK")
    if unavailable: reasons.append("INVENTORY_UNAVAILABLE_OR_REGULATORY_HOLD")
    if duplication_lock: reasons.append("DUPLICATION_REQUIRES_PRESCRIPTION_REVIEW")
    if rx_gate_lock: reasons.append("PRESCRIPTION_REQUIRED")
    return {"items":lines,"cart_total_pkr":money(total),"total_savings_pkr":money(savings),
        "rx_required_items":rx,"duplication_check":duplication,"duplication_lock":duplication_lock,
        "rx_gate_lock":rx_gate_lock,"duplication_warnings":duplication["same_generic_alerts"]+duplication["same_class_alerts"],
        "switch_suggestions":suggestions,"stock_shortages":shortages,"unresolved":invalid,
        "unavailable_items":unavailable,"lock_reasons":reasons,"can_checkout":not reasons,
        "quantity_unit":"pack","disclaimer":duplication["disclaimer"]}


def require_checkout(evaluation: dict) -> None:
    if not evaluation["can_checkout"]:
        raise HTTPException(422,detail={"message":"Cart cannot be checked out","lock_reasons":evaluation["lock_reasons"],
            "stock_shortages":evaluation["stock_shortages"]})


async def consume_stock(db: AsyncSession, items: list[CartItem]) -> None:
    for item in sorted(items,key=lambda i:i.medicine_id):
        result = await db.execute(update(StoreInventory).where(StoreInventory.medicine_id == item.medicine_id,
            StoreInventory.stock_quantity >= item.quantity).values(stock_quantity=StoreInventory.stock_quantity-item.quantity,
            updated_at=datetime.utcnow()).execution_options(synchronize_session=False))
        if result.rowcount != 1:
            raise HTTPException(422,"Insufficient stock; reload the cart")


async def replace_items(db: AsyncSession, order: Order, evaluation: dict) -> None:
    await db.execute(delete(OrderItem).where(OrderItem.order_id == order.id))
    for item in evaluation["items"]:
        db.add(OrderItem(order_id=order.id,medicine_id=item["medicine_id"],quantity=item["quantity"],
            unit_price=item["unit_price"],switched_from_medicine_id=item.get("switched_from_medicine_id")))
    order.total_amount = evaluation["cart_total_pkr"]
    order.total_savings_pkr = evaluation["total_savings_pkr"]


async def checkout(db: AsyncSession, req: CheckoutRequest, user: User) -> dict:
    try:
        evaluation = await evaluate_cart(db,req.items,bool(req.prescription_image_url))
        require_checkout(evaluation)
        review = bool(req.prescription_image_url or evaluation["duplication_check"]["has_duplication"])
        order = Order(user_id=user.id,status="PENDING_RX_REVIEW" if review else "CONFIRMED",
            prescription_image_url=req.prescription_image_url,customer_note=req.customer_note,
            has_duplication_override=bool(evaluation["duplication_check"]["has_duplication"] and req.prescription_image_url))
        db.add(order); await db.flush()
        await replace_items(db,order,evaluation)
        if not review:
            await consume_stock(db,req.items)
        await db.commit()
        return (await order_payloads(db,[order]))[0]
    except Exception:
        await db.rollback()
        raise


async def concierge(db: AsyncSession, req: ConciergeRequest, user: User) -> dict:
    order = Order(user_id=user.id,status="AWAITING_PHARMACIST_CART",prescription_image_url=req.prescription_image_url,
        customer_note=req.customer_note,total_amount=Decimal(0))
    db.add(order)
    try:
        await db.commit()
    except Exception:
        await db.rollback(); raise
    return (await order_payloads(db,[order]))[0]


async def get_order(db: AsyncSession, order_id: str, user_id: str | None = None) -> Order:
    stmt = select(Order).where(Order.id == order_id)
    if user_id is not None: stmt = stmt.where(Order.user_id == user_id)
    order = await db.scalar(stmt)
    if order is None: raise HTTPException(404,"Order not found")
    return order


async def claim_transition(db: AsyncSession, order: Order, expected: str, target: str) -> None:
    if order.status != expected:
        raise HTTPException(409,f"Order must be in {expected} status")
    changed = await db.execute(update(Order).where(Order.id == order.id,Order.status == expected)
        .values(status=target).execution_options(synchronize_session=False))
    if changed.rowcount != 1:
        raise HTTPException(409,"Order changed; reload it")
    order.status = target


async def order_items(db: AsyncSession, order_id: str) -> list[OrderItem]:
    return list((await db.scalars(select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id))).all())


async def approve_rx(db: AsyncSession, order_id: str) -> dict:
    try:
        order = await get_order(db,order_id)
        await claim_transition(db,order,"PENDING_RX_REVIEW","CONFIRMED")
        stored = await order_items(db,order.id)
        items = [CartItem(medicine_id=i.medicine_id,quantity=i.quantity) for i in stored]
        catalog = await load_catalog(db)
        require_checkout(await evaluate_cart(db,items,True,catalog=catalog))
        if any(catalog[i.medicine_id].mrp and i.unit_price > catalog[i.medicine_id].mrp.notified_mrp for i in stored):
            raise HTTPException(422,"Stored order price exceeds current MRP; rebuild the quote")
        await consume_stock(db,items)
        order.verified_by_pharmacist = True
        await db.commit()
        return (await order_payloads(db,[order]))[0]
    except Exception:
        await db.rollback(); raise


async def build_cart(db: AsyncSession, order_id: str, items: list[CartItem]) -> dict:
    try:
        order = await get_order(db,order_id)
        await claim_transition(db,order,"AWAITING_PHARMACIST_CART","CART_READY_FOR_USER")
        evaluation = await evaluate_cart(db,items,True)
        require_checkout(evaluation)
        await replace_items(db,order,evaluation)
        order.verified_by_pharmacist = True
        order.has_duplication_override = evaluation["duplication_check"]["has_duplication"]
        await db.commit()
        return (await order_payloads(db,[order]))[0]
    except Exception:
        await db.rollback(); raise


async def confirm_cart(db: AsyncSession, order_id: str, user: User, replacements: list[CartItem] | None = None) -> dict:
    try:
        order = await get_order(db,order_id,user.id)
        await claim_transition(db,order,"CART_READY_FOR_USER","CONFIRMED")
        if not order.verified_by_pharmacist or not order.prescription_image_url:
            raise HTTPException(422,"Pharmacist review and original prescription are required")
        original = await order_items(db,order.id)
        items = replacements if replacements is not None else [CartItem(medicine_id=i.medicine_id,quantity=i.quantity,
            switched_from_medicine_id=i.switched_from_medicine_id) for i in original]
        catalog = await load_catalog(db)
        if replacements is not None:
            by_id = {i.medicine_id:i for i in original}
            mapped = set()
            for item in items:
                source_id = item.switched_from_medicine_id or item.medicine_id
                old, target = by_id.get(source_id), catalog.get(item.medicine_id)
                previous = catalog.get(source_id)
                if not old or not target or not previous or source_id in mapped or not equivalent(previous,target):
                    raise HTTPException(422,"Updated cart may only switch pharmacist-approved medicines to compatible alternatives")
                mapped.add(source_id)
                if item.medicine_id == source_id:
                    valid_quantity = item.quantity == old.quantity
                else:
                    suggestion = alternative(previous,catalog,old.quantity,whole_packs=True)
                    valid_quantity = bool(suggestion and suggestion["medicine_id"] == item.medicine_id and suggestion["target_quantity"] == item.quantity)
                if not valid_quantity: raise HTTPException(422,"Switch must preserve the evaluated whole-pack quantity")
            if mapped != set(by_id): raise HTTPException(422,"Updated cart must preserve the pharmacist-approved medicine list")
        evaluation = await evaluate_cart(db,items,True,catalog=catalog)
        require_checkout(evaluation)
        await replace_items(db,order,evaluation)
        order.has_duplication_override = evaluation["duplication_check"]["has_duplication"]
        await consume_stock(db,items)
        await db.commit()
        return (await order_payloads(db,[order]))[0]
    except Exception:
        await db.rollback(); raise


async def order_payloads(db: AsyncSession, orders: list[Order], *, include_buyer: bool = False) -> list[dict]:
    if not orders: return []
    catalog = await load_catalog(db)
    ids = [o.id for o in orders]
    grouped: dict[str,list[OrderItem]] = {}
    for item in (await db.scalars(select(OrderItem).where(OrderItem.order_id.in_(ids)).order_by(OrderItem.id))).all():
        grouped.setdefault(item.order_id,[]).append(item)
    buyers = {u.id:u for u in (await db.scalars(select(User).where(User.id.in_({o.user_id for o in orders})))).all()} if include_buyer else {}
    result = []
    for order in orders:
        rows = []
        for item in grouped.get(order.id,[]):
            entry = catalog.get(item.medicine_id)
            rows.append({**(medicine_info(entry.medicine) if entry else {"medicine_id":item.medicine_id}),
                "quantity":item.quantity,"unit_price":money(item.unit_price),"quantity_unit":"pack",
                "switched_from_medicine_id":item.switched_from_medicine_id,
                "cheapest_alternative":alternative(entry,catalog,item.quantity,whole_packs=True) if entry else None})
        payload = {"id":order.id,"order_id":order.id,"status":order.status,"prescription_image_url":order.prescription_image_url,
            "customer_note":order.customer_note,"has_duplication_override":order.has_duplication_override,
            "verified_by_pharmacist":order.verified_by_pharmacist,"total_amount":money(order.total_amount),
            "total_savings_pkr":money(order.total_savings_pkr),"created_at":order.created_at,"items":rows,
            "is_demo":bool(order.customer_note and order.customer_note.startswith("[DEMO]"))}
        if include_buyer:
            buyer = buyers.get(order.user_id)
            payload.update(user_id=order.user_id,buyer_name=buyer.name if buyer else None,buyer_email=buyer.email if buyer else None)
        result.append(payload)
    return result
