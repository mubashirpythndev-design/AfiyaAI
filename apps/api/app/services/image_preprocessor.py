import io
import logging
try:
    from PIL import Image, ImageOps, ImageEnhance, ImageFilter
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

logger = logging.getLogger(__name__)

MAX_DIMENSION = 2200
MIN_DIMENSION = 800

def preprocess_prescription_image(image_bytes: bytes, mime_type: str = 'image/jpeg') -> tuple[bytes, str]:
    if not image_bytes:
        return image_bytes, mime_type

    if not _HAS_PIL:
        logger.warning("Pillow not installed; skipping image preprocessing.")
        return image_bytes, mime_type

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
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
            elif max_dim < MIN_DIMENSION and max_dim > 0:
                scale = MIN_DIMENSION / float(max_dim)
                target_w = int(orig_w * scale)
                target_h = int(orig_h * scale)
                img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

            # Multi-channel adaptive contrast to eliminate uneven yellow lighting and shadows
            r, g, b = img.split()
            r = ImageOps.autocontrast(r, cutoff=1.5)
            g = ImageOps.autocontrast(g, cutoff=1.5)
            b = ImageOps.autocontrast(b, cutoff=1.5)
            img = Image.merge('RGB', (r, g, b))

            contrast_enhancer = ImageEnhance.Contrast(img)
            img = contrast_enhancer.enhance(1.25)
            sharpness_enhancer = ImageEnhance.Sharpness(img)
            img = sharpness_enhancer.enhance(1.30)
            img = img.filter(ImageFilter.UnsharpMask(radius=1.8, percent=140, threshold=2))

            out_buffer = io.BytesIO()
            img.save(out_buffer, format='JPEG', quality=92, optimize=True)
            processed_bytes = out_buffer.getvalue()

            logger.info(f'OCR image preprocessed: {orig_w}x{orig_h} -> {target_w}x{target_h}')
            return processed_bytes, 'image/jpeg'
    except Exception as exc:
        logger.warning(f'Image preprocessing fallback triggered: {exc}')
        return image_bytes, mime_type
