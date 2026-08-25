"""Phase-1 Feature B: migration 0003 upgrade -> downgrade reversibility
(spec 09 §12 / §16, spec 10 §15).

Proves the additive migration:
- upgrade to head adds ONLY drap_alerts (+ idx_alert_medicine,
  idx_alert_batch); mrp_reference / medicines / sources are untouched,
- downgrade to 0002 removes ONLY drap_alerts (mrp_reference survives),
- downgrade to base returns the schema to exactly the pre-Phase-0 state,
- existing rows survive every direction.
"""

import asyncio

from sqlalchemy import create_engine, inspect, text

from conftest import create_pre_migration_db, run_alembic

ALERT_COLUMNS = {
    "id",
    "medicine_id",
    "medicine_name_raw",
    "batch_no",
    "alert_type",
    "description",
    "is_demo",
    "source_id",
    "issued_at",
    "resolved",
    "created_at",
    "updated_at",
}


def _tables(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _alert_columns(engine) -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns("drap_alerts")}


def _alert_index_names(engine) -> set[str]:
    return {ix["name"] for ix in inspect(engine).get_indexes("drap_alerts")}


def test_alerts_migration_upgrade_downgrade(tmp_path):
    db_file = tmp_path / "phase1b_reversibility.db"
    asyncio.run(create_pre_migration_db(db_file))

    url = f"sqlite:///{db_file}"
    engine = create_engine(url, connect_args={"check_same_thread": False})

    # --- Pre-migration state: no drap_alerts ---
    assert "drap_alerts" not in _tables(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO medicines (id, brand_name, generic_name, "
                "dosage_form, strength, registration_info) VALUES "
                "('canary-1', 'Canary', 'Canarycin', 'Tablet', '10mg', '999999')"
            )
        )

    # --- Upgrade to head (0001 + 0002 + 0003) ---
    run_alembic(db_file, "upgrade", "head")
    assert "drap_alerts" in _tables(engine), "upgrade must add drap_alerts"
    assert _alert_columns(engine) == ALERT_COLUMNS
    assert {"idx_alert_medicine", "idx_alert_batch"} <= _alert_index_names(engine)
    # Existing tables untouched (additive-only constraint)
    for table in ("medicines", "sources", "medicine_prices", "mrp_reference"):
        assert table in _tables(engine)
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT brand_name FROM medicines WHERE id = 'canary-1'")
        ).one()
    assert row.brand_name == "Canary"  # data survives upgrade

    # --- Upgrade again (idempotency) ---
    run_alembic(db_file, "upgrade", "head")
    assert "drap_alerts" in _tables(engine)

    # --- Downgrade to 0002: removes ONLY drap_alerts ---
    run_alembic(db_file, "downgrade", "0002")
    assert "drap_alerts" not in _tables(engine)
    assert "mrp_reference" in _tables(engine), "Feature A table must survive"
    with engine.connect() as conn:
        cols = {
            c["name"] for c in inspect(conn).get_columns("medicines")
        }
    assert "drap_reg_no" in cols, "Phase-0 column must survive 0003 downgrade"

    # --- Re-upgrade, then full downgrade to base ---
    run_alembic(db_file, "upgrade", "head")
    run_alembic(db_file, "downgrade", "base")
    assert "drap_alerts" not in _tables(engine)
    assert "mrp_reference" not in _tables(engine)
    with engine.connect() as conn:
        cols = {c["name"] for c in inspect(conn).get_columns("medicines")}
        row = conn.execute(
            text("SELECT brand_name FROM medicines WHERE id = 'canary-1'")
        ).one()
        price_count = conn.execute(
            text("SELECT COUNT(*) FROM medicine_prices")
        ).scalar()
    assert "drap_reg_no" not in cols  # back to the exact pre-Phase-0 schema
    assert row.brand_name == "Canary"  # data survives full rollback
    assert price_count == 40  # prices untouched

    engine.dispose()
