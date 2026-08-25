"""Idempotent seeder for ``knowledge_chunks`` (chat RAG grounding step 1).

Builds ONE ``verified_profile`` chunk per medicine, composed ONLY from
verified fields already present in the ``medicines`` table plus a
controlled, in-code drug-class gloss (``CLASS_GLOSS``). No clinical text
is authored or stored: no uses, dosage guidance, side effects, or
precautions beyond the general class sentence (spec 08).

Guarantees (same pattern as seed_mrp / seed_alerts):
- get-or-create provenance source "Afiya Verified DB Facts".
- Idempotent on key (medicine_id, chunk_type): re-runs skip existing rows,
  never update in place, never duplicate.
- Only INSERTs into knowledge_chunks (+ at most one sources row).

Usage:  python -m app.db.seed_knowledge
"""

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import KnowledgeChunk, Medicine, Source

logger = logging.getLogger(__name__)

CHUNK_TYPE = "verified_profile"

# Provenance source for all seeded chunks. Deliberately NOT labelled
# "monograph" / "reviewed": nothing here was clinically reviewed — these are
# structured DB facts plus a general drug-class gloss.
KNOWLEDGE_SOURCE_NAME = "Afiya Verified DB Facts"
KNOWLEDGE_SOURCE_ID = "a0000004-0000-0000-0000-000000000001"

# Controlled drug-class gloss: ONE general, well-established sentence per
# therapeutic category. No dosing, no product-specific claims. Every distinct
# medicines.category value in the MVP set is covered; unmapped categories fall
# back to CLASS_GLOSS_FALLBACK.
CLASS_GLOSS = {
    "Analgesic / Antipyretic":
        "generally used to relieve pain and reduce fever.",
    "Antacid / Anti-ulcer":
        "generally used to reduce stomach acid and treat acid-related stomach problems.",
    "Anti-diabetic":
        "generally used to lower blood sugar in people with diabetes.",
    "Anti-hypertensive":
        "generally used to lower blood pressure.",
    "Antibiotic (Broad Spectrum)":
        "an antibiotic generally used to treat bacterial infections, taken as directed by a clinician.",
    "Antibiotic (Cephalosporin)":
        "a cephalosporin antibiotic generally used to treat bacterial infections, taken as directed by a clinician.",
    "Antibiotic (Fluoroquinolone)":
        "a fluoroquinolone antibiotic generally used to treat bacterial infections, taken as directed by a clinician.",
    "Antiemetic / GI Tract":
        "generally used to relieve nausea, vomiting or other stomach and gut symptoms.",
    "Antihistamine / Anti-allergy":
        "generally used to relieve allergy symptoms such as sneezing, runny nose and itching.",
    "Bronchodilator / Respiratory":
        "generally used to open the airways and ease breathing in conditions such as asthma.",
    "Lipid-lowering Agent":
        "generally used to lower cholesterol and other blood fats.",
}

CLASS_GLOSS_FALLBACK = (
    "a registered medicine; ask a doctor or pharmacist what it is used for."
)


@dataclass
class KnowledgeSeedReport:
    chunks_inserted: int = 0
    chunks_skipped_existing: int = 0
    medicines_processed: int = 0
    source_created: bool = False


def build_profile_text(med: Medicine) -> str:
    """Compose the chunk text ONLY from verified DB fields + class gloss."""
    gloss = CLASS_GLOSS.get(med.category or "", CLASS_GLOSS_FALLBACK)
    return (
        f"{med.brand_name} is a brand of {med.generic_name}, available as "
        f"{med.strength} {med.dosage_form}, manufactured by "
        f"{med.manufacturer or 'an unspecified manufacturer'}. "
        f"DRAP registration: {med.drap_reg_no or 'not recorded'}. "
        f"Drug class: {med.category or 'not recorded'} — {gloss}"
    )


async def ensure_knowledge_source(db: AsyncSession) -> tuple[Source, bool]:
    """Get-or-create the 'Afiya Verified DB Facts' provenance source row."""
    result = await db.execute(
        select(Source).where(Source.name == KNOWLEDGE_SOURCE_NAME)
    )
    source = result.scalar_one_or_none()
    if source:
        return source, False
    source = Source(
        id=KNOWLEDGE_SOURCE_ID,
        name=KNOWLEDGE_SOURCE_NAME,
        url=None,
        source_type="structured_db",
    )
    db.add(source)
    await db.flush()
    return source, True


async def seed_knowledge_chunks(db: AsyncSession) -> KnowledgeSeedReport:
    """Seed one verified_profile chunk per medicine, idempotently."""
    report = KnowledgeSeedReport()
    source, created = await ensure_knowledge_source(db)
    report.source_created = created

    medicines = (await db.execute(select(Medicine))).scalars().all()

    for med in medicines:
        report.medicines_processed += 1

        # Idempotency key: (medicine_id, chunk_type) — never duplicate,
        # never update in place.
        existing = await db.execute(
            select(KnowledgeChunk.id).where(
                KnowledgeChunk.medicine_id == med.id,
                KnowledgeChunk.chunk_type == CHUNK_TYPE,
            )
        )
        if existing.first():
            report.chunks_skipped_existing += 1
            continue

        db.add(
            KnowledgeChunk(
                medicine_id=med.id,
                content=build_profile_text(med),
                source_id=source.id,
                chunk_type=CHUNK_TYPE,
            )
        )
        report.chunks_inserted += 1

    await db.commit()
    logger.info(
        "Knowledge seed complete: %d inserted, %d skipped (existing), "
        "%d medicines processed.",
        report.chunks_inserted,
        report.chunks_skipped_existing,
        report.medicines_processed,
    )
    return report


async def main() -> None:
    from app.db.database import async_session

    async with async_session() as db:
        report = await seed_knowledge_chunks(db)
        print(
            f"Knowledge seed done: {report.chunks_inserted} inserted, "
            f"{report.chunks_skipped_existing} skipped (existing), "
            f"{report.medicines_processed} medicines."
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    import asyncio

    asyncio.run(main())
