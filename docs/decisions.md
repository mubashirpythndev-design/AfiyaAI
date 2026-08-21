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

## ADR-010: MVP Dataset
**Status**: Accepted
**Context**: Need a manageable scope for the hackathon MVP.
**Decision**: 40-medicine curated MVP dataset.
**Reason**: Allows demonstrating full functionality without massive data entry.
**Consequences**: System must gracefully handle queries outside the 40 medicines.

## ADR-011: Medical Scope
**Status**: Accepted
**Context**: Need to ensure strict medical safety.
**Decision**: Symptom-to-medication recommendation is OUT OF SCOPE.
**Reason**: High liability and risk; assistant is for medicine lookup, not diagnosis.
**Consequences**: Must implement strict safety guardrails.
