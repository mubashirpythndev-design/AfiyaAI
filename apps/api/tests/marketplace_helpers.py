"""Small synthetic catalog and real JWT authentication for marketplace tests."""
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.db.database import Base, Medicine, MrpReference, Source, User, PharmacySeller, StoreInventory, DrapAlert, get_db
from app.routers import store, duplication, admin
from app.services.auth_service import create_access_token


@pytest_asyncio.fixture
async def marketplace(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", "admin@marketplace.test")
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'marketplace.db'}")

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    ids = {}
    async with sessions() as db:
        seller = PharmacySeller(pharmacy_name="Synthetic test pharmacy", drug_license_no="TEST-ONLY",
                                pharmacist_reg_no="TEST-ONLY", verification_status="VERIFIED")
        source = Source(name="Synthetic test catalog", source_type="test")
        db.add_all([seller, source])
        await db.flush()
        seller_id = seller.id
        records = [
            ("panadol", "Panadol", "Paracetamol", "500mg", "Tablet", "Analgesic", "100", False),
            ("augmentin", "Augmentin", "Amoxicillin + Clavulanic Acid", "625mg", "Tablet", "Antibiotic", "200", True),
            ("losec", "Losec", "Omeprazole", "20mg", "Capsule", "Anti-ulcer", "200", False),
            ("risek", "Risek", "Omeprazole", "20mg", "Capsule", "Anti-ulcer", "100", False),
            ("pantoprazole", "TestPanto", "Pantoprazole", "20mg", "Capsule", "Anti-ulcer", "150", False),
            ("rigix", "Rigix", "Cetirizine", "10mg", "Tablet", "Antihistamine", "80", False),
            ("zyrtec", "Zyrtec", "Cetirizine", "10mg", "Tablet", "Antihistamine", "120", False),
        ]
        for key, brand, generic, strength, form, category, price, rx in records:
            med = Medicine(id=str(uuid4()), brand_name=brand, generic_name=generic, strength=strength,
                           dosage_form=form, category=category, drap_reg_no=f"TEST-{key}")
            db.add(med)
            await db.flush()
            ids[key] = med.id
            db.add_all([
                MrpReference(medicine_id=med.id, pack_size="1x10's", notified_mrp=Decimal(price),
                             effective_date=date(2026, 1, 1), source_id=source.id),
                StoreInventory(medicine_id=med.id, seller_id=seller.id, selling_price=Decimal(price),
                               stock_quantity=50, requires_prescription=rx),
            ])
        db.add(DrapAlert(medicine_id=ids["panadol"], batch_no="DEMO-BATCH-001", alert_type="recall",
                         resolved=False, is_demo=True, source_id=source.id))
        users = {}
        for role in ("buyer", "admin", "other"):
            user = User(id=str(uuid4()), name=role, email=f"{role}@marketplace.test", is_verified=True,
                        is_admin=role == "admin")
            db.add(user)
            users[role] = user
        await db.commit()
    app = FastAPI()
    for router in (store.router, duplication.router, admin.router):
        app.include_router(router)

    async def session_override():
        async with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = session_override
    headers = {role: {"Authorization": f"Bearer {create_access_token(user.id)}"} for role, user in users.items()}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield {"client": client, "sessions": sessions, "ids": ids, "headers": headers,
               "seller_id": seller_id, "users": users}
    await engine.dispose()


def cart(market, *keys, quantity=1, **extra):
    return {"items": [{"medicine_id": market["ids"][key], "quantity": quantity} for key in keys], **extra}


async def request(market, method, path, role="buyer", **kwargs):
    return await market["client"].request(method, path, headers=market["headers"][role] if role else {}, **kwargs)
