"""Safe image inspection and original-resolution region crops for OCR."""
import io
from PIL import Image, ImageOps, ImageStat

MAX_PIXELS = 30000000

def open_prescription(data: bytes):
    with Image.open(io.BytesIO(data)) as image:
        if image.width * image.height > MAX_PIXELS:
            raise ValueError("Image exceeds the 30 megapixel limit.")
        return ImageOps.exif_transpose(image).convert("RGB")

def inspect_image(data: bytes) -> dict:
    with open_prescription(data) as image:
        warnings = []
        if max(image.size) < 900:
            warnings.append("Low-resolution image: retake a closer, sharp photo if handwriting is unclear.")
        sample = image.copy()
        sample.thumbnail((512, 512))
        if ImageStat.Stat(sample.convert("L")).stddev[0] < 2:
            warnings.append("Image has very little visible contrast. Check that the full prescription is visible.")
        return {"width": image.width, "height": image.height, "warnings": warnings}

def valid_box(value) -> list[int] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        return None
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not 0 <= x <= 1000 for x in value):
        return None
    top, left, bottom, right = [int(x) for x in value]
    return [top, left, bottom, right] if top < bottom and left < right else None

def crop_region(data: bytes, box: list[int], padding: int = 0) -> bytes:
    box = valid_box(box)
    if box is None:
        raise ValueError("Crop must use [top,left,bottom,right] coordinates between 0 and 1000.")
    with open_prescription(data) as image:
        top, left, bottom, right = box
        rect = (int(max(0,left-padding)*image.width/1000), int(max(0,top-padding)*image.height/1000),
                int(min(1000,right+padding)*image.width/1000), int(min(1000,bottom+padding)*image.height/1000))
        if rect[2] <= rect[0] or rect[3] <= rect[1]:
            raise ValueError("Selected region is too small.")
        crop = image.crop(rect)
        buffer = io.BytesIO()
        crop.save(buffer, "PNG")
        return buffer.getvalue()

def map_box(local, region):
    local = valid_box(local)
    if local is None:
        return region
    if region is None:
        return local
    top,left,bottom,right = region
    a,b,c,d = local
    return [round(top+a*(bottom-top)/1000), round(left+b*(right-left)/1000), round(top+c*(bottom-top)/1000), round(left+d*(right-left)/1000)]
