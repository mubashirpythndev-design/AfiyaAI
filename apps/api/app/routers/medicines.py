"""Medicines router - matching, details, prices, and RAG info."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, Medicine, MedicinePrice, KnowledgeChunk, Source, User
from app.services.auth_dependency import get_optional_current_user
from app.services.matching_service import match_medicine, medicine_to_schema
from app.services.price_service import get_price_comparison
from app.services.rag_service import retrieve_context
from app.services.cheapest_brand_service import (
    MedicineNotFound,
    get_cheapest_brands,
)
from app.models.schemas import (
    MatchRequest, MatchResponse, MedicineSchema,
    PriceComparison, MedicineInfo, KnowledgeChunkSchema, PriceEntry, SourceSchema,
    CheapestBrandsSchema, CheapestBrandOptionSchema,
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
async def get_prices(
    medicine_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
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
    current_user: User | None = Depends(get_optional_current_user),
):
    """Get RAG-powered medicine information."""
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
        src_name = chunk.source.name if chunk.source else "Afiya Verified DB"
        src_url = chunk.source.url if chunk.source else None
        src_type = chunk.source.source_type if chunk.source else "verified_db"

        source_schema = SourceSchema(
            name=src_name,
            url=src_url,
            source_type=src_type,
        )
        knowledge_chunks.append(KnowledgeChunkSchema(
            id=str(chunk.id),
            content=chunk.content,
            chunk_type=chunk.chunk_type,
            source=source_schema,
        ))
        if src_name not in sources_set:
            sources_set[src_name] = source_schema

    # Get prices
    comparison = await get_price_comparison(medicine_id, db)
    prices = comparison.prices if comparison else []

    # Cheapest brands in the same (generic, strength) group. All numbers
    # come from the DB via the service - never from the LLM (spec 08).
    # Grouping is strictly (generic, strength): never generic alone, never
    # Category. If there is no alternative brand, return None so the UI
    # shows nothing instead of an empty box.
    cheapest_brands: CheapestBrandsSchema | None = None
    try:
        group = await get_cheapest_brands(db, medicine_id)
        if len(group.options) >= 2:
            cheapest_brands = CheapestBrandsSchema(
                generic=group.generic,
                strength=group.strength,
                cheapest_brand=group.cheapest.brand_name,
                options=[
                    CheapestBrandOptionSchema(
                        medicine_id=opt.medicine_id,
                        brand_name=opt.brand_name,
                        manufacturer=opt.manufacturer,
                        price=float(opt.price),
                        currency=opt.currency,
                        package_size=opt.package_size,
                        units=opt.units,
                        per_unit=float(opt.per_unit),
                        saving_percent_vs_queried=float(
                            opt.saving_percent_vs_queried
                        ),
                    )
                    for opt in group.options
                ],
                consult_pharmacist_before_switching=(
                    group.consult_pharmacist_before_switching
                ),
                safety_reasons=group.safety_reasons,
            )
    except MedicineNotFound:
        cheapest_brands = None

    return MedicineInfo(
        medicine=medicine_to_schema(medicine),
        knowledge_chunks=knowledge_chunks,
        prices=prices,
        sources=list(sources_set.values()),
        cheapest_brands=cheapest_brands,
    )
