"""Phase-0 Step 5: migration upgrade -> downgrade reversibility.

Proves the additive migration:
- upgrade adds ONLY drap_reg_no (+ its unique index),
- downgrade returns the schema to exactly the prior state,
- existing rows survive both directions.
"""

import asyncio

from sqlalchemy import create_engine, inspect, text

from conftest import create_pre_migration_db, run_alembic

PRE_COLUMNS = {
    "id",
    "brand_name",
    "generic_name",
    "dosage_form",
    "strength",
    "manufacturer",
    "registration_info",
    "aliases",
    "category",
    "created_at",
    "verified_at",
    "updated_at",
}


def _columns(engine) -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns("medicines")}


def _index_names(engine) -> set[str]:
    return {ix["name"] for ix in inspect(engine).get_indexes("medicines")}


def test_upgrade_downgrade_returns_schema_to_prior_state(tmp_path):
    db_file = tmp_path / "reversibility.db"
    asyncio.run(create_pre_migration_db(db_file))

    url = f"sqlite:///{db_file}"
    engine = create_engine(url, connect_args={"check_same_thread": False})

    # --- Pre-migration state ---
    assert _columns(engine) == PRE_COLUMNS
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO medicines (id, brand_name, generic_name, "
                "dosage_form, strength, registration_info) VALUES "
                "('med-row-1', 'Canary', 'Canarycin', 'Tablet', '10mg', '999999')"
            )
        )

    # --- Upgrade ---
    run_alembic(db_file, "upgrade", "head")
    assert _columns(engine) == PRE_COLUMNS | {"drap_reg_no"}, (
        "upgrade must add ONLY drap_reg_no — nothing dropped/renamed/retyped"
    )
    assert "uq_medicines_drap_reg_no" in _index_names(engine)
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT brand_name FROM medicines WHERE id = 'med-row-1'")
        ).one()
    assert row.brand_name == "Canary"  # data survives upgrade

    # --- Upgrade again (idempotency) ---
    run_alembic(db_file, "upgrade", "head")
    assert _columns(engine) == PRE_COLUMNS | {"drap_reg_no"}

    # --- Downgrade ---
    run_alembic(db_file, "downgrade", "base")
    assert _columns(engine) == PRE_COLUMNS, (
        "downgrade must return the schema to exactly the prior state"
    )
    assert "uq_medicines_drap_reg_no" not in _index_names(engine)
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT brand_name FROM medicines WHERE id = 'med-row-1'")
        ).one()
        price_count = conn.execute(
            text("SELECT COUNT(*) FROM medicine_prices")
        ).scalar()
    assert row.brand_name == "Canary"  # data survives downgrade
    assert price_count == 40  # prices untouched

    engine.dispose()
