"""Afiya AI — OCR Router (Prescription image upload & candidate extraction).
Author / Developer: Mubashir (Lead Developer)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.services.ocr_service import extract_from_image
from app.services.safety_layer import evaluate_drap_status, evaluate_risk_tier
from app.models.schemas import OCRResponse
from app.services.ocr_errors import classify_ocr_error, OCRServiceBusy
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db

router = APIRouter(prefix="/api/ocr", tags=["OCR"])

ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/pjpeg",
}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/extract", response_model=OCRResponse)
async def extract_prescription(image: UploadFile = File(...), force_refresh: bool = Form(False), scan_mode: str = Form("auto"), region: str | None = Form(None), db: AsyncSession = Depends(get_db)):
    """Upload a prescription image and extract medicine candidates."""
    content_type = (image.content_type or "").lower().strip()
    filename = (image.filename or "").lower()

    # Validate file type by MIME or extension fallback
    is_valid = content_type in ALLOWED_TYPES or filename.endswith((".jpg", ".jpeg", ".png", ".webp"))
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type or 'unknown'}. Allowed: JPEG, PNG, WebP",
        )

    # Read file
    contents = await image.read(MAX_SIZE + 1)

    # Validate size
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Normalize effective MIME
    effective_mime = "image/jpeg"
    if "png" in content_type or filename.endswith(".png"):
        effective_mime = "image/png"
    elif "webp" in content_type or filename.endswith(".webp"):
        effective_mime = "image/webp"

    import json
    from app.services.ocr_images import inspect_image, valid_box
    import asyncio
    try:
        await asyncio.to_thread(inspect_image, contents)
        crop = json.loads(region) if region else None
        if (region and valid_box(crop) is None) or scan_mode not in {"auto", "thorough", "fast"}:
            raise ValueError("Invalid scan mode or crop region")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unreadable image or invalid crop. Upload a clear JPEG, PNG or WebP under 30 megapixels.") from exc
    try:
        result = await extract_from_image(contents, effective_mime,force_refresh=force_refresh,scan_mode=scan_mode,region=crop,
                                          db=db if isinstance(db, AsyncSession) else None)

        # Enrich OCR candidates with safety layer assessments
        try:
            candidates = result.get("candidates", [])
            has_tier3 = False
            unverified_count = 0

            for cand in candidates:
                matched_med = cand.get("matched_medicine")
                drap = evaluate_drap_status(matched_med)
                risk = evaluate_risk_tier(matched_med)
                cand["safety"] = {
                    "drap_status": drap,
                    "risk_tier": risk,
                }
                if risk.get("tier") == 3:
                    has_tier3 = True
                if not drap.get("is_verified"):
                    unverified_count += 1

            notes: list[str] = []
            if has_tier3:
                notes.append("Prescription contains Tier 3 (High-Risk / Rx Only) medications. Dispense only under doctor supervision.")
            if unverified_count > 0:
                notes.append(f"{unverified_count} candidate(s) could not be verified in the DRAP registry. Verify with a licensed pharmacy.")

            result["global_safety_notes"] = notes
        except Exception as safety_exc:
            import logging
            logging.getLogger(__name__).warning(f"OCR Safety layer evaluation skipped due to: {safety_exc}")

        return OCRResponse(**result)
    except OCRServiceBusy as e:
        import logging
        logging.getLogger(__name__).warning("OCR extraction unavailable: OCR_SERVICE_BUSY; pharmacist fallback available")
        return JSONResponse(status_code=503, content=e.payload(), headers={"Retry-After": "60"})
    except Exception as e:
        failure = classify_ocr_error(e)
        if failure.category == "quota":
            raise HTTPException(
                status_code=429,
                headers={"Retry-After": "60"},
                detail="Gemini OCR API quota limit reached. Please wait a few moments for the quota window to reset, or check your Gemini API plan.",
            )
        import logging
        logging.getLogger(__name__).warning("OCR extraction unavailable: error=%s status=%s category=%s", type(e).__name__, failure.status, failure.category)
        if failure.category == "timeout":
            raise HTTPException(status_code=503, headers={"Retry-After": "5"},
                detail="The prescription scanning service took too long to respond. Please wait a few seconds and retry. No completed scan was returned.") from e
        if failure.category in {"unavailable", "network"}:
            raise HTTPException(status_code=503, headers={"Retry-After": "5"},
                detail="The prescription scanning provider is temporarily unavailable. Please retry shortly. Your image quality is not the cause of this service error.") from e
        if failure.category in {"access", "configuration"}:
            raise HTTPException(status_code=503,
                detail="Prescription scanning is unavailable because of the provider configuration or model access. Please contact the site administrator.") from e
        raise HTTPException(status_code=503, detail="Could not complete the prescription scan. Please retry or review the image manually.") from e
