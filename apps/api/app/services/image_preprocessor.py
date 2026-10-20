import io
import logging
try:
    from PIL import Image, ImageOps, ImageEnhance, ImageFilter
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

logger = logging.getLogger(__name__)

MAX_DIMENSION = 3072
MIN_DIMENSION = 800

def preprocess_prescription_image(image_bytes: bytes, mime_type: str = 'image/jpeg') -> tuple[bytes, str]:
    if not image_bytes:
        return image_bytes, mime_type

    if not _HAS_PIL:
        logger.warning("Pillow not installed; skipping image preprocessing.")
        return image_bytes, mime_type

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            if img.width * img.height > 30000000:
                raise ValueError("Image exceeds 30 megapixels")
            img = ImageOps.exif_transpose(img)
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            elif img.mode == 'L':
                img = img.convert('RGB')

            orig_w, orig_h = img.size
            max_dim = max(orig_w, orig_h)

            target_w, target_h = orig_w, orig_h
            if max_dim > MAX_DIMENSION:
                scale = MAX_DIMENSION / float(max_dim)
                target_w = int(orig_w * scale)
                target_h = int(orig_h * scale)
                img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

            # Natural global autocontrast (without splitting channels to avoid color distortion)
            img = ImageOps.autocontrast(img, cutoff=0.5)
            contrast_enhancer = ImageEnhance.Contrast(img)
            img = contrast_enhancer.enhance(1.08)
            sharpness_enhancer = ImageEnhance.Sharpness(img)
            img = sharpness_enhancer.enhance(1.10)

            out_buffer = io.BytesIO()
            img.save(out_buffer, format='JPEG', quality=95)
            processed_bytes = out_buffer.getvalue()

            logger.info(f'OCR image preprocessed: {orig_w}x{orig_h} -> {target_w}x{target_h}')
            return processed_bytes, 'image/jpeg'
    except Exception as exc:
        logger.warning(f'Image preprocessing fallback triggered: {exc}')
        return image_bytes, mime_type
