"""Afiya AI — OCR Router (Prescription image upload & candidate extraction).
Author / Developer: Mubashir (Lead Developer)
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from app.services.ocr_service import extract_from_image
from app.models.schemas import OCRResponse

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
async def extract_prescription(image: UploadFile = File(...)):
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
    contents = await image.read()

    # Validate size
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    # Normalize effective MIME
    effective_mime = "image/jpeg"
    if "png" in content_type or filename.endswith(".png"):
        effective_mime = "image/png"
    elif "webp" in content_type or filename.endswith(".webp"):
        effective_mime = "image/webp"

    try:
        result = await extract_from_image(contents, effective_mime)
        return OCRResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")
