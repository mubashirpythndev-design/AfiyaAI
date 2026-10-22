import asyncio
import importlib.util
import json
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select, func, create_engine, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.db.database import Medicine, MrpReference, StoreInventory, Order, OrderItem, PharmacySeller, KnowledgeChunk
from app.db.seed_marketplace import seed_marketplace
from app.db.seed_mrp import seed_mrp_reference
from marketplace_helpers import marketplace, cart, request
from conftest import API_DIR, create_pre_migration_db, run_alembic

STORE = "/api/v1/store"
ADMIN = "/api/admin"


@pytest.mark.asyncio
async def test_migration_upgrade_idempotence_downgrade(tmp_path):
    db_file = tmp_path / "migration.db"
    await create_pre_migration_db(db_file)
    await asyncio.to_thread(run_alembic, db_file, "upgrade", "0006")
    await asyncio.to_thread(run_alembic, db_file, "upgrade", "0007_marketplace_store")
    engine = create_engine(f"sqlite:///{db_file}")
    expected = {"pharmacy_sellers", "store_inventory", "orders", "order_items"}
    with engine.begin() as connection:
        assert expected <= set(inspect(connection).get_table_names())
        spec = importlib.util.spec_from_file_location("marketplace_migration", API_DIR / "alembic/versions/0007_add_marketplace_store.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
        assert inspect(connection).get_indexes("store_inventory")[0]["unique"]
    engine.dispose()
    await asyncio.to_thread(run_alembic, db_file, "downgrade", "0006")
    engine = create_engine(f"sqlite:///{db_file}")
    assert not expected.intersection(inspect(engine).get_table_names())
    assert "users" in inspect(engine).get_table_names()
    engine.dispose()
    await asyncio.to_thread(run_alembic, db_file, "upgrade", "head")
    engine = create_engine(f"sqlite:///{db_file}")
    with engine.connect() as connection:
        from sqlalchemy import text
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0013"
    engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("keys,attached,allowed,rx,dup", [
    (["panadol"], False, True, False, False),
    (["augmentin"], False, False, True, False),
    (["augmentin"], True, True, False, False),
    (["losec", "risek"], False, False, False, True),
    (["losec", "risek"], True, True, False, False),
])
async def test_cart_gates(marketplace, keys, attached, allowed, rx, dup):
    response = await request(marketplace, "POST", STORE + "/cart-evaluate", role=None,
                             json=cart(marketplace, *keys, prescription_attached=attached))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["can_checkout"] is allowed
    assert result["rx_gate_lock"] is rx
    assert result["duplication_lock"] is dup


@pytest.mark.asyncio
async def test_catalog_switch_pack_prices_and_stock(marketplace):
    catalog = (await request(marketplace, "GET", STORE + "/catalog", role=None)).json()
    losec = next(row for row in catalog if row["medicine_id"] == marketplace["ids"]["losec"])
    assert losec["cheapest_alternative"]["medicine_id"] == marketplace["ids"]["risek"]
    result = (await request(marketplace, "POST", STORE + "/cart-evaluate", json=cart(marketplace, "losec", quantity=2))).json()
    assert Decimal(str(result["cart_total_pkr"])) == 400
    assert Decimal(str(result["switch_suggestions"][0]["savings_pkr"])) == 200
    # A cheaper unit price does not imply a cheaper whole pack purchase.
    async with marketplace["sessions"]() as db:
        ref = await db.scalar(select(MrpReference).where(MrpReference.medicine_id == marketplace["ids"]["risek"]))
        ref.pack_size = "1x30's"
        inventory = await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id == ref.medicine_id))
        inventory.selling_price = Decimal("250")
        ref.notified_mrp = Decimal("250")
        await db.commit()
    result = (await request(marketplace, "POST", STORE + "/cart-evaluate", json=cart(marketplace, "losec"))).json()
    assert not result["switch_suggestions"]
    result = (await request(marketplace, "POST", STORE + "/cart-evaluate", json=cart(marketplace, "losec", quantity=3))).json()
    assert result["switch_suggestions"][0]["target_quantity"] == 1
    assert Decimal(str(result["switch_suggestions"][0]["savings_pkr"])) == 350


@pytest.mark.asyncio
@pytest.mark.parametrize("update,error", [
    ({"selling_price": "100.01"}, "Regulatory Violation: Selling price cannot exceed DRAP Notified MRP"),
    ({"active_batch_no": "DEMO-BATCH-001"}, "DRAP Alert Violation: Batch is flagged as recalled/substandard"),
])
async def test_inventory_regulatory_guards(marketplace, update, error):
    response = await request(marketplace, "PATCH", ADMIN + "/inventory/" + marketplace["ids"]["panadol"], role="admin", json=update)
    assert response.status_code == 422, response.text
    assert response.json()["detail"] == error
    async with marketplace["sessions"]() as db:
        inventory = await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id == marketplace["ids"]["panadol"]))
        assert inventory.selling_price == 100
        assert inventory.active_batch_no == "BATCH-2026-OK"


@pytest.mark.asyncio
async def test_checkout_otc_review_and_approval_once(marketplace):
    denied = await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "augmentin"))
    assert denied.status_code == 422
    otc = await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "panadol", quantity=2))
    assert otc.status_code == 200, otc.text
    assert otc.json()["status"] == "CONFIRMED"
    rx = await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "augmentin", quantity=3,
                       prescription_image_url="https://example.test/rx.jpg"))
    assert rx.status_code == 200, rx.text
    assert rx.json()["status"] == "PENDING_RX_REVIEW"
    async with marketplace["sessions"]() as db:
        assert (await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["panadol"]))) == 48
        assert (await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["augmentin"]))) == 50
    path = ADMIN + f"/orders/{rx.json()['id']}/approve-rx"
    approved = await request(marketplace, "POST", path, role="admin")
    assert approved.status_code == 200, approved.text
    assert approved.json()["verified_by_pharmacist"]
    assert (await request(marketplace, "POST", path, role="admin")).status_code == 409
    async with marketplace["sessions"]() as db:
        assert (await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["augmentin"]))) == 47


@pytest.mark.asyncio
async def test_concierge_flow_and_owner_isolation(marketplace):
    response = await request(marketplace, "POST", STORE + "/concierge-rx", json={"prescription_image_url": "https://example.test/rx.jpg"})
    assert response.status_code == 200, response.text
    order = response.json()
    assert order["status"] == "AWAITING_PHARMACIST_CART"
    response = await request(marketplace, "POST", ADMIN + f"/orders/{order['id']}/build-cart", role="admin",
                             json=cart(marketplace, "losec", quantity=2))
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CART_READY_FOR_USER"
    path = STORE + f"/my-orders/{order['id']}/confirm-cart"
    assert (await request(marketplace, "POST", path, role="other")).status_code == 404
    changed = {"items": [{"medicine_id":marketplace["ids"]["risek"], "quantity":2,
                           "switched_from_medicine_id":marketplace["ids"]["losec"]}]}
    response = await request(marketplace, "POST", path, json=changed)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CONFIRMED"
    assert Decimal(str(response.json()["total_amount"])) == 200
    assert Decimal(str(response.json()["total_savings_pkr"])) == 200
    assert (await request(marketplace, "POST", path)).status_code == 409
    assert (await request(marketplace, "GET", STORE + "/my-orders", role="other")).json() == []
    own = (await request(marketplace, "GET", STORE + "/my-orders")).json()
    assert len(own) == 1 and own[0]["items"][0]["brand_name"] == "Risek"
    async with marketplace["sessions"]() as db:
        assert (await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["risek"]))) == 48


@pytest.mark.asyncio
async def test_failed_approval_rolls_back_transition_and_stock(marketplace):
    response = await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "augmentin", quantity=2,
                             prescription_image_url="https://example.test/rx.jpg"))
    order_id = response.json()["id"]
    async with marketplace["sessions"]() as db:
        inventory = await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id == marketplace["ids"]["augmentin"]))
        inventory.stock_quantity = 1
        await db.commit()
    response = await request(marketplace, "POST", ADMIN + f"/orders/{order_id}/approve-rx", role="admin")
    assert response.status_code == 422
    async with marketplace["sessions"]() as db:
        assert (await db.get(Order, order_id)).status == "PENDING_RX_REVIEW"
        assert await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["augmentin"])) == 1


@pytest.mark.asyncio
async def test_concurrent_checkout_does_not_oversell(marketplace):
    results = await asyncio.gather(*[request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "panadol", quantity=40)) for _ in range(2)])
    assert sorted(r.status_code for r in results) == [200, 422], [r.text for r in results]
    async with marketplace["sessions"]() as db:
        assert await db.scalar(select(StoreInventory.stock_quantity).where(StoreInventory.medicine_id == marketplace["ids"]["panadol"])) == 10
        assert await db.scalar(select(func.count()).select_from(Order)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("items", [[], [{"medicine_id":"missing", "quantity":1}], [{"medicine_id":"panadol", "quantity":51}]])
async def test_invalid_or_insufficient_cart(marketplace, items):
    body = {"items": [{**item, "medicine_id":marketplace["ids"].get(item["medicine_id"], item["medicine_id"])} for item in items]}
    evaluated = await request(marketplace, "POST", STORE + "/cart-evaluate", json=body)
    assert not evaluated.json()["can_checkout"]
    assert (await request(marketplace, "POST", STORE + "/checkout", json=body)).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("quantity", [0, -1, 1.5, True, "2"])
async def test_quantity_validation(marketplace, quantity):
    assert (await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "panadol", quantity=quantity))).status_code == 422


@pytest.mark.asyncio
async def test_recalled_and_unverified_inventory_block_checkout(marketplace):
    async with marketplace["sessions"]() as db:
        inventory = await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id == marketplace["ids"]["panadol"]))
        inventory.active_batch_no = "demo-batch-001"
        await db.commit()
    assert (await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "panadol"))).status_code == 422
    rejected = await request(marketplace, "POST", ADMIN + f"/sellers/{marketplace['seller_id']}/verify", role="admin", json={"verification_status":"REJECTED"})
    assert rejected.status_code == 200, rejected.text
    assert (await request(marketplace, "POST", STORE + "/checkout", json=cart(marketplace, "rigix"))).status_code == 422


@pytest.mark.asyncio
async def test_admin_auth_all_routes(marketplace):
    routes = [("GET", "/analytics", None), ("GET", "/orders", None), ("GET", "/inventory", None),
              ("GET", "/sellers", None), ("POST", "/catalog-sync", {"records": []}),
              ("PATCH", "/inventory/unknown", {"stock_quantity": 2}),
              ("POST", "/orders/unknown/build-cart", cart(marketplace,"panadol")),
              ("POST", "/orders/unknown/approve-rx", None),
              ("POST", "/sellers/unknown/verify", {"verification_status":"VERIFIED"})]
    for method, path, body in routes:
        kwargs = {"json":body} if body is not None else {}
        assert (await request(marketplace,method,ADMIN+path,role=None,**kwargs)).status_code == 401, path
        assert (await request(marketplace,method,ADMIN+path,**kwargs)).status_code == 403, path
    for path, body in [("/checkout",cart(marketplace,"panadol")), ("/concierge-rx",{"prescription_image_url":"https://example.test/rx"}),
                       ("/my-orders/unknown/confirm-cart",{})]:
        assert (await request(marketplace,"POST",STORE+path,role=None,json=body)).status_code == 401
    assert (await request(marketplace,"GET",STORE+"/my-orders",role=None)).status_code == 401


@pytest.mark.asyncio
async def test_catalog_sync_dry_run_apply_and_atomic_validation(marketplace):
    record = {"Registration_No":"TEST-panadol", "Price":"90.25", "Packsize":"2x10's", "effective from":"2026-10-01"}
    new = {"Registration_No":"TEST-new", "Product_name":"NewBrand 10mg Tablet", "Generic":"StoredGeneric",
           "Category":"NovelCategory", "Price":"55.50", "Packsize":"1x10's", "effective from":"2026-10-01"}
    path = ADMIN + "/catalog-sync"
    body = {"records":[record,new], "dry_run":True}
    response = await request(marketplace,"POST",path,role="admin",json=body)
    assert response.status_code == 200, response.text
    assert response.json()["updated_count"] == response.json()["inserted_count"] == 1
    async with marketplace["sessions"]() as db:
        assert await db.scalar(select(func.count()).select_from(Medicine)) == 7
    body["dry_run"] = False
    response = await request(marketplace,"POST",path,role="admin",json=body)
    assert response.status_code == 200, response.text
    response = await request(marketplace,"POST",path,role="admin",json=body)
    assert response.json()["unchanged_count"] == 2
    async with marketplace["sessions"]() as db:
        ref = await db.scalar(select(MrpReference).where(MrpReference.medicine_id == marketplace["ids"]["panadol"]))
        assert (ref.notified_mrp,ref.pack_size,ref.effective_date) == (Decimal("90.25"),"2x10's",date(2026,10,1))
        assert await db.scalar(select(StoreInventory.selling_price).where(StoreInventory.medicine_id == ref.medicine_id)) == Decimal("90.25")
        assert await db.scalar(select(func.count()).select_from(Medicine)) == 8
    response = await request(marketplace,"POST",path,role="admin",json={"records":[{**record,"Price":"40"},{**new,"Price":"NaN"}], "dry_run":False})
    assert response.status_code == 422
    async with marketplace["sessions"]() as db:
        assert await db.scalar(select(MrpReference.notified_mrp).where(MrpReference.medicine_id == marketplace["ids"]["panadol"])) == Decimal("90.25")


@pytest.mark.asyncio
async def test_inventory_valid_updates_and_seller_approval(marketplace):
    path = ADMIN + "/inventory/" + marketplace["ids"]["panadol"]
    response = await request(marketplace,"PATCH",path,role="admin",json={"selling_price":"80.25", "stock_quantity":5,
                            "active_batch_no":"TEST-NEW", "requires_prescription":False})
    assert response.status_code == 200, response.text
    assert Decimal(str(response.json()["selling_price"])) == Decimal("80.25")
    evaluation = (await request(marketplace,"POST",STORE+"/cart-evaluate",json=cart(marketplace,"panadol",quantity=2))).json()
    assert Decimal(str(evaluation["total_savings_pkr"])) == Decimal("39.50")
    response = await request(marketplace,"GET",ADMIN+"/analytics",role="admin")
    assert len(response.json()["low_stock_items"]) == 1
    sellers = (await request(marketplace,"GET",ADMIN+"/sellers",role="admin")).json()
    response = await request(marketplace,"POST",ADMIN+f"/sellers/{sellers[0]['id']}/verify",role="admin",json={"verification_status":"VERIFIED"})
    assert response.status_code == 200 and response.json()["verification_status"] == "VERIFIED"


@pytest.mark.asyncio
async def test_unsafe_switches_and_unreviewed_cart_changes_rejected(marketplace):
    response = await request(marketplace,"POST",STORE+"/cart-evaluate",json={"items":[{
        "medicine_id":marketplace["ids"]["panadol"],"quantity":1,"switched_from_medicine_id":marketplace["ids"]["losec"]}]})
    assert response.status_code == 422
    order = (await request(marketplace,"POST",STORE+"/concierge-rx",json={"prescription_image_url":"https://example.test/rx"})).json()
    await request(marketplace,"POST",ADMIN+f"/orders/{order['id']}/build-cart",role="admin",json=cart(marketplace,"losec"))
    path = STORE+f"/my-orders/{order['id']}/confirm-cart"
    for replacement in [cart(marketplace,"losec",quantity=2), cart(marketplace,"panadol")]:
        assert (await request(marketplace,"POST",path,json=replacement)).status_code == 422
    assert (await request(marketplace,"POST",path)).status_code == 200


@pytest.mark.asyncio
async def test_different_strength_or_form_never_suggested(marketplace):
    async with marketplace["sessions"]() as db:
        risek = await db.get(Medicine,marketplace["ids"]["risek"])
        risek.dosage_form = "Modified release capsule"
        await db.commit()
    data = (await request(marketplace,"POST",STORE+"/cart-evaluate",json=cart(marketplace,"losec"))).json()
    assert not data["switch_suggestions"]
    async with marketplace["sessions"]() as db:
        risek = await db.get(Medicine,marketplace["ids"]["risek"])
        risek.dosage_form, risek.strength = "Capsule", "40mg"
        await db.commit()
    data = (await request(marketplace,"POST",STORE+"/cart-evaluate",json=cart(marketplace,"losec"))).json()
    assert not data["switch_suggestions"]


@pytest.mark.asyncio
async def test_duplication_override_requires_pharmacist_review(marketplace):
    response = await request(marketplace,"POST",STORE+"/checkout",json=cart(marketplace,"losec","risek"))
    assert response.status_code == 422
    response = await request(marketplace,"POST",STORE+"/checkout",json=cart(marketplace,"losec","risek",
                             prescription_image_url="https://example.test/rx"))
    assert response.status_code == 200, response.text
    assert response.json()["has_duplication_override"] and response.json()["status"] == "PENDING_RX_REVIEW"
    approved = await request(marketplace,"POST",ADMIN+f"/orders/{response.json()['id']}/approve-rx",role="admin")
    assert approved.status_code == 200


@pytest.mark.asyncio
async def test_sync_rejects_duplicate_keys_and_foreign_currency(marketplace):
    record = {"Registration_No":"TEST-panadol","Price":"50","Packsize":"1x10's"}
    for records in [[record,record], [{**record,"currency":"USD"}],
                    [{**record,"Registration_No":"TEST-incomplete","Product_name":"UnknownBrand","Generic":"SuppliedGeneric"}]]:
        response = await request(marketplace,"POST",ADMIN+"/catalog-sync",role="admin",json={"records":records,"dry_run":False})
        assert response.status_code == 422, response.text
    async with marketplace["sessions"]() as db:
        assert await db.scalar(select(MrpReference.notified_mrp).where(MrpReference.medicine_id == marketplace["ids"]["panadol"])) == 100


@pytest.mark.asyncio
async def test_seed_mrp_upserts_and_marketplace_idempotence(marketplace, tmp_path, monkeypatch):
    path = tmp_path / "catalog.json"
    records = [{"Registration_No":"TEST-panadol","Product_name":"Panadol 500mg Tablet","Price":"95.45","Packsize":"2x10's","effective from":"2026-10-02"},
               {"Registration_No":"TEST-seeded","Product_name":"Seeded 10mg Tablet","Generic":"StoredGeneric",
                "Category":"Novel category","Price":"60","Packsize":"1x10's"}]
    path.write_text(json.dumps(records),encoding="utf-8")
    async with marketplace["sessions"]() as db:
        report = await seed_mrp_reference(db,path)
        assert report.rows_updated == 1 and report.medicines_inserted == 1
        report = await seed_mrp_reference(db,path)
        assert report.rows_updated == report.rows_inserted == report.medicines_inserted == 0
        await seed_marketplace(db)
        first = {table:await db.scalar(select(func.count()).select_from(table)) for table in (PharmacySeller,StoreInventory,Order,OrderItem)}
        await seed_marketplace(db)
        second = {table:await db.scalar(select(func.count()).select_from(table)) for table in first}
        assert first == second
        assert first[Order] == first[OrderItem] == 5
        assert first[PharmacySeller] == 4 and first[StoreInventory] == 8
        assert all(order.total_savings_pkr > 0 for order in (await db.scalars(select(Order))).all())
        from app.db import seed_knowledge
        monkeypatch.setattr(seed_knowledge,"DRAP_DATA_PATH",path)
        await seed_knowledge.seed_knowledge_chunks(db)
        new_med = await db.scalar(select(Medicine).where(Medicine.drap_reg_no == "TEST-seeded"))
        profile = await db.scalar(select(KnowledgeChunk.content).where(KnowledgeChunk.medicine_id == new_med.id,
                                  KnowledgeChunk.chunk_type == "verified_profile"))
        assert "StoredGeneric" in profile and "Novel category" in profile
        assert "ask a doctor or pharmacist what it is used for" in profile
    response = await request(marketplace,"GET",ADMIN+"/analytics",role="admin")
    assert response.status_code == 200, response.text
    data = response.json()
    assert Decimal(str(data["today_revenue_pkr"])) > 0 and Decimal(str(data["monthly_revenue_pkr"])) > 0
    assert Decimal(str(data["total_patient_savings_pkr"])) > 0 and data["top_categories"]
    assert data["includes_demo_orders"]
    orders = await request(marketplace,"GET",ADMIN+"/orders",role="admin")
    assert len(orders.json()) == 5 and orders.json()[0]["buyer_email"]
