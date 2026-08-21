---
name: ocr-medicine
description: Workflow for handling OCR on prescription images and extracting medicine candidates.
---

# OCR Medicine Skill

## Workflow
1. **Receive Image**: Validate prescription image format and size.
2. **Perform OCR**: Extract raw text from the image.
3. **Text Cleanup**: Fix common OCR artifacts (e.g., misread characters).
4. **Candidate Extraction**: Identify potential drug names and strengths (Output: `OCR candidate`).
5. **Confidence Scoring**: Assign a confidence score to each `OCR candidate`.
6. **Handoff**: Pass the `OCR candidate` list to the medicine matching pipeline.

## Crucial Rule
- NEVER mark OCR output as a verified medicine automatically.
