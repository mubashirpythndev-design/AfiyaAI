import logging
import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai

from app.config import settings
from app.services.ai_runtime import available, record_failure, bounded_call
from app.db.database import get_db
from app.services.chat_service import generate_chat_response
from app.services.voice_guardrail import sanitize_and_correct_voice_transcript
from app.models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

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
        prescription_context=req.prescription_context,
    )
    return response


@router.post("/chat/transcribe-voice")
async def transcribe_voice(
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    """Universal audio transcription fallback powered by Gemini 3.5 Flash."""
    try:
        audio_bytes = await file.read(10 * 1024 * 1024 + 1)
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio too large; maximum is 10 MB")
        if not audio_bytes:
            return {"transcript": ""}

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("models/gemini-3.5-flash")

        mime = file.content_type or "audio/webm"
        if "webm" in mime:
            gemini_mime = "audio/webm"
        elif "wav" in mime:
            gemini_mime = "audio/wav"
        elif "mp4" in mime or "m4a" in mime:
            gemini_mime = "audio/mp4"
        elif "ogg" in mime:
            gemini_mime = "audio/ogg"
        else:
            gemini_mime = "audio/webm"

        prompt = (
            "You are a state-of-the-art medical speech transcription system for Afiya AI, "
            "an AI healthcare and pharmacy assistant in Pakistan.\n"
            f"The user is speaking in {language} (or Urdu / Roman Urdu / Pakistani English / mixed code-switching).\n"
            "The audio may contain Pakistani medicine brand names, generics, dosages, or health symptoms.\n"
            "Examples of common medicines in Pakistan: Panadol, Augmentin, Brufen, Disprin, Flagyl, Arinac, "
            "Ponstan, Risek, Calpol, Gravinate, Softin, Zyrtec, Loprin, Amoxil, Entamizole, Sancos, Hydryllin, "
            "Cac-1000, Paracetamol, Ibuprofen, Omeprazole, Ciprofloxacin, Azithromycin.\n\n"
            "CRITICAL PHONETIC INSTRUCTIONS:\n"
            "- Local accents for Pakistani medicines can acoustically sound like ordinary or inappropriate words.\n"
            "- If speech sounds like 'porn star', 'pawn star', or 'corn star', it is 'Ponstan' or 'Ponstan Forte' (a common Mefenamic Acid painkiller). NEVER output profanity or adult terms.\n"
            "- If speech sounds like 'panda doll', it is 'Panadol'.\n"
            "- If speech sounds like 'fragile', it is 'Flagyl'.\n"
            "- If speech sounds like 'this print', it is 'Disprin'.\n"
            "- If speech sounds like 'argument in', it is 'Augmentin'.\n"
            "- If speech sounds like 'brew fan', it is 'Brufen'.\n"
            "- If speech sounds like 'rice cake', it is 'Risek'.\n"
            "- If speech sounds like 'cat 1000' or 'crack 1000', it is 'Cac-1000'.\n\n"
            "General Instructions:\n"
            "1. Accurately transcribe what was spoken, preserving the intended medicine names and dosage values (e.g. 500mg, syrup, tablets).\n"
            "2. If the user spoke in Urdu, transcribe into standard Urdu or Roman Urdu faithfully matching their speech.\n"
            "3. Output ONLY the raw transcribed text. Do NOT add quotation marks, explanations, notes, punctuation markup, or 'Transcript:'.\n"
            "4. If the audio is silent, pure static, or unintelligible noise with no discernible human speech, return an empty string."
        )

        model_candidates = [settings.gemini_chat_model, "models/gemini-flash-latest"]
        models_to_try = list(dict.fromkeys([m for m in model_candidates if m]))

        generation_config = genai.GenerationConfig(
            temperature=0.0,
            max_output_tokens=200,
        )

        text = ""
        last_exc = None
        provider_responded = False
        for model_name in models_to_try:
            if not available(model_name):
                continue
            try:
                model = genai.GenerativeModel(model_name)
                response = await bounded_call(lambda: model.generate_content_async(
                    [prompt, {"mime_type": gemini_mime, "data": audio_bytes}],
                    generation_config=generation_config,
                    request_options={"timeout": settings.ai_timeout_seconds},
                ))
                if response and response.candidates:
                    provider_responded = True
                    candidate = response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        text = "".join(
                            getattr(part, "text", "") or ""
                            for part in candidate.content.parts
                        ).strip()
                    logger.info("Successfully transcribed audio with %s", model_name)
                    break
            except Exception as e:
                record_failure(model_name, e)
                err_str = str(e)
                if "429" in err_str or "quota" in err_str.lower() or "ResourceExhausted" in type(e).__name__:
                    logger.warning(
                        f"Voice transcription model '{model_name}' hit rate limit/quota (429). Instantly trying next fallback..."
                    )
                else:
                    logger.warning(f"Voice transcription model '{model_name}' failed ({type(e).__name__}). Trying next fallback...")
                last_exc = e

        if not provider_responded:
            logger.warning("Voice transcription unavailable after provider attempts")
            raise HTTPException(status_code=503, detail="Voice transcription is temporarily unavailable. Please type your question or try again.")

        # Post-process with phonetic guardrail and safety sanitization
        text = sanitize_and_correct_voice_transcript(text)

        return {"transcript": text}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to transcribe voice: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Voice transcription is temporarily unavailable. Please type your question or try again.") from exc
