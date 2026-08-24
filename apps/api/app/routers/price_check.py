"""Phase-1 Feature A — MRP / Overcharge Checker endpoint (spec 09 §7.3).

POST /api/v1/price-check

Flow (spec 09 §8): medicine_query -> EXISTING spec-04 matcher -> medicine_id
-> latest mrp_reference row for (medicine, pack_size) -> pure in-code
comparison -> localized message + disclaimer (spec 07).

Safety (spec 08/09 §10): every price, MRP and status comes from stored,
provenance-tagged DB rows. The LLM is never involved in this endpoint —
it cannot generate or estimate a price or a status. Low-confidence matches
return candidates + needs_confirmation=true instead of silently picking one
(spec 04 §10).
"""

import re

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db, MrpReference
from app.models.schemas import (
    MedicineSchema, PriceCheckRequest, PriceCheckResponse, SourceSchema,
)
from app.services.matching_service import match_medicine
from app.services.price_check_messages import localize, normalize_lang
from app.services.price_check_service import compare, STATUS_NO_DATA

router = APIRouter(prefix="/api/v1", tags=["Price Check"])

# Strength token inside a free-text query, e.g. the "20mg" in "Risek 20mg"
# or the "160/4.5mcg" in "Symbicort 160/4.5mcg" (compound strengths).
_STRENGTH_RE = re.compile(
    r"\b(\d+(?:[.,]\d+)?(?:\s*/\s*\d+(?:[.,]\d+)?)?)\s*(mg|ml|mcg|g|iu)\b",
    re.IGNORECASE,
)


def _normalize_strength(value: str | None) -> str:
    """'20 MG ' -> '20mg', '160 / 4.5mcg' -> '160/4.5mcg' for safe checks."""
    return re.sub(r"\s+", "", (value or "").lower())


def _strength_matches(db_strength: str | None, token: str) -> bool:
    """Exact or suffix match (token '500mg' matches stored '50/500mg').

    Different strengths are never interchangeable; a suffix rule still keeps
    250mg vs 500mg separate because the digit prefix must align on '/'.
    """
    stored = _normalize_strength(db_strength)
    if not stored:
        return False
    return stored == token or stored.endswith("/" + token)


def _split_strength(query: str) -> tuple[str, str | None]:
    """Split 'Risek 20mg' into ('Risek', '20mg'). Strength is optional."""
    m = _STRENGTH_RE.search(query)
    if not m:
        return query.strip(), None
    strength = re.sub(r"\s+", "", f"{m.group(1)}{m.group(2).lower()}")
    name_part = (query[: m.start()] + query[m.end():]).strip(" ,-")
    return name_part, strength


async def _resolve_medicine(query: str, db: AsyncSession) -> dict:
    """Resolve the query via the existing spec-04 matcher.

    When the query carries an explicit strength token, the resolved medicine
    must match it (generic+strength resolution — Ciprofloxacin 250mg and
    500mg are never interchangeable). If the full query fails but the
    name-only part matches AND its strength matches the token, accept the
    name-only match; otherwise fall through to confirmation.
    """
    result = await match_medicine(query, db)
    name_part, strength = _split_strength(query)

    if strength is None:
        return result

    med = result["medicine"]
    if med and not result["needs_confirmation"] and _strength_matches(med.strength, strength):
        return result

    # Retry with the name-only part, then enforce the strength token.
    name_match = await match_medicine(name_part, db)
    name_med = name_match["medicine"]
    if name_med and _strength_matches(name_med.strength, strength):
        return name_match

    # Strength mismatch or ambiguous: never silently pick one (spec 04).
    return {
        "medicine": None,
        "confidence": max(result["confidence"], name_match["confidence"]),
        "needs_confirmation": True,
        "alternatives": result["alternatives"] or name_match["alternatives"],
    }


async def _latest_mrp(
    db: AsyncSession, medicine_id: str, pack_size: str | None
) -> MrpReference | None:
    """Latest mrp_reference row for the medicine (+ pack_size when given).

    NULL effective_date sorts last on BOTH backends (SQLite and PostgreSQL
    order NULLs differently by default).
    """
    stmt = select(MrpReference).where(MrpReference.medicine_id == medicine_id)
    if pack_size:
        stmt = stmt.where(
            func.lower(MrpReference.pack_size) == pack_size.strip().lower()
        )
    stmt = stmt.order_by(MrpReference.effective_date.desc().nulls_last())
    result = await db.execute(stmt.options(selectinload(MrpReference.source)))
    return result.scalars().first()


async def _pack_sizes(db: AsyncSession, medicine_id: str) -> list[str]:
    """Distinct pack sizes with MRP data for the medicine."""
    result = await db.execute(
        select(MrpReference.pack_size)
        .where(MrpReference.medicine_id == medicine_id)
        .distinct()
    )
    return [p for p in result.scalars().all() if p]


def _fmt_amount(value: float) -> str:
    """250.0 -> '250', 40.5 -> '40.5' for localized messages."""
    return f"{value:g}"


@router.post("/price-check", response_model=PriceCheckResponse)
async def price_check(req: PriceCheckRequest, db: AsyncSession = Depends(get_db)):
    """Check a paid/quoted price against the DRAP-notified MRP."""
    lang = normalize_lang(req.lang)
    disclaimer = localize(lang, "disclaimer")

    # --- 1. Resolve the medicine via the existing spec-04 matcher ---
    match = await _resolve_medicine(req.medicine_query, db)
    medicine: MedicineSchema | None = match["medicine"]

    if match["needs_confirmation"] or medicine is None:
        # Never claim "confirm from the candidates" when there are none.
        message_key = "needs_confirmation" if match["alternatives"] else "no_match"
        return PriceCheckResponse(
            status=None,
            needs_confirmation=True,
            candidates=match["alternatives"],
            match_confidence=match["confidence"],
            price_paid=req.price_paid,
            message=localize(lang, message_key),
            disclaimer=disclaimer,
        )

    # --- 2. Currency guard: never compare across currencies (spec 09 §9) ---
    if req.currency.strip().upper() != "PKR":
        return PriceCheckResponse(
            status=STATUS_NO_DATA,
            medicine_id=medicine.id,
            matched_name=f"{medicine.generic_name} {medicine.strength} ({medicine.brand_name})",
            match_confidence=match["confidence"],
            price_paid=req.price_paid,
            currency=req.currency,
            message=localize(lang, "currency_mismatch"),
            disclaimer=disclaimer,
        )

    # --- 3. Latest versioned MRP row (DB only — never the LLM) ---
    matched_name = f"{medicine.generic_name} {medicine.strength} ({medicine.brand_name})"

    # Spec 09 §9: with multiple pack sizes, require pack_size before
    # comparing — never compare against an arbitrary pack's MRP.
    if not req.pack_size:
        pack_sizes = await _pack_sizes(db, medicine.id)
        if len(pack_sizes) > 1:
            return PriceCheckResponse(
                status=None,
                medicine_id=medicine.id,
                matched_name=matched_name,
                match_confidence=match["confidence"],
                needs_confirmation=True,
                price_paid=req.price_paid,
                message=localize(lang, "specify_pack", packs=", ".join(sorted(pack_sizes))),
                disclaimer=disclaimer,
            )

    mrp_row = await _latest_mrp(db, medicine.id, req.pack_size)

    if mrp_row is None:
        return PriceCheckResponse(
            status=STATUS_NO_DATA,
            medicine_id=medicine.id,
            matched_name=matched_name,
            match_confidence=match["confidence"],
            price_paid=req.price_paid,
            pack_size=req.pack_size,
            message=localize(lang, "no_data"),
            disclaimer=disclaimer,
        )

    # --- 4. Exact in-code comparison (pure service, spec 09 §6) ---
    result = compare(req.price_paid, mrp_row.notified_mrp)
    mrp_value = float(mrp_row.notified_mrp)
    message_key = {
        "OVERCHARGED": "overcharged",
        "OK_AT_MRP": "ok_at_mrp",
        "BELOW_MRP": "below_mrp",
    }[result.status]

    source_schema = None
    if mrp_row.source is not None:
        source_schema = SourceSchema(
            name=mrp_row.source.name,
            url=mrp_row.source.url,
            source_type=mrp_row.source.source_type,
        )

    return PriceCheckResponse(
        status=result.status,
        medicine_id=medicine.id,
        matched_name=matched_name,
        match_confidence=match["confidence"],
        needs_confirmation=False,
        price_paid=req.price_paid,
        mrp=mrp_value,
        currency=mrp_row.currency or "PKR",
        overcharge_amount=float(result.amount) if result.amount > 0 else 0.0,
        pack_size=mrp_row.pack_size,
        sro_ref=mrp_row.sro_ref,
        effective_date=mrp_row.effective_date.isoformat() if mrp_row.effective_date else None,
        source=source_schema,
        message=localize(
            lang,
            message_key,
            amount=_fmt_amount(abs(float(result.amount))),
            mrp=_fmt_amount(mrp_value),
        ),
        disclaimer=disclaimer,
    )
