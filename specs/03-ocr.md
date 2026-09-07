# 03 OCR Specification

## 1. Goal
Extract text from prescription images and identify potential medicine candidates.

## 2. Scope
- Image processing and text extraction.
- Extraction of medicine candidates from raw text.

## 3. Out of Scope
- Automated prescription fulfillment.

## 4. Inputs
- Prescription image (JPEG/PNG/PDF).

## 5. Outputs
- Raw extracted text.
- List of unverified medicine candidates.

## 6. Functional Requirements
- Handle handwritten and printed text.
- Extract potential drug names and strengths.

## 7. Technical Design
- Python-based OCR pipeline/service using **Google Gemini 3.5 Flash Multimodal Vision**.
- **Computer Vision Preprocessor (`image_preprocessor.py`)**: Local Pillow/OpenCV image normalization, CLAHE (Contrast Limited Adaptive Histogram Equalization), ink unsharp masking, and adaptive thresholding.
- **Deterministic Repeat Scan Cache**: Bounded SHA-256 cryptographic hash cache with FIFO eviction (`MAX_OCR_CACHE_ENTRIES = 500`) to ensure 100% repeatable extractions for identical prescription images.
- **Pharmaceutical Typo & Shorthand Corrector (`pharmaceutical_corrector.py`)**: Levenshtein distance matching against the DRAP medicine catalog, clinical shorthand parsing (`OD`, `BD`, `TID`, `QID`, `PRN`, `AC`, `PC`), and form/strength normalization.

## 8. Workflow
Prescription image → Local CV Preprocessing → SHA-256 Cache Check → Gemini 3.5 Flash Multimodal Vision → Pharmaceutical Typo & Shorthand Corrector → Extracted Candidates → DRAP Fuzzy Match Engine (thefuzz) → Bioequivalent Alternative Brand Retrieval.

## 9. Error/Edge Cases
- OCR errors and spelling mistakes (handled by Levenshtein distance and pharmaceutical alias map).
- Poor handwriting / faded ballpoint ink (enhanced via unsharp masking & contrast stretch).
- Missing strength or dosage info (safely defaulted to None).
- Corrupt byte streams (graceful passthrough fallback).
- Multiple medicines in one image (extracted as candidate list).
- Low confidence extraction (annotated with confidence score for user review).

## 10. Security/Safety Considerations
- OCR output must NEVER automatically become a verified medicine entity without verification against DRAP records.
- Require user confirmation and visual pill review.
- Strictly no diagnostic inferencing from prescription images.

## 11. Acceptance Criteria
- Extracts medicine names, strengths, forms, and dosage frequencies accurately enough to feed the matching pipeline.
- 100% deterministic repeatable output on duplicate image uploads.

## 12. Testing Requirements
- Test with varied image formats (JPEG, PNG, WebP, mobile `image/pjpeg`), resolutions, and handwriting styles.
- Unit tests for image preprocessing, shorthand expansion, pharmaceutical correction, and cache consistency (`test_ocr_pipeline.py`).

## 13. Accepted Design Decisions
- **OCR Engine**: Google Gemini 3.5 Flash Multimodal Vision with prompt-engineered clinical extraction schema.
- **Preprocessing Engine**: Pure-Python Pillow/NumPy adaptive CLAHE & sharpening with zero external system C-library dependencies.
- **Repeat Scan Consistency**: SHA-256 in-memory caching.
