# 00 Product Specification

## 1. Goal
Provide an AI-powered medicine assistant hackathon MVP that safely extracts, matches, and retrieves information about prescription medicines.

## 2. Scope
- 40 curated common medicines.
- Prescription OCR and medicine matching.
- Medicine information retrieval and price comparison.
- English, Urdu, and Roman Urdu responses.
- Source/provenance display.

## 3. Out of Scope
- Symptom-to-medication recommendation (STRICTLY PROHIBITED).
- Medical diagnosis.
- Complete pharmacy catalog (limited to 40 medicines).

## 4. Inputs
- Prescription images.
- User queries about specific medicines.

## 5. Outputs
- Matched medicine information.
- Price comparisons and savings.
- Safety disclaimers and sources.

## 6. Functional Requirements
- System must extract text from prescription images.
- System must match extracted text to the 40-medicine database.
- System must allow users to query medicine details.
- System must respond in the user's preferred language (English/Urdu/Roman Urdu).

## 7. Technical Design
- Next.js frontend for user interaction.
- FastAPI backend for orchestration.
- PostgreSQL database for structured data.

## 8. Workflow
User uploads prescription → System performs OCR → Extracts candidates → Matches to database → Displays medicine info and prices.

## 9. Error/Edge Cases
- Image too blurry for OCR.
- Medicine not in the 40-item database.
- Conflicting source prices.

## 10. Security/Safety Considerations
- Strict guardrails against diagnosing or prescribing.
- No PII storage from prescriptions.

## 11. Acceptance Criteria
- Successfully identifies and retrieves info for the 40 MVP medicines.
- Explicitly refuses symptom-based queries.

## 12. Testing Requirements
- Test OCR with various image qualities.
- Test rejection of diagnostic queries.

## 13. Open Questions
- OPEN DECISION: Which OCR provider to use?
