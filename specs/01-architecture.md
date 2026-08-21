# 01 Architecture Specification

## 1. Goal
Define the complete end-to-end architecture for the Afiya AI MVP.

## 2. Scope
- Frontend, Backend, Database, AI Orchestration layers.
- Deployment provider abstraction.

## 3. Out of Scope
- Qmind integration (not part of runtime).
- Production-grade auto-scaling infrastructure.

## 4. Inputs
- HTTP requests from clients.

## 5. Outputs
- HTTP responses and AI streams.

## 6. Functional Requirements
- Abstract external providers to avoid tight coupling.
- Ensure clear separation of concerns between frontend, backend, and database.

## 7. Technical Design
**Architecture Flow (Request/Data Lifecycle):**
1. Prescription image
2. → Image validation
3. → OCR
4. → Medicine candidate extraction
5. → Medicine normalization/matching
6. → Verified medicine
7. → Structured database lookup
8. → Price retrieval
9. → RAG retrieval using pgvector
10. → Context assembly
11. → LLM
12. → Medical safety validation
13. → Urdu/Roman Urdu response

**Layers:**
- **Frontend (Next.js):** UI, state management, image capture.
- **Backend (FastAPI):** API routes, orchestration, prompt assembly.
- **Database (PostgreSQL):** Authoritative structured facts and semantic vectors.
- **AI/OCR:** LLM for reasoning/language, OCR for image-to-text.

**Deployment Abstraction:**
- Supabase is the initial PostgreSQL choice, but Alibaba Cloud may be used if provided.
- Vercel (Frontend), Railway/Render (Backend). Note: Changing a database connection string does not guarantee complete provider portability (e.g., handling backups, IAM, or specific vector extension behaviors). Code must abstract provider specifics where feasible.

## 8. Workflow
End-to-end request lifecycle from Next.js to FastAPI to Database/LLM and back.

## 9. Error/Edge Cases
- Provider timeouts.
- Database connection failures.

## 10. Security/Safety Considerations
- Do not expose database credentials to the frontend.
- Secure API endpoints.

## 11. Acceptance Criteria
- Services communicate successfully.
- Database can be swapped via connection strings.

## 12. Testing Requirements
- Integration tests across boundaries.

## 13. Open Questions
- OPEN DECISION: Final LLM provider.
