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
- Python-based OCR pipeline/service.
- Post-processing to clean up common OCR artifacts.

## 8. Workflow
Prescription image → OCR → extracted text → medicine candidate extraction → handoff to matching service.

## 9. Error/Edge Cases
- OCR errors and spelling mistakes.
- Poor handwriting.
- Missing strength or dosage info.
- Multiple medicines in one image.
- Low confidence extraction.

## 10. Security/Safety Considerations
- OCR output must NEVER automatically become a verified medicine entity.
- Require user confirmation for low-confidence matches.

## 11. Acceptance Criteria
- Extracts text accurately enough to feed the matching pipeline.

## 12. Testing Requirements
- Test with varied image qualities and handwriting styles.

## 13. Open Questions
- OPEN DECISION: Which OCR provider/model to use?
