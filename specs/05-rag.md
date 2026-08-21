# 05 RAG Specification

## 1. Goal
Define self-managed RAG using PostgreSQL + pgvector for semantic retrieval.

## 2. Scope
- Embedding generation, similarity search, and context assembly.

## 3. Out of Scope
- Using managed RAG services (e.g., external vector databases other than our PostgreSQL).

## 4. Inputs
- Verified medicine query.

## 5. Outputs
- Grounded context and retrieved knowledge chunks.

## 6. Functional Requirements
- Perform similarity search using pgvector.
- Filter by metadata (e.g., medicine ID).
- Assemble context for the LLM.

## 7. Technical Design
- Use `pgvector` operators (`<=>` or `<->`).
- Apply relational filtering before/during vector search to restrict context to the identified medicine.

## 8. Workflow
User/OCR query → embedding → pgvector similarity search → top-k candidates → metadata/relational filtering → authoritative structured data retrieval → context assembly → LLM → grounded response → source/provenance.

## 9. Error/Edge Cases
- Embedding API failure.
- No relevant chunks found.

## 10. Security/Safety Considerations
- LLM must only use retrieved context (prevent hallucinations).
- Preserve source traceability.

## 11. Acceptance Criteria
- Relevant knowledge is retrieved and passed to the LLM.

## 12. Testing Requirements
- Retrieval accuracy (Recall@K tests).

## 13. Open Questions
- OPEN DECISION: Embedding model and vector dimensions.
