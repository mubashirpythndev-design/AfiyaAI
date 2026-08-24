"""OCR router - handles prescription image upload and extraction."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from app.services.ocr_service import extract_from_image
from app.models.schemas import OCRResponse

router = APIRouter(prefix="/api/ocr", tags=["OCR"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/extract", response_model=OCRResponse)
async def extract_prescription(image: UploadFile = File(...)):
    """Upload a prescription image and extract medicine candidates."""
    # Validate file type
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {image.content_type}. Allowed: JPEG, PNG, WebP",
        )

    # Read file
    contents = await image.read()

    # Validate size
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        result = await extract_from_image(contents, image.content_type or "image/jpeg")
        return OCRResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")
