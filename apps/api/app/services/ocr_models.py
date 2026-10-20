"""The explicit extraction order; old environment model overrides cannot reorder it."""
OCR_MODEL_CHAIN = (
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
)

# Keep the SDK and service deadlines aligned, including legacy environment values.
MIN_OCR_REQUEST_TIMEOUT_SECONDS = 35.0
