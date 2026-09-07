# Architecture Decision Records (ADRs)

## ADR-001: Frontend Framework
**Status**: Accepted
**Context**: We need a robust framework for building the user interface.
**Decision**: Next.js + TypeScript for frontend.
**Reason**: Provides excellent developer experience, React ecosystem, and strong typing.
**Consequences**: Requires React/Next.js knowledge.

## ADR-002: Backend Framework
**Status**: Accepted
**Context**: We need a fast and modern API layer.
**Decision**: FastAPI + Python for backend.
**Reason**: Python is excellent for AI/ML integration; FastAPI is performant and auto-documents APIs.
**Consequences**: System requires separate frontend and backend deployments.

## ADR-003: Database
**Status**: Accepted
**Context**: We need a reliable storage for structured data.
**Decision**: PostgreSQL as primary relational database.
**Reason**: Robust, widely supported, and supports vector extensions.
**Consequences**: Requires relational schema design.

## ADR-004: Semantic Retrieval
**Status**: Accepted
**Context**: We need vector search capabilities for RAG.
**Decision**: pgvector for semantic retrieval.
**Reason**: Allows keeping vectors and relational data in the same DB.
**Consequences**: Requires pgvector extension enabled in PostgreSQL.

## ADR-005: Database Deployment
**Status**: Accepted
**Context**: We need a managed DB for the MVP.
**Decision**: Supabase as initial managed PostgreSQL deployment for MVP.
**Reason**: Fast setup and out-of-the-box pgvector support.
**Consequences**: Dependency on Supabase initially.

## ADR-006: Frontend Deployment
**Status**: Accepted
**Context**: Next.js requires a host.
**Decision**: Vercel as initial frontend deployment.
**Reason**: Native Next.js support and zero-config deployment.
**Consequences**: Standardized Vercel edge/serverless architecture.

## ADR-007: Backend Deployment
**Status**: OPEN DECISION
**Context**: Python backend needs a host.
**Decision**: Railway or Render as initial backend deployment; final choice OPEN.
**Reason**: Both are PaaS providers offering easy Python deployment.
**Consequences**: Needs final decision based on hackathon constraints.

## ADR-008: Qmind Usage
**Status**: Accepted
**Context**: Need to define the role of Qmind.
**Decision**: Qmind is NOT part of the Afiya runtime architecture.
**Reason**: Afiya runs independently of Qmind at runtime.
**Consequences**: Must ensure no runtime dependencies on Qmind.

## ADR-009: Alibaba Cloud
**Status**: Accepted
**Context**: Potential access to Alibaba Cloud via hackathon.
**Decision**: Alibaba Cloud may be adopted if hackathon access is provided; avoid unnecessary provider coupling.
**Reason**: Maintains flexibility and prevents vendor lock-in.
**Consequences**: Deployment architecture must remain abstract and configurable via env vars.

## ADR-010: MVP Dataset Expansion
**Status**: Superseded by ADR-013
**Context**: Need a manageable scope for the hackathon MVP.
**Decision**: Initial 40-medicine curated MVP dataset expanded to 100+ medicines.
**Reason**: Allows demonstrating full functionality without massive data entry.
**Consequences**: System must gracefully handle queries outside the curated medicines.

## ADR-011: Medical Scope
**Status**: Accepted & Refined by ADR-015
**Context**: Need to ensure strict medical safety.
**Decision**: Autonomous clinical diagnosis is strictly barred; symptom-to-medicine lookup is strictly informational with mandatory doctor confirmation.
**Reason**: High liability and risk; assistant is an educational tool, not a licensed practitioner.
**Consequences**: Strict emergency keyword interception and non-guarantee advisories.

## ADR-012: Database & Vector Search with Neon Serverless PostgreSQL
**Status**: Accepted
**Context**: Required a scalable, performant PostgreSQL database supporting `pgvector` with zero cold-start maintenance.
**Decision**: Adopt Neon Serverless PostgreSQL (v18.6) with `pgvector` (0.8.6) and SQLAlchemy 2.0 Async.
**Reason**: Native pgvector support, automatic connection pooling, branching capability, and high reliability.
**Consequences**: Centralized hybrid relational and 768-dimensional dense vector storage.

## ADR-013: Expanded DRAP Curated Dataset & MRP Baseline Reference
**Status**: Accepted
**Context**: Users need price transparency and generic alternatives across common conditions in Pakistan.
**Decision**: Curated 102 DRAP-registered medicines across 36 comparison groups, with 40+ statutory MRP price baselines and 3 retail pharmacy price feeds.
**Reason**: Ensures authentic, verified data grounding for price gouging alerts and generic substitution.
**Consequences**: All medicine facts are strictly grounded in seed data rather than LLM memory.

## ADR-014: Multimodal Vision OCR with OpenCV Preprocessing & Deterministic Caching
**Status**: Accepted
**Context**: Doctor handwritten prescriptions suffer from low contrast, handwriting noise, and non-deterministic repeat scans.
**Decision**: Implement pure-Python Pillow/NumPy adaptive CLAHE and ink unsharp masking, Gemini 3.5 Flash vision extraction, pharmaceutical typo normalization, and bounded SHA-256 caching.
**Reason**: Maximizes extraction accuracy, normalizes doctor shorthands (OD, BD, TID, PRN), and guarantees identical output on duplicate scans.
**Consequences**: Eliminates API hallucination and repeat cost for identical uploads.

## ADR-015: Controlled Symptom & Illness Informational Advisory
**Status**: Accepted
**Context**: Patients often query symptoms (e.g. headache, fever, pain, acidity) without knowing drug generic names.
**Decision**: Allow informational mapping of common symptoms to verified DRAP medicines with mandatory disclaimers and doctor consultation directives.
**Reason**: Enhances usability while maintaining ironclad safety compliance.
**Consequences**: Emergency queries (chest pain, poisoning, shortness of breath) immediately trigger 1122 emergency redirection.
