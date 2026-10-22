"""Demo records cannot inflate the dashboard's non-demo activity."""
from decimal import Decimal
from types import SimpleNamespace
import pytest
from sqlalchemy import select
from app.db.database import Order, OrderItem, StoreInventory, PharmacySeller
from app.services.marketplace_policy import DEMO_SELLERS, demo_id, demo_order
from marketplace_helpers import marketplace, request


def test_demo_classifier_recognizes_inventory_and_seeded_buyer():
    entry=SimpleNamespace(seller=SimpleNamespace(id=demo_id(DEMO_SELLERS[0][1])))
    catalog={"med":entry}
    order=SimpleNamespace(user_id="ordinary-buyer",customer_note="normal user note")
    assert demo_order(order,["med"],catalog)
    assert not demo_order(order,[],catalog)
    assert demo_order(SimpleNamespace(user_id=demo_id("buyer"),customer_note=None),[],{})


@pytest.mark.asyncio
async def test_dashboard_separates_demo_and_non_demo_orders(marketplace):
    async with marketplace["sessions"]() as db:
        # A seeded identity is recognized without relying on the customer note.
        seller=PharmacySeller(id=demo_id(DEMO_SELLERS[0][1]),pharmacy_name="Demo pharmacy",
            drug_license_no="DEMO-ANALYTICS",pharmacist_reg_no="DEMO-ANALYTICS",verification_status="VERIFIED")
        db.add(seller);await db.flush()
        med_id=marketplace["ids"]["panadol"]
        inventory=await db.scalar(select(StoreInventory).where(StoreInventory.medicine_id==med_id))
        inventory.seller_id=seller.id;inventory.stock_quantity=5
        buyer=marketplace["users"]["buyer"]
        demo=Order(user_id=buyer.id,status="CONFIRMED",total_amount=Decimal("100"),total_savings_pkr=Decimal("10"))
        real=Order(user_id=buyer.id,status="CONFIRMED",total_amount=Decimal("200"),total_savings_pkr=Decimal("20"))
        db.add_all([demo,real]);await db.flush()
        db.add_all([OrderItem(order_id=demo.id,medicine_id=med_id,quantity=1,unit_price=Decimal("100")),
            OrderItem(order_id=real.id,medicine_id=marketplace["ids"]["augmentin"],quantity=1,unit_price=Decimal("200"))])
        await db.commit()
    result=await request(marketplace,"GET","/api/admin/analytics",role="admin")
    assert result.status_code==200,result.text
    data=result.json()
    assert Decimal(str(data["monthly_revenue_pkr"]))==Decimal("300")
    assert Decimal(str(data["real_metrics"]["monthly_revenue_pkr"]))==Decimal("200")
    assert Decimal(str(data["demo_metrics"]["monthly_revenue_pkr"]))==Decimal("100")
    assert data["real_metrics"]["total_orders_count"]==1 and data["demo_metrics"]["total_orders_count"]==1
    assert not data["real_metrics"]["includes_demo_orders"] and data["demo_metrics"]["includes_demo_orders"]
    assert not data["real_metrics"]["low_stock_items"] and len(data["demo_metrics"]["low_stock_items"])==1
    assert data["real_metrics"]["top_categories"][0]["category"]=="Antibiotic"
    orders=(await request(marketplace,"GET","/api/v1/store/my-orders")).json()
    assert {row["id"]:row["is_demo"] for row in orders}=={demo.id:True,real.id:False}
