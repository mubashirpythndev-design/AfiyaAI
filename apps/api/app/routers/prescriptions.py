"""Private, bounded prescription attachment storage (no AI processing)."""
import io
import warnings
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import PrescriptionAttachment, User, get_db
from app.services.auth_dependency import get_current_user

router = APIRouter(prefix="/api/v1/store/prescriptions", tags=["Prescription attachments"])
MAX_BYTES = 10 * 1024 * 1024
MEDIA_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
PRIVATE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
                   "Content-Security-Policy": "default-src 'none'"}


@router.post("")
async def upload_prescription(
    image: UploadFile = File(...), db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    try:
        content = await image.read(MAX_BYTES + 1)
    finally:
        await image.close()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "Image must be under 10 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as picture:
                media_type = MEDIA_TYPES.get(picture.format or "")
                if not media_type:
                    raise ValueError("Unsupported format")
                picture.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(422, "Select a valid JPEG, PNG or WebP image under 10 MB") from exc
    attachment = PrescriptionAttachment(user_id=current_user.id, media_type=media_type,
                                        size_bytes=len(content), content=content)
    db.add(attachment)
    await db.commit()
    return {"prescription_image_url": f"/uploads/{attachment.id}"}


@router.get("/{attachment_id}")
async def read_prescription(
    attachment_id: str, db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        canonical_id = str(UUID(attachment_id))
    except ValueError as exc:
        raise HTTPException(404, "Prescription not found", headers=PRIVATE_HEADERS) from exc
    attachment = await db.get(PrescriptionAttachment, canonical_id)
    if attachment is None or (attachment.user_id != current_user.id and not current_user.is_admin):
        raise HTTPException(404, "Prescription not found", headers=PRIVATE_HEADERS)
    return Response(content=attachment.content, media_type=attachment.media_type, headers=PRIVATE_HEADERS)
