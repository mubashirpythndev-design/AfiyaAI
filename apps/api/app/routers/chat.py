"""Chat router - handles conversational queries about medicines."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.chat_service import generate_chat_response
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a message and get a grounded AI response about medicines."""
    history = [msg.model_dump() for msg in req.conversation_history] if req.conversation_history else None
    response = await generate_chat_response(
        message=req.message,
        db=db,
        medicine_id=req.medicine_id,
        language=req.language,
        conversation_history=history,
    )
    return response
