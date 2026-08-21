# 07 Chat Specification

## 1. Goal
Define the chat interface behavior and language capabilities.

## 2. Scope
- English, Urdu, and Roman Urdu responses.
- Handling user questions regarding medicines.

## 3. Out of Scope
- Transforming symptoms into prescriptions.
- General non-medical chit-chat beyond basic pleasantries.

## 4. Inputs
- User text queries.
- Retrieved context from RAG.

## 5. Outputs
- Text responses in the requested language.
- Source citations.

## 6. Functional Requirements
- Respond in the language used by the user or explicitly requested.
- Display sources and provenance for claims.
- Fallback gracefully for unsupported questions.

## 7. Technical Design
- LLM system prompt instructing language adaptation and grounding rules.

## 8. Workflow
User question → RAG retrieval → Grounded response generation (in English/Urdu/Roman Urdu) → Display with sources/uncertainty.

## 9. Error/Edge Cases
- Mixed language queries.
- Requests for information not in the database.

## 10. Security/Safety Considerations
- Must NOT act as a doctor.
- Must refuse symptom-based prescribing.

## 11. Acceptance Criteria
- Language is natural and accurate.
- Refuses unsafe queries.

## 12. Testing Requirements
- Prompt injection tests.
- Language consistency tests.

## 13. Open Questions
- None.
