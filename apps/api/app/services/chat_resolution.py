"""Resolve a medicine mentioned in free-text chat messages (spec 04).

Chat previously only retrieved RAG context when the client passed an
explicit ``medicine_id``. This helper lets the chat resolve a medicine
mention from the message itself, strictly via verified names already in
the ``medicines`` table (brand / generic / aliases) and the existing
spec-04 matcher — it never guesses and never invents names.

Rules (spec 04 §10 / spec 08):
- A mention is a verified name appearing verbatim (normalized substring)
  in the user's message.
- Single mention  -> resolved through ``_resolve_medicine`` (strength
  enforcement, confidence, confirmation semantics).
- Multiple distinct medicines mentioned -> needs_confirmation with those
  medicines as alternatives (never silently pick one).
- No mention -> ``None`` (caller keeps its honest no-context fallback).
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import Medicine
from app.routers.price_check import _resolve_medicine
from app.services.matching_service import medicine_to_schema, normalize

logger = logging.getLogger(__name__)

# Ignore very short names so common words can never trigger a mention.
MIN_NAME_LEN = 4


async def extract_mentions(message: str, db: AsyncSession) -> list[dict]:
    """Return distinct medicines whose verified names occur in the message.

    Each entry: {"medicine": Medicine, "name": <matched verified name>}.
    Longest matching name wins per medicine (brand over a longer alias is
    irrelevant — we keep the first verified name that matched).
    """
    normalized_msg = normalize(message)
    if not normalized_msg:
        return []

    medicines = (await db.execute(select(Medicine))).scalars().all()

    mentions = []
    for med in medicines:
        verified_names = [med.brand_name, med.generic_name, *(med.aliases or [])]
        for name in verified_names:
            key = normalize(name or "")
            if len(key) >= MIN_NAME_LEN and key in normalized_msg:
                mentions.append({"medicine": med, "name": name})
                break
    return mentions


async def resolve_medicine_from_message(message: str, db: AsyncSession) -> dict | None:
    """Resolve a medicine mention from free text via the spec-04 matcher.

    Returns the matcher's dict shape:
    ``{"medicine", "confidence", "needs_confirmation", "alternatives"}``,
    or ``None`` when the message contains no verified medicine name.
    """
    mentions = await extract_mentions(message, db)
    if not mentions:
        return None

    if len(mentions) > 1:
        # Several medicines named: never silently pick one (spec 04 §10).
        logger.info(
            "Chat mention extraction found %d medicines; asking confirmation.",
            len(mentions),
        )
        return {
            "medicine": None,
            "confidence": 1.0,
            "needs_confirmation": True,
            "alternatives": [medicine_to_schema(m["medicine"]) for m in mentions][:5],
        }

    # Single mention: defer to the spec-04 matcher (exact/alias/fuzzy +
    # strength enforcement) so chat behaves exactly like price/alert check.
    return await _resolve_medicine(mentions[0]["name"], db)
