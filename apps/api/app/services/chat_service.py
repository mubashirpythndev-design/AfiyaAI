"""Chat service - orchestrates RAG retrieval + Gemini LLM for grounded responses."""

import logging
import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.safety_service import (
    check_emergency,
    is_diagnostic_request,
    get_diagnostic_refusal,
    build_safety_system_prompt,
    validate_response,
    DISCLAIMER,
)
from app.services.rag_service import retrieve_context
from app.models.schemas import ChatResponse, SourceSchema

logger = logging.getLogger(__name__)


async def generate_chat_response(
    message: str,
    db: AsyncSession,
    medicine_id: str | None = None,
    language: str = "en",
    conversation_history: list[dict] | None = None,
) -> ChatResponse:
    """Generate a grounded chat response using RAG + Gemini."""

    # Emergency check
    emergency_msg = check_emergency(message)
    if emergency_msg:
        return ChatResponse(
            message=emergency_msg,
            sources=[],
            disclaimer=DISCLAIMER,
        )

    # Diagnostic request check
    if is_diagnostic_request(message):
        return ChatResponse(
            message=get_diagnostic_refusal(),
            sources=[],
            disclaimer=DISCLAIMER,
        )

    # RAG retrieval if we have a medicine context
    context = ""
    sources: list[SourceSchema] = []

    if medicine_id:
        rag_result = await retrieve_context(medicine_id, message, db)
        context = rag_result["context"]
        sources = [SourceSchema(**s) for s in rag_result["sources"]]

    # Detect meta-questions about Afiya AI itself
    meta_keywords = ["what is afiya", "who are you", "about afiya", "afiya ai", "what can you do", "your name"]
    is_meta_question = any(kw in message.lower() for kw in meta_keywords)

    meta_context = ""
    if is_meta_question:
        meta_context = """About Afiya AI:
- Afiya AI is an intelligent medicine information assistant designed for Pakistan.
- It extracts medicine names from prescription images using AI-powered OCR.
- It matches medicines against a verified database of 40+ common medicines registered with DRAP (Drug Regulatory Authority of Pakistan).
- It provides verified medicine information including uses, side effects, dosage guidance, and price comparisons.
- It supports three languages: English, Urdu (اردو), and Roman Urdu.
- It uses RAG (Retrieval-Augmented Generation) to ground all responses in verified medical data.
- It does NOT diagnose conditions or prescribe medications. It only provides information about known medicines.
- All medicine prices are sourced from DRAP Pakistan's official regulated pricing."""

    # Build the full prompt
    system_prompt = build_safety_system_prompt(language)

    user_prompt = f"""Context from verified database:
{context if context else meta_context if meta_context else "No specific medicine context available. Only answer questions about medicines if you have verified context."}

User question: {message}

Provide a helpful, grounded response based ONLY on the context provided. If you don't have enough information, say so."""

    # Call Gemini
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_chat_model)

    try:
        # Build conversation history for Gemini
        history = []
        if conversation_history:
            for msg in conversation_history[-6:]:  # Keep last 6 messages
                role = "user" if msg["role"] == "user" else "model"
                history.append({"role": role, "parts": [msg["content"]]})

        chat = model.start_chat(history=history)
        response = chat.send_message(
            f"{system_prompt}\n\n{user_prompt}",
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )

        response_text = response.text.strip()
        response_text = validate_response(response_text)

        return ChatResponse(
            message=response_text,
            sources=sources,
            disclaimer=DISCLAIMER,
        )

    except Exception as e:
        logger.error(f"Chat generation failed: {type(e).__name__}: {e}", exc_info=True)
        return ChatResponse(
            message="I'm sorry, I encountered an error processing your request. Please try again.",
            sources=[],
            disclaimer=DISCLAIMER,
        )
