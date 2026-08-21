# 04 Medicine Matching Specification

## 1. Goal
Convert OCR candidates or user queries into verified database entities safely.

## 2. Scope
- Normalization, exact matching, alias matching, and fuzzy matching.

## 3. Out of Scope
- Matching against medicines outside the 40-item MVP database.

## 4. Inputs
- Unverified medicine candidates from OCR or user text.

## 5. Outputs
- Verified medicine IDs or rejection/uncertainty signals.

## 6. Functional Requirements
- Normalize input (lowercase, strip whitespace).
- Match against exact names, generic names, and aliases.
- Provide a confidence score for matches.

## 7. Technical Design
- Multi-step pipeline: exact match → alias match → fuzzy match (e.g., Levenshtein distance).

## 8. Workflow
Normalization → exact matching → alias matching → fuzzy matching → confidence scoring → candidate ranking → confirmation/fallback.

## 9. Error/Edge Cases
- Misspelled inputs that match the wrong medicine.
- Multiple close fuzzy matches.

## 10. Security/Safety Considerations
- Do not allow uncertain matches to silently become verified medicines.
- High threshold for automatic matching; fallback to user confirmation.

## 11. Acceptance Criteria
- Accurately resolves correct inputs and safely flags ambiguous ones.

## 12. Testing Requirements
- Edge cases in spelling and formatting.

## 13. Open Questions
- None.
