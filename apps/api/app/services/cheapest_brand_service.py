"""Cheapest-brand-within-generic service (Phase-0, Step 4).

Rules (hard constraints from specs 02/04/08):
- Grouping key = (generic, strength). NEVER generic alone, NEVER Category.
  (Ciprofloxacin 250mg and 500mg must never be grouped/compared together.)
- Comparison is on PER-UNIT price because pack sizes differ:
    "AxB's"  -> A * B units   (e.g. "1x14's" -> 14, "10x10's" -> 100)
    "N doses" -> N units      (inhalers, e.g. "200 doses" -> 200)
- All numbers come from the database. The LLM never generates or estimates
  a price (spec 08 §10).
- Safety flag (spec 08): attach "consult a pharmacist before switching" for
  narrow-therapeutic-index drugs, modified/extended-release forms, and
  biologics. None of the current groups are NTI, but the guard stays for
  when the dataset expands.
- Input is a VERIFIED medicine id from the database (spec 04): no fuzzy
  resolution happens here.
"""

import re
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Medicine, MedicinePrice

# --- Safety guardrails (spec 08) -------------------------------------------

NARROW_THERAPEUTIC_INDEX_GENERICS = {
    "warfarin",
    "levothyroxine",
    "phenytoin",
    "digoxin",
    "lithium",
}

EXTENDED_RELEASE_MARKERS = (
    "modified",
    "extended",
    "sustained",
    "controlled",
    "prolonged",
)
EXTENDED_RELEASE_TOKENS = ("mr", "er", "sr", "xr", "xl", "la")

_TWO_PLACES = Decimal("0.01")


def _q2(value: Decimal) -> Decimal:
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def _normalize(text: str) -> str:
    """Spec 04 normalization: lowercase + strip surrounding whitespace."""
    return (text or "").strip().lower()


# --- Pack-size parsing -------------------------------------------------------

_PACK_MULT_RE = re.compile(r"^\s*(\d+)\s*x\s*(\d+)")  # "1x14's", "10x10's"
_DOSES_RE = re.compile(r"^\s*(\d+)\s*doses?\s*$", re.IGNORECASE)  # "200 doses"


def parse_pack_units(package_size: str) -> tuple[int, bool]:
    """Parse a DRAP Packsize string into a unit count.

    Returns (units, parsed_ok). If the format is unrecognized the pack is
    treated as a single unit and parsed_ok is False so callers can surface
    the limitation instead of silently mis-comparing.
    """
    s = (package_size or "").strip()
    m = _PACK_MULT_RE.match(s)
    if m:
        return int(m.group(1)) * int(m.group(2)), True
    m = _DOSES_RE.match(s)
    if m:
        return int(m.group(1)), True
    return 1, False


# --- Safety flag evaluation ---------------------------------------------------

def _is_biologic(generic: str) -> bool:
    """Conservative heuristic: monoclonal antibodies end in '-mab'."""
    return _normalize(generic).replace(" ", "").endswith("mab")


def evaluate_switch_safety(generic: str, forms: list[str]) -> tuple[bool, list[str]]:
    """Return (consult_pharmacist, reasons) for switching within the group."""
    reasons: list[str] = []
    g = _normalize(generic)

    for nti in NARROW_THERAPEUTIC_INDEX_GENERICS:
        if nti in g:
            reasons.append("narrow therapeutic index drug")
            break

    for form in forms:
        f = _normalize(form)
        if any(marker in f for marker in EXTENDED_RELEASE_MARKERS):
            reasons.append("modified/extended-release formulation")
            break
        tokens = re.split(r"[^a-z0-9]+", f)
        if any(tok in EXTENDED_RELEASE_TOKENS for tok in tokens):
            reasons.append("modified/extended-release formulation")
            break

    if _is_biologic(generic):
        reasons.append("biologic medicine")

    return (len(reasons) > 0), reasons


# --- Result types --------------------------------------------------------------

@dataclass
class BrandOption:
    medicine_id: str
    brand_name: str
    generic_name: str
    strength: str
    dosage_form: str
    manufacturer: str
    price: Decimal            # pack price from the DB
    currency: str
    package_size: str
    units: int
    units_parsed_ok: bool
    per_unit: Decimal         # price / units
    saving_percent_vs_queried: Decimal  # positive = cheaper than queried brand


@dataclass
class CheapestBrandResult:
    queried_medicine_id: str
    generic: str
    strength: str
    cheapest: BrandOption
    options: list[BrandOption] = field(default_factory=list)  # sorted per_unit asc
    consult_pharmacist_before_switching: bool = False
    safety_reasons: list[str] = field(default_factory=list)


class MedicineNotFound(ValueError):
    """Raised when the queried medicine id does not exist (unverified input)."""


# --- Core service ----------------------------------------------------------------

async def get_cheapest_brands(
    db: AsyncSession, medicine_id: str
) -> CheapestBrandResult:
    """For a verified medicine, return all same-(generic, strength) brands
    sorted by per-unit price ascending, with savings vs the queried brand."""

    queried = await db.get(Medicine, medicine_id)
    if queried is None:
        raise MedicineNotFound(
            f"Medicine {medicine_id} not found — only verified database "
            "medicines can be compared (spec 04)."
        )

    generic_key = _normalize(queried.generic_name)
    strength_key = _normalize(queried.strength)
    if not generic_key or not strength_key:
        raise MedicineNotFound(
            "Medicine is missing generic name or strength; cannot group."
        )

    # Group by (generic, strength) — never generic alone, never Category.
    stmt = (
        select(Medicine)
        .where(Medicine.generic_name.isnot(None))
        .where(Medicine.strength.isnot(None))
    )
    result = await db.execute(stmt)
    same_group = [
        m
        for m in result.scalars().all()
        if _normalize(m.generic_name) == generic_key
        and _normalize(m.strength) == strength_key
    ]

    options: list[BrandOption] = []
    for med in same_group:
        # Current price: most recently collected DB price for this medicine.
        price_stmt = (
            select(MedicinePrice)
            .where(MedicinePrice.medicine_id == med.id)
            .order_by(
                MedicinePrice.collected_at.desc(),
                MedicinePrice.created_at.desc(),
            )
            .limit(1)
        )
        price_row = (await db.execute(price_stmt)).scalar_one_or_none()
        if price_row is None:
            continue  # no stored price -> excluded; never estimate (spec 08)

        units, parsed_ok = parse_pack_units(price_row.package_size)
        per_unit = _q2(Decimal(price_row.price) / Decimal(units))

        options.append(
            BrandOption(
                medicine_id=med.id,
                brand_name=med.brand_name,
                generic_name=med.generic_name,
                strength=med.strength,
                dosage_form=med.dosage_form,
                manufacturer=med.manufacturer or "",
                price=Decimal(price_row.price),
                currency=price_row.currency or "PKR",
                package_size=price_row.package_size or "",
                units=units,
                units_parsed_ok=parsed_ok,
                per_unit=per_unit,
                saving_percent_vs_queried=Decimal("0.00"),
            )
        )

    if not options:
        raise MedicineNotFound(
            "No stored prices found for this (generic, strength) group."
        )

    options.sort(key=lambda o: (o.per_unit, o.brand_name.lower()))
    cheapest = options[0]

    queried_option = next((o for o in options if o.medicine_id == medicine_id), None)
    base_per_unit = (queried_option or cheapest).per_unit
    if base_per_unit > 0:
        for opt in options:
            saving = (base_per_unit - opt.per_unit) / base_per_unit * Decimal(100)
            opt.saving_percent_vs_queried = _q2(saving)

    consult, reasons = evaluate_switch_safety(
        queried.generic_name, [o.dosage_form for o in options]
    )

    return CheapestBrandResult(
        queried_medicine_id=medicine_id,
        generic=queried.generic_name,
        strength=queried.strength,
        cheapest=cheapest,
        options=options,
        consult_pharmacist_before_switching=consult,
        safety_reasons=reasons,
    )
