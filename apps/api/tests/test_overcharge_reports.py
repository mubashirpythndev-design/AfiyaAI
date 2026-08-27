"""Overcharge Reports endpoint tests.

Proves over real HTTP (TestClient) that:
  - POST /api/v1/overcharge-reports:
      - 401 without Bearer token.
      - 400 if price paid is at or below official DRAP MRP.
      - 201 with valid overcharged submission.
  - GET /api/admin/overcharge-reports:
      - 401 without Bearer token.
      - 403 for non-admin user.
      - 200 for admin user, returning summary stats and report list.
"""

import asyncio
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import app.db.database as dbmod
import app.db.seed_data as seed_data_mod
import app.main as main_mod
from app.main import app
from app.services.auth_service import create_access_token


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("overcharge") / "afiya_overcharge.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    old_engine, old_session = dbmod.engine, dbmod.async_session
    old_main_session = main_mod.async_session
    old_seed_session = seed_data_mod.async_session
    dbmod.engine, dbmod.async_session = engine, factory
    main_mod.async_session = factory
    seed_data_mod.async_session = factory
    try:
        with TestClient(app) as c:
            yield c
    finally:
        dbmod.engine, dbmod.async_session = old_engine, old_session
        main_mod.async_session = old_main_session
        seed_data_mod.async_session = old_seed_session
        asyncio.run(engine.dispose())


def test_overcharge_report_flow(client):
    # 1. Register a normal user and an admin user
    reg_user = client.post(
        "/api/auth/register",
        json={"name": "Normal User", "email": "user@example.com", "password": "password123"},
    )
    assert reg_user.status_code == 201
    user_token = reg_user.json()["access_token"]
    user_id = reg_user.json()["user"]["id"]

    with patch("app.config.settings.admin_emails", "admin@example.com"):
        reg_admin = client.post(
            "/api/auth/register",
            json={"name": "Admin User", "email": "admin@example.com", "password": "password123"},
        )
        assert reg_admin.status_code == 201
        admin_token = reg_admin.json()["access_token"]

    # 2. Match a medicine to get its ID (e.g. Risek 20mg)
    match_res = client.post("/api/medicines/match", json={"candidate": "Risek 20mg"})
    assert match_res.status_code == 200
    med_id = match_res.json()["medicine"]["id"]

    # 3. POST /api/v1/overcharge-reports without token -> 401
    unauth_res = client.post(
        "/api/v1/overcharge-reports",
        json={
            "medicine_id": med_id,
            "pharmacy_name": "Test Pharmacy",
            "city": "Lahore",
            "price_paid": 50.00,
        },
    )
    assert unauth_res.status_code == 401

    # 4. POST with price at or below MRP (Risek/Losec MRP is 180.00) -> 400
    valid_auth = {"Authorization": f"Bearer {user_token}"}
    low_price_res = client.post(
        "/api/v1/overcharge-reports",
        headers=valid_auth,
        json={
            "medicine_id": med_id,
            "pharmacy_name": "Fair Pharmacy",
            "city": "Lahore",
            "price_paid": 150.00,  # Below MRP (180.00)
        },
    )
    assert low_price_res.status_code == 400
    assert "Report rejected" in low_price_res.json()["detail"]

    # 5. POST with price above MRP (Rs 250.00 vs MRP 180.00) -> 201 Created
    overcharged_res = client.post(
        "/api/v1/overcharge-reports",
        headers=valid_auth,
        json={
            "medicine_id": med_id,
            "pharmacy_name": "Overcharging Pharmacy",
            "city": "Lahore",
            "price_paid": 250.00,
            "note": "Charged extra for packaging",
        },
    )
    assert overcharged_res.status_code == 201
    body = overcharged_res.json()
    assert body["pharmacy_name"] == "Overcharging Pharmacy"
    assert body["city"] == "Lahore"
    assert float(body["price_paid"]) == 250.00
    assert float(body["notified_mrp"]) == 180.00
    assert float(body["overcharge_amount"]) == 70.00

    # 6. GET /api/admin/overcharge-reports without token -> 401
    admin_unauth = client.get("/api/admin/overcharge-reports")
    assert admin_unauth.status_code == 401

    # 7. GET /api/admin/overcharge-reports as normal user -> 403 Forbidden
    admin_forbidden = client.get("/api/admin/overcharge-reports", headers=valid_auth)
    assert admin_forbidden.status_code == 403

    # 8. GET /api/admin/overcharge-reports as admin -> 200 OK
    admin_auth = {"Authorization": f"Bearer {admin_token}"}
    admin_success = client.get("/api/admin/overcharge-reports", headers=admin_auth)
    assert admin_success.status_code == 200
    admin_body = admin_success.json()
    assert admin_body["summary"]["total_reports"] >= 1
    assert float(admin_body["summary"]["total_overcharge_amount"]) >= 17.86
    assert len(admin_body["reports"]) >= 1
    assert admin_body["reports"][0]["pharmacy_name"] == "Overcharging Pharmacy"
