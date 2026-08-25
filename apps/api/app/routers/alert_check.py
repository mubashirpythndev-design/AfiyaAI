"""Phase-1 Feature B — Authenticity / Alert Checker endpoint (spec 09 §7.3).

POST /api/v1/alert-check

Flow (spec 09 §8): medicine_query -> EXISTING spec-04 matcher -> medicine_id
-> active (resolved=FALSE) drap_alerts rows -> exact batch match vs
name-only "possible, verify" -> localized response (spec 07).

Safety (spec 08/09 §10):
- The LLM is never involved — status and alert facts come ONLY from the
  drap_alerts table; nothing here generates an authentic/counterfeit verdict.
- Only resolved=FALSE alerts are ever returned.
- Batch matching is EXACT (case-insensitive, no fuzzy over-match); alerts
  that cannot be confirmed against the user's batch are flagged
  "possible — verify" via match_basis='name_only'.
- Every response carries the localized safety line "No alert found does NOT
  guarantee authenticity", plus a DEMO DATA note whenever matched rows are
  demo rows (all current seed rows are).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import DrapAlert, get_db
from app.models.schemas import (
    AlertCheckRequest, AlertCheckResponse, AlertSchema, MedicineSchema,
    SourceSchema,
)
from app.routers.price_check import _resolve_medicine  # spec-04 matcher reuse
from app.services.alert_check_messages import localize, normalize_lang

router = APIRouter(prefix="/api/v1", tags=["Alert Check"])

STATUS_ALERT_FOUND = "ALERT_FOUND"
STATUS_NO_ALERT = "NO_ALERT"


async def _active_alerts(db: AsyncSession, medicine_id: str) -> list[DrapAlert]:
    """Active (resolved=FALSE) alert rows for the medicine, newest first."""
    stmt = (
        select(DrapAlert)
        .where(
            DrapAlert.medicine_id == medicine_id,
            DrapAlert.resolved == False,  # noqa: E712  (SQL, not Python truthiness)
        )
        .order_by(DrapAlert.issued_at.desc().nulls_last())
        .options(selectinload(DrapAlert.source))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _batch_equals(alert_batch: str | None, user_batch: str | None) -> bool:
    """Exact batch match only — fuzzy/substring matching would over-match."""
    if not alert_batch or not user_batch:
        return False
    return alert_batch.strip().lower() == user_batch.strip().lower()


def _to_schema(alert: DrapAlert, basis: str) -> AlertSchema:
    source_schema = None
    if alert.source is not None:
        source_schema = SourceSchema(
            name=alert.source.name,
            url=alert.source.url,
            source_type=alert.source.source_type,
        )
    return AlertSchema(
        alert_type=alert.alert_type,
        description=alert.description,
        batch_no=alert.batch_no,
        issued_at=alert.issued_at.isoformat() if alert.issued_at else None,
        match_basis=basis,
        is_demo=bool(alert.is_demo),
        source=source_schema,
    )


@router.post("/alert-check", response_model=AlertCheckResponse)
async def alert_check(req: AlertCheckRequest, db: AsyncSession = Depends(get_db)):
    """Check a medicine (and optional batch) against active DRAP alerts."""
    lang = normalize_lang(req.lang)
    disclaimer = localize(lang, "disclaimer")  # ALWAYS attached (spec 09 §10)

    # --- 1. Resolve the medicine via the existing spec-04 matcher ---
    match = await _resolve_medicine(req.medicine_query, db)
    medicine: MedicineSchema | None = match["medicine"]

    if match["needs_confirmation"] or medicine is None:
        message_key = "needs_confirmation" if match["alternatives"] else "no_match"
        return AlertCheckResponse(
            status=None,
            needs_confirmation=True,
            candidates=match["alternatives"],
            match_confidence=match["confidence"],
            message=localize(lang, message_key),
            disclaimer=disclaimer,
        )

    matched_name = f"{medicine.generic_name} {medicine.strength} ({medicine.brand_name})"

    # --- 2. Active alerts only (resolved=FALSE) — DB rows only, never LLM ---
    active = await _active_alerts(db, medicine.id)

    if not active:
        return AlertCheckResponse(
            status=STATUS_NO_ALERT,
            medicine_id=medicine.id,
            matched_name=matched_name,
            match_confidence=match["confidence"],
            message=localize(lang, "no_alert"),
            disclaimer=disclaimer,
        )

    # --- 3. Exact batch match; everything else is "possible — verify" ---
    user_batch = req.batch_no.strip() if req.batch_no else None

    alerts_out: list[AlertSchema] = []
    has_exact = False
    for alert in active:
        if user_batch and _batch_equals(alert.batch_no, user_batch):
            alerts_out.insert(0, _to_schema(alert, "batch_no"))  # exact first
            has_exact = True
        elif not alert.batch_no:
            # Name-only (e.g. ingredient-wide) alert: always relevant, but
            # never confirms a specific batch (spec 09 §9).
            alerts_out.append(_to_schema(alert, "name_only"))
        elif not user_batch:
            # Batch-specific alert but the user gave no batch: surface as
            # possible, never as confirmed.
            alerts_out.append(_to_schema(alert, "name_only"))
        # else: different batch -> excluded (name over-match guard)

    if not alerts_out:
        return AlertCheckResponse(
            status=STATUS_NO_ALERT,
            medicine_id=medicine.id,
            matched_name=matched_name,
            match_confidence=match["confidence"],
            message=localize(lang, "no_alert"),
            disclaimer=disclaimer,
        )

    match_basis = "batch_no" if has_exact else "name_only"
    message = localize(lang, "alert_found" if has_exact else "possible_verify")
    if any(a.is_demo for a in alerts_out):
        message = f"{message} {localize(lang, 'demo_note')}"

    return AlertCheckResponse(
        status=STATUS_ALERT_FOUND,
        medicine_id=medicine.id,
        matched_name=matched_name,
        match_confidence=match["confidence"],
        alerts=alerts_out,
        match_basis=match_basis,
        message=message,
        disclaimer=disclaimer,
    )
