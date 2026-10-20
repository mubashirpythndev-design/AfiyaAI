"""Authenticated deterministic therapeutic duplication check."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import User, get_db
from app.models.marketplace_schemas import DuplicationRequest
from app.services.auth_dependency import get_current_user
from app.services.duplication_service import check_duplications

router = APIRouter(prefix="/api/v1", tags=["Therapeutic Duplication"])


@router.post("/duplication-check")
async def duplication_check(req: DuplicationRequest, db: AsyncSession = Depends(get_db),
                            current_user: User = Depends(get_current_user)) -> dict:
    return await check_duplications(db, req.items, req.lang)
