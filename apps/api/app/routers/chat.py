import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai

from app.config import settings
from app.db.database import get_db
from app.services.chat_service import generate_chat_response
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
        audio_bytes = await file.read()
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
            "Instructions:\n"
            "1. Accurately transcribe what was spoken, preserving the intended medicine names and dosage values (e.g. 500mg, syrup, tablets).\n"
            "2. If the user spoke in Urdu, transcribe into standard Urdu or Roman Urdu faithfully matching their speech.\n"
            "3. Output ONLY the raw transcribed text. Do NOT add quotation marks, explanations, notes, punctuation markup, or 'Transcript:'.\n"
            "4. If the audio is silent, pure static, or unintelligible noise with no discernible human speech, return an empty string."
        )

        model_candidates = [
            "models/gemini-3.5-flash",
            "models/gemini-3.5-flash-lite",
            "models/gemini-3.1-flash-lite",
            "models/gemini-flash-lite-latest",
        ]
        models_to_try = list(dict.fromkeys([m for m in model_candidates if m]))

        generation_config = genai.GenerationConfig(
            temperature=0.0,
            max_output_tokens=200,
        )

        text = ""
        last_exc = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = await model.generate_content_async(
                    [prompt, {"mime_type": gemini_mime, "data": audio_bytes}],
                    generation_config=generation_config,
                )
                if response and response.candidates:
                    candidate = response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        text = "".join(
                            getattr(part, "text", "") or ""
                            for part in candidate.content.parts
                        ).strip()
                    logger.info(f"Successfully transcribed audio with '{model_name}': {text[:40]}")
                    break
            except Exception as e:
                logger.warning(f"Voice transcription model '{model_name}' failed: {e}. Trying next fallback...")
                last_exc = e

        if not text and last_exc:
            logger.error(f"Voice transcription exhausted all candidates. Last error: {last_exc}")

        return {"transcript": text}
    except Exception as exc:
        logger.error(f"Failed to transcribe voice: {exc}")
        return {"transcript": "", "error": str(exc)}
