"""HTTP-level auth gating tests (Phase 2).

Proves over real HTTP (TestClient) that:
- the FOUR gated endpoints return 401 without a token and their normal
  response WITH a valid bearer token:
    GET /api/medicines/{id}/info   (View info)
    GET /api/medicines/{id}/prices (Compare prices)
    POST /api/v1/price-check       (Feature A)
    POST /api/v1/alert-check       (Feature B)
- public endpoints stay open with no token (/api/health, /api/medicines/match).

The module fixture swaps the app-level engine/session factory onto a temp
SQLite file (get_db / init_db resolve those module globals at call time),
then lets the app lifespan create + seed the schema, exactly like dev
startup. No live LLM is involved: every tested path is DB-only.
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
    db_file = tmp_path_factory.mktemp("gating") / "afiya_gating.db"
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # get_db / init_db resolve these module globals at call time, but
    # main.py and seed_data.py bind ``async_session`` at IMPORT time, so
    # their references must be swapped too for the lifespan seeders to
    # hit the temp DB.
    old_engine, old_session = dbmod.engine, dbmod.async_session
    old_main_session = main_mod.async_session
    old_seed_session = seed_data_mod.async_session
    dbmod.engine, dbmod.async_session = engine, factory
    main_mod.async_session = factory
    seed_data_mod.async_session = factory
    try:
        with TestClient(app) as c:  # lifespan: init_db + idempotent seeders
            yield c
    finally:
        dbmod.engine, dbmod.async_session = old_engine, old_session
        main_mod.async_session = old_main_session
        seed_data_mod.async_session = old_seed_session
        asyncio.run(engine.dispose())


def _register(c: TestClient, email: str) -> str:
    resp = c.post(
        "/api/auth/register",
        json={"name": "Gate Tester", "email": email, "password": "longenough1"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _panadol_id(c: TestClient) -> str:
    resp = c.post("/api/medicines/match", json={"candidate": "Panadol"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["medicine"] is not None
    return body["medicine"]["id"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 401 without a token on every gated endpoint
# ---------------------------------------------------------------------------


def test_gated_endpoints_return_401_without_token(client):
    med_id = _panadol_id(client)

    assert client.get(f"/api/medicines/{med_id}/info").status_code == 401
    assert client.get(f"/api/medicines/{med_id}/prices").status_code == 401
    assert (
        client.post(
            "/api/v1/price-check",
            json={"medicine_query": "Panadol", "price_paid": 400},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/alert-check", json={"medicine_query": "Panadol"}
        ).status_code
        == 401
    )


def test_gated_endpoint_rejects_garbage_token(client):
    med_id = _panadol_id(client)
    resp = client.get(
        f"/api/medicines/{med_id}/prices", headers=_auth("garbage.token.here")
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 200 with a valid token — normal business responses unchanged
# ---------------------------------------------------------------------------


def test_view_info_with_token_returns_200(client):
    token = _register(client, "info@example.com")
    med_id = _panadol_id(client)
    resp = client.get(f"/api/medicines/{med_id}/info", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["medicine"]["id"] == med_id
    assert body["medicine"]["brand_name"].lower() == "panadol"


def test_compare_prices_with_token_returns_200(client):
    token = _register(client, "prices@example.com")
    med_id = _panadol_id(client)
    resp = client.get(f"/api/medicines/{med_id}/prices", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["medicine"]["id"] == med_id
    assert isinstance(body["prices"], list) and len(body["prices"]) > 0


def test_price_check_with_token_returns_200(client):
    token = _register(client, "mrp@example.com")
    resp = client.post(
        "/api/v1/price-check",
        json={"medicine_query": "Panadol", "price_paid": 400},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["disclaimer"]  # safety line always attached


def test_alert_check_with_token_returns_200(client):
    token = _register(client, "alerts@example.com")
    resp = client.post(
        "/api/v1/alert-check",
        json={"medicine_query": "Panadol"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ALERT_FOUND", "NO_ALERT")
    assert body["disclaimer"]


# ---------------------------------------------------------------------------
# Public endpoints stay open (search / health never require login)
# ---------------------------------------------------------------------------


def test_public_endpoints_stay_open_without_token(client):
    assert client.get("/api/health").status_code == 200

    resp = client.post("/api/medicines/match", json={"candidate": "Panadol"})
    assert resp.status_code == 200

    resp = client.get("/api/medicines/by-category", params={"category": "Analgesic"})
    assert resp.status_code == 200
