"""Phase-1 Feature B tests (spec 09 §12).

Covers:
- Active-alert filtering: only resolved=FALSE rows are ever returned.
- Exact batch match: identical batch -> match_basis 'batch_no' (definite).
- Name over-match guard: a different batch NEVER confirms a batch-specific
  alert; name-only alerts are flagged 'possible — verify' (match_basis
  'name_only').
- Seeder idempotency + DEMO-DATA invariants (all rows demo, provenance).
- Mandatory safety line on EVERY response: "no alert found does NOT
  guarantee authenticity" (+ DEMO DATA note whenever demo rows match).
"""

from sqlalchemy import select, func

from app.db.database import DrapAlert, Source
from app.db.seed_alerts import DEMO_ALERT_SOURCE_NAME
from app.models.schemas import AlertCheckRequest
from app.routers.alert_check import (
    STATUS_ALERT_FOUND,
    STATUS_NO_ALERT,
    _batch_equals,
    alert_check,
)

# ---------------------------------------------------------------------------
# Pure batch-comparison guard (no I/O) — exact match only
# ---------------------------------------------------------------------------


def test_batch_equals_is_exact_only():
    assert _batch_equals("ABC123", "abc123")
    assert _batch_equals(" ABC123 ", "abc123")
    assert not _batch_equals("ABC123", "ABC12")      # no substring matching
    assert not _batch_equals("ABC123", "ABC1234")
    assert not _batch_equals(None, "ABC123")
    assert not _batch_equals("ABC123", None)


# ---------------------------------------------------------------------------
# Seeder: 4 CSV rows, all DEMO, idempotent, provenance source present
# ---------------------------------------------------------------------------


async def test_alert_seed_rows_all_demo(phase1b_db):
    db_file, factory = phase1b_db
    async with factory() as db:
        count = (
            await db.execute(select(func.count()).select_from(DrapAlert))
        ).scalar()
        assert count == 4, "CSV has 4 rows; second seed run must add nothing"

        non_demo = (
            await db.execute(
                select(func.count())
                .select_from(DrapAlert)
                .where(DrapAlert.is_demo == False)  # noqa: E712
            )
        ).scalar()
        assert non_demo == 0, "every seeded alert row must be DEMO DATA"

        source = (
            await db.execute(
                select(Source).where(Source.name == DEMO_ALERT_SOURCE_NAME)
            )
        ).scalar_one()
        assert source.source_type == "demo"

        # Every alert row is traceable to the demo provenance source
        orphans = (
            await db.execute(
                select(func.count())
                .select_from(DrapAlert)
                .where(DrapAlert.source_id != source.id)
            )
        ).scalar()
        assert orphans == 0


# ---------------------------------------------------------------------------
# Exact batch match (Augmentin 625mg + DEMO-BATCH-001)
# ---------------------------------------------------------------------------


async def test_alert_check_exact_batch_match(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(
        medicine_query="Augmentin 625mg", batch_no="demo-batch-001", lang="en"
    )
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_ALERT_FOUND
    assert resp.match_basis == "batch_no"
    assert resp.needs_confirmation is False
    assert len(resp.alerts) == 1
    alert = resp.alerts[0]
    assert alert.alert_type == "substandard"
    assert alert.batch_no == "DEMO-BATCH-001"
    assert alert.match_basis == "batch_no"
    assert alert.is_demo is True
    assert alert.issued_at == "2025-02-10"
    assert alert.source is not None
    assert alert.source.name == DEMO_ALERT_SOURCE_NAME
    # Definite wording + DEMO DATA note + mandatory safety line
    assert "active alert matches" in resp.message
    assert "DEMO DATA" in resp.message
    assert "does NOT guarantee authenticity" in resp.disclaimer


# ---------------------------------------------------------------------------
# Active-alert filtering: resolved=TRUE rows must never surface
# ---------------------------------------------------------------------------


async def test_alert_check_resolved_rows_filtered(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(
        medicine_query="Augmentin 625mg", batch_no="DEMO-BATCH-RESOLVED"
    )
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_NO_ALERT
    assert resp.alerts == []
    assert "does NOT guarantee authenticity" in resp.disclaimer


# ---------------------------------------------------------------------------
# Name over-match guard: a DIFFERENT batch never confirms a batch alert
# ---------------------------------------------------------------------------


async def test_alert_check_different_batch_does_not_overmatch(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(
        medicine_query="Augmentin 625mg", batch_no="DEMO-BATCH-999"
    )
    async with factory() as db:
        resp = await alert_check(req, db)

    # Augmentin's alerts are all batch-specific; a different batch must NOT
    # match them (no fuzzy/substring over-match).
    assert resp.status == STATUS_NO_ALERT
    assert resp.alerts == []
    assert resp.match_basis is None
    assert "does NOT guarantee authenticity" in resp.disclaimer


# ---------------------------------------------------------------------------
# Name-only alert: surfaced as "possible — verify", never as confirmed
# ---------------------------------------------------------------------------


async def test_alert_check_name_only_no_batch_is_possible_verify(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="Zantac 150mg", lang="roman-ur")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_ALERT_FOUND
    assert resp.match_basis == "name_only"  # never 'batch_no' without a batch
    assert len(resp.alerts) == 1
    alert = resp.alerts[0]
    assert alert.alert_type == "recall"
    assert alert.batch_no is None  # illustrative ranitidine row: no batch
    assert alert.match_basis == "name_only"
    assert "DEMO-BATCH" not in (alert.description or "")
    assert "Possible match" in resp.message
    assert "verify" in resp.message.lower()
    assert "DEMO DATA" in resp.message
    assert "zamanat NAHI" in resp.disclaimer  # Roman-Urdu safety line


async def test_alert_check_name_only_with_unknown_batch_still_possible(phase1b_db):
    """A name-only (ingredient-wide) alert is surfaced even when the user's
    batch does not appear in any alert — but only as possible/verify."""
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="Zantac 150mg", batch_no="XYZ-789")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_ALERT_FOUND
    assert resp.match_basis == "name_only"
    assert all(a.match_basis == "name_only" for a in resp.alerts)


# ---------------------------------------------------------------------------
# NO_ALERT for alert-free medicines + no cross-medicine leakage
# ---------------------------------------------------------------------------


async def test_alert_check_no_alert_medicine(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="Panadol")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_NO_ALERT
    assert resp.alerts == []
    assert "No active DRAP alert" in resp.message
    # Safety line present even on NO_ALERT (the whole point of Feature B)
    assert "does NOT guarantee authenticity" in resp.disclaimer


async def test_alert_check_no_cross_medicine_leakage(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="Ciproxin 500mg")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_ALERT_FOUND
    batches = {a.batch_no for a in resp.alerts}
    assert batches == {"DEMO-BATCH-002"}  # Augmentin/Zantac rows excluded


# ---------------------------------------------------------------------------
# Confirmation guards + Urdu script + disclaimer on every branch
# ---------------------------------------------------------------------------


async def test_alert_check_ambiguous_generic_needs_confirmation(phase1b_db):
    """'cetirizine' matches 3 brands: never silently pick one (spec 04)."""
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="cetirizine")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status is None
    assert resp.needs_confirmation is True
    assert len(resp.candidates) == 3
    assert "does NOT guarantee authenticity" in resp.disclaimer


async def test_alert_check_unknown_medicine_no_match(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(medicine_query="xyzplumb 99mg")
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status is None
    assert resp.needs_confirmation is True
    assert resp.candidates == []
    assert "candidates" not in resp.message
    assert "does NOT guarantee authenticity" in resp.disclaimer


async def test_alert_check_urdu_message(phase1b_db):
    db_file, factory = phase1b_db
    req = AlertCheckRequest(
        medicine_query="Augmentin 625mg", batch_no="DEMO-BATCH-001", lang="ur"
    )
    async with factory() as db:
        resp = await alert_check(req, db)

    assert resp.status == STATUS_ALERT_FOUND
    assert any(
        "\u0600" <= ch <= "\u06FF" for ch in resp.message
    ), "Urdu message must contain Urdu script"
    assert any("\u0600" <= ch <= "\u06FF" for ch in resp.disclaimer)
