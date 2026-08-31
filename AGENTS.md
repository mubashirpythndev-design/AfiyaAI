# Afiya AI - Project Orientation

## Project Purpose
Afiya AI is an AI-powered medicine assistant designed as a hackathon MVP. It extracts medicine names from prescription images, matches them against a verified database, retrieves authoritative information using RAG, and compares prices.

## MVP Scope
- Approximately 40 carefully selected common medicines
- Prescription image OCR and medicine name extraction
- Medicine normalization, matching, and information retrieval
- Price comparison for supported medicines
- RAG using PostgreSQL + pgvector
- Explanations in Urdu/Roman Urdu
- Source/provenance display
- Medical safety guardrails (no diagnosis or prescribing)

## Approved Stack
- **Frontend**: Next.js + TypeScript
- **Backend**: Python + FastAPI
- **Database**: Neon Serverless PostgreSQL with pgvector (SQLite for local test suites)
- **Vector Search**: pgvector
- **Deployment**: Vercel (Frontend), Railway or Render (Backend)
- **LLM/OCR**: Provider agnostic (to be decided)

## High-Level Architecture
User → Next.js → FastAPI → OCR / AI orchestration → PostgreSQL + pgvector (retrieval) → LLM → Urdu/Roman Urdu response

## Repository Structure
- `specs/`: Detailed markdown specifications for each domain.
- `.qoder/rules/`: Always-on behavioral rules and constraints.
- `.qoder/skills/`: Procedural workflows for specific tasks.
- `docs/`: Architecture Decision Records (ADRs).
- `data/`: Data schemas for medicines and sources.

## Development Workflow
- Consult `specs/` before implementing any feature.
- Adhere strictly to `.qoder/rules/`.
- Use workflows defined in `.qoder/skills/`.

## Important Commands
- `npm run dev` (Frontend - *Placeholder*)
- `fastapi dev main.py` (Backend - *Placeholder*)
- *Further commands to be added*

## Important Constraints
- **NO DIAGNOSIS OR PRESCRIBING.**
- The LLM must not invent medical facts or prices.
- All structured medicine facts (like verified prices, ingredients, and dosages) must originate from the authoritative database, not the LLM's internal weights.
- Qmind is NOT part of the runtime architecture.
- Avoid unnecessary cloud provider coupling.
