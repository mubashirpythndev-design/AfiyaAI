"""Afiya AI — Multilingual RAG Chat Service (Gemini Orchestration & Medical Safety Enforcement).
Author / Developer: Mubashir (Lead Developer)
"""

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
from app.services.chat_resolution import resolve_medicine_from_message
from app.services.price_check_messages import localize
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
    med_schema = None

    if medicine_id:
        from app.db.database import Medicine
        from app.services.matching_service import medicine_to_schema
        from sqlalchemy import select
        res = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
        med_row = res.scalar_one_or_none()
        if med_row:
            med_schema = medicine_to_schema(med_row)

        rag_result = await retrieve_context(medicine_id, message, db)
        context = rag_result["context"]
        sources = [SourceSchema(**s) for s in rag_result["sources"]]
    else:
        # No explicit medicine context: try to resolve a medicine mention
        # from the message itself via the spec-04 matcher. Never guess:
        # ambiguous mentions ask the user to pick; no mention falls through
        # to the honest "no specific medicine context" prompt below.
        resolved = await resolve_medicine_from_message(message, db)
        if resolved is not None:
            if resolved["medicine"] and not resolved["needs_confirmation"]:
                med_schema = resolved["medicine"]
                medicine_id = med_schema.id
                rag_result = await retrieve_context(medicine_id, message, db)
                context = rag_result["context"]
                sources = [SourceSchema(**s) for s in rag_result["sources"]]
            elif resolved["needs_confirmation"] and resolved["alternatives"]:
                names = ", ".join(
                    f"{a.brand_name} {a.strength}" for a in resolved["alternatives"]
                )
                return ChatResponse(
                    message=f"{localize(language, 'needs_confirmation')} ({names})",
                    sources=[],
                    disclaimer=DISCLAIMER,
                )

    # Detect meta-questions about Afiya AI itself
    meta_keywords = ["what is afiya", "who are you", "about afiya", "afiya ai", "what can you do", "your name"]
    is_meta_question = any(kw in message.lower() for kw in meta_keywords)

    meta_context = ""
    if is_meta_question:
        meta_context = """About Afiya AI:
- Afiya AI is an intelligent medicine information assistant designed for Pakistan.
- It extracts medicine names from prescription images using AI-powered OCR.
- It matches medicines against a verified database of 100+ common medicines across 36 comparison groups registered with DRAP (Drug Regulatory Authority of Pakistan).
- It provides verified medicine information including uses, side effects, precautions, dosage guidance, and multi-brand price comparisons.
- It supports three languages: English, Urdu (اردو), and Roman Urdu.
- It uses RAG (Retrieval-Augmented Generation) to ground all responses in verified medical data.
- It does NOT diagnose conditions or prescribe medications. It only provides authoritative information about verified medicines.
- All medicine prices and MRP baselines are sourced from DRAP Pakistan's official regulated pricing."""

    # Build the full prompt
    system_prompt = build_safety_system_prompt(language)

    user_prompt = f"""Context from verified database:
{context if context else meta_context if meta_context else "No specific medicine context available. Answer clearly using verified medicine knowledge or ask the user which medicine they would like information on."}

User question: {message}

Instructions:
- Provide a helpful, clear, and structured response based on the verified context above.
- When asked about uses, side effects, precautions, dosage guidance, or price comparisons, clearly summarize the verified points present in the context using clean bullet points.
- Do NOT invent clinical facts, prices, or sources not present in the verified context.
- If the requested detail is not found in the context, politely suggest consulting a doctor or pharmacist for clinical advice.
- If answering in Roman Urdu, use natural, conversational Roman Urdu phrasing."""

    # Call Gemini with automatic model fallback
    genai.configure(api_key=settings.gemini_api_key)
    model_candidates = [
        settings.gemini_chat_model,
        "models/gemini-3.5-flash-lite",
        "models/gemini-3.1-flash-lite",
        "models/gemini-flash-lite-latest",
        "models/gemini-3.6-flash",
    ]
    models_to_try = list(dict.fromkeys(model_candidates))

    # Build conversation history for Gemini
    history = []
    if conversation_history:
        for msg in conversation_history[-6:]:  # Keep last 6 messages
            role = "user" if msg["role"] == "user" else "model"
            history.append({"role": role, "parts": [msg["content"]]})

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
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
                medicine=med_schema,
            )
        except Exception as e:
            logger.warning(f"Chat model '{model_name}' failed: {e}. Trying fallback...")

    return ChatResponse(
        message="I'm sorry, I encountered an error processing your request. Please try again.",
        sources=[],
        disclaimer=DISCLAIMER,
    )
