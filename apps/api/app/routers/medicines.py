"""Medicines router - matching, details, prices, and RAG info."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, Medicine, MedicinePrice, KnowledgeChunk, Source
from app.services.matching_service import match_medicine, medicine_to_schema
from app.services.price_service import get_price_comparison
from app.services.rag_service import retrieve_context
from app.models.schemas import (
    MatchRequest, MatchResponse, MedicineSchema,
    PriceComparison, MedicineInfo, KnowledgeChunkSchema, PriceEntry, SourceSchema,
)
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/medicines", tags=["Medicines"])


@router.post("/match", response_model=MatchResponse)
async def match(req: MatchRequest, db: AsyncSession = Depends(get_db)):
    """Match a candidate text against the verified medicine database."""
    result = await match_medicine(req.candidate, db)
    return MatchResponse(**result)


@router.get("/by-category", response_model=list[MedicineSchema])
async def get_medicines_by_category(
    category: str = Query(..., description="Therapeutic category name"),
    db: AsyncSession = Depends(get_db),
):
    """Get all medicines in a given therapeutic category."""
    result = await db.execute(
        select(Medicine).where(Medicine.category.ilike(f"%{category}%"))
    )
    medicines = result.scalars().all()
    if not medicines:
        raise HTTPException(status_code=404, detail=f"No medicines found in category: {category}")
    return [medicine_to_schema(m) for m in medicines]


@router.get("/{medicine_id}", response_model=MedicineSchema)
async def get_medicine(medicine_id: str, db: AsyncSession = Depends(get_db)):
    """Get full details of a verified medicine."""
    result = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return medicine_to_schema(medicine)


@router.get("/{medicine_id}/prices", response_model=PriceComparison)
async def get_prices(medicine_id: str, db: AsyncSession = Depends(get_db)):
    """Get price comparison for a verified medicine."""
    comparison = await get_price_comparison(medicine_id, db)
    if not comparison:
        raise HTTPException(status_code=404, detail="Medicine or prices not found")
    return comparison


@router.get("/{medicine_id}/info", response_model=MedicineInfo)
async def get_medicine_info(
    medicine_id: str,
    language: str = Query(default="en"),
    db: AsyncSession = Depends(get_db),
):
    """Get RAG-powered medicine information with knowledge chunks and prices."""
    # Get medicine
    result = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")

    # Get knowledge chunks with sources
    result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.medicine_id == medicine_id)
        .options(selectinload(KnowledgeChunk.source))
    )
    chunks = result.scalars().all()

    knowledge_chunks = []
    sources_set = {}
    for chunk in chunks:
        knowledge_chunks.append(KnowledgeChunkSchema(
            id=str(chunk.id),
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            source=SourceSchema(
                name=chunk.source.name,
                url=chunk.source.url,
                source_type=chunk.source.source_type,
            ),
        ))
        if chunk.source.name not in sources_set:
            sources_set[chunk.source.name] = SourceSchema(
                name=chunk.source.name,
                url=chunk.source.url,
                source_type=chunk.source.source_type,
            )

    # Get prices
    comparison = await get_price_comparison(medicine_id, db)
    prices = comparison.prices if comparison else []

    return MedicineInfo(
        medicine=medicine_to_schema(medicine),
        knowledge_chunks=knowledge_chunks,
        prices=prices,
        sources=list(sources_set.values()),
    )
