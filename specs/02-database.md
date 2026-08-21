# 02 Database Specification

## 1. Goal
Design the conceptual PostgreSQL schema for the MVP.

## 2. Scope
- Tables for medicines, prices, manufacturers, sources, and knowledge chunks.
- pgvector integration for RAG.

## 3. Out of Scope
- Executable migrations (at this stage).
- User authentication tables (if not needed for MVP).

## 4. Inputs
- Structured data for 40 medicines.

## 5. Outputs
- Relational and vector query results.

## 6. Functional Requirements
- Store medicines, aliases, prices, and sources.
- Support pgvector similarity search.

## 7. Technical Design
**Conceptual Tables:**
- `medicines`: id (PK), generic_name, brand_name, dosage_form, strength. (Core medicine data)
- `sources`: id (PK), name, url, type. (Provenance origins)
- `medicine_prices`: id (PK), medicine_id (FK), price, package_size, source_id (FK), collected_at. (Links medicine to a price and its source)
- `knowledge_chunks`: id (PK), medicine_id (FK), content, source_id (FK). (Text chunks with explicit provenance)
- `embeddings`: id (PK), chunk_id (FK), embedding (VECTOR). (Separates vector data from raw text)

**Constraints & Indexes:**
- FKs for relational integrity.
- Vector index on `knowledge_chunks.embedding`.
- Timestamps (`created_at`, `updated_at`).

## 8. Workflow
Insert curated data → Generate embeddings → Query via standard SQL and vector similarity.

## 9. Error/Edge Cases
- Null values in non-mandatory fields.
- Vector dimension mismatch.

## 10. Security/Safety Considerations
- Protect against SQL injection using parameterized queries.

## 11. Acceptance Criteria
- Schema supports all required entities and pgvector.

## 12. Testing Requirements
- Schema validation tests.

## 13. Open Questions
- OPEN DECISION: Exact vector dimensions (depends on embedding model selection).
