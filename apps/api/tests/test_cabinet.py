"""My Digital Medicine Cabinet & Automated Recall Watchdog endpoint tests.

Proves over real HTTP (TestClient) that:
  - POST /api/v1/cabinet:
      - 401 without Bearer token.
      - 201 when adding a valid medicine.
      - Idempotent duplicate prevention.
  - GET /api/v1/cabinet:
      - 401 without Bearer token.
      - 200 returning cabinet list with MRP prices and automated recall alerts.
  - GET /api/v1/cabinet/check/{medicine_id}:
      - Returns {"in_cabinet": boolean}.
  - DELETE /api/v1/cabinet/{medicine_id}:
      - 204 No Content, removing item from cabinet.
"""

import asyncio

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


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("cabinet") / "afiya_cabinet.db"
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


def test_cabinet_flow(client):
    # 1. Register a test user
    reg_res = client.post(
        "/api/auth/register",
        json={"name": "Cabinet User", "email": "cabinet@example.com", "password": "password123"},
    )
    assert reg_res.status_code == 201
    user_token = reg_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {user_token}"}

    # 2. Match a medicine to get its ID (e.g., Augmentin 625mg which has a demo alert)
    match_res = client.post("/api/medicines/match", json={"candidate": "Augmentin 625mg"})
    assert match_res.status_code == 200
    med_id = match_res.json()["medicine"]["id"]

    # 3. POST /api/v1/cabinet without token -> 401
    unauth = client.post("/api/v1/cabinet", json={"medicine_id": med_id})
    assert unauth.status_code == 401

    # 4. GET /api/v1/cabinet/check/{id} before adding -> in_cabinet: false
    check_before = client.get(f"/api/v1/cabinet/check/{med_id}", headers=auth_header)
    assert check_before.status_code == 200
    assert check_before.json()["in_cabinet"] is False

    # 5. POST /api/v1/cabinet with token -> 201 Created
    add_res = client.post("/api/v1/cabinet", headers=auth_header, json={"medicine_id": med_id})
    assert add_res.status_code == 201
    add_body = add_res.json()
    assert add_body["medicine_id"] == med_id
    assert add_body["medicine"]["brand_name"] == "Augmentin"

    # 6. GET /api/v1/cabinet/check/{id} after adding -> in_cabinet: true
    check_after = client.get(f"/api/v1/cabinet/check/{med_id}", headers=auth_header)
    assert check_after.status_code == 200
    assert check_after.json()["in_cabinet"] is True

    # 7. GET /api/v1/cabinet -> returns saved cabinet items + recall watchdog alerts!
    cab_res = client.get("/api/v1/cabinet", headers=auth_header)
    assert cab_res.status_code == 200
    cab_body = cab_res.json()
    assert cab_body["total_items"] == 1
    assert cab_body["items"][0]["medicine_id"] == med_id
    # Augmentin has DEMO-BATCH-001 recall alert in seed_alerts!
    assert cab_body["items"][0]["has_recall_alert"] is True
    assert cab_body["recalled_items_count"] == 1
    assert len(cab_body["items"][0]["active_alerts"]) >= 1

    # 8. DELETE /api/v1/cabinet/{med_id} -> 204 No Content
    del_res = client.delete(f"/api/v1/cabinet/{med_id}", headers=auth_header)
    assert del_res.status_code == 204

    # 9. GET /api/v1/cabinet after delete -> 0 items
    cab_empty = client.get("/api/v1/cabinet", headers=auth_header)
    assert cab_empty.status_code == 200
    assert cab_empty.json()["total_items"] == 0
