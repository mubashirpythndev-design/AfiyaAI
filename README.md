<div align="center">

<img src="apps/web/public/logo.svg" width="88" height="88" alt="Afiya AI Logo" />

# Afiya AI (عافیہ)
### *Your Intelligent Medicine Assistant for Pakistan*

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.6-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-0.8.6-green?style=flat-square&logo=vector&logoColor=white)](https://github.com/pgvector/pgvector)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash-8E75B2?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-118%20Passed-brightgreen?style=flat-square&logo=pytest&logoColor=white)](https://docs.pytest.org/)

**Afiya AI is an AI-powered medicine assistant designed for Pakistan.** It extracts medicine names from doctor prescription images via multimodal vision, verifies them against authoritative Drug Regulatory Authority of Pakistan (DRAP) records, checks government-notified Maximum Retail Prices (MRP), compares retail pharmacy prices, and delivers multilingual medical explanations in **English, Urdu (اردو), and Roman Urdu** using vector RAG.

[Live Demo](#-deployment--live-links) • [Features](#-key-features) • [Architecture](#-system-architecture) • [Tech Stack](#-technology-stack) • [Setup Guide](#-local-development-setup) • [Team](#-team--project-credits)

</div>

---

## 📌 Problem Statement & Solution

In Pakistan and developing healthcare systems:

1. **Handwritten Prescriptions**: Doctor handwriting is notoriously difficult for patients to decipher.
2. **Price Gouging & Overcharging**: Patients often pay inflated prices above government-regulated MRP ceilings due to a lack of price transparency.
3. **Language Barrier**: Most pharmaceutical documentation and inserts are strictly in English, creating a disconnect for Urdu and Roman Urdu speakers.
4. **Safety & AI Hallucinations**: Generic AI chatbots frequently invent medical advice or dosages, posing real health risks.

### 💡 The Afiya AI Solution:

- **Vision OCR Extraction**: Uses Google Gemini Multimodal Vision to accurately extract drug names, strengths, and forms from prescription photos.
- **Authoritative Matching**: Fuzzy-matches extracted candidates against 40+ curated, DRAP-registered essential medicines.
- **Price Transparency & MRP Watchdog**: Compares real-time prices across leading Pakistani retail pharmacies (Dvago, Sehat, Dawaai) and checks compliance against official DRAP Maximum Retail Price baselines.
- **Grounded Vector RAG (pgvector)**: Queries 768-dimensional dense vector embeddings stored in PostgreSQL to provide strict, zero-hallucination medical explanations.
- **Multilingual Support**: Fully localized in **English**, authentic **Nastaliq Urdu (اردو)**, and **Roman Urdu**.
- **Digital Medicine Cabinet**: Allows logged-in users to save medications and receive automatic safety alerts if any batch is recalled by DRAP.

---

## ✨ Key Features

```
├── 📷 Multimodal Prescription OCR     ── Instant drug extraction from handwritten/printed prescriptions
├── ⚖️ Multi-Pharmacy Price Comparison ── Real-time price tracking across top Pakistani pharmacies
├── 🛡️ DRAP MRP Overcharge Checker     ── Compares pharmacy prices against official government price caps
├── 🧠 Multilingual Chat RAG (pgvector)── Authoritative answers in English, Urdu (اردو), and Roman Urdu
├── 🗄️ Digital Medicine Cabinet        ── Personal prescription manager with DRAP recall watchdog alerts
├── 🔐 Role-Based Access Control (RBAC) ── Secure JWT authentication with dedicated Admin & Auditor portal
└── 🏥 Strict Medical Safety Guardrail ── Zero diagnosis/prescribing, instant emergency keyword interception
```

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend Layer (Next.js 15 + TypeScript)"]
        UI["Modern Responsive UI (Tailwind CSS)"]
        OCR_UI["Prescription Dropzone & Preview"]
        Chat_UI["Multilingual Chat (EN / UR / Roman UR)"]
        Price_UI["Price Comparison & MRP Checker"]
        Cabinet_UI["Digital Medicine Cabinet"]
    end

    subgraph API ["Backend Layer (Python + FastAPI)"]
        Router["FastAPI Gateway & Auth Middleware"]
        OCR_Svc["Gemini Vision OCR Extraction"]
        Match_Svc["DRAP Fuzzy Match Engine (thefuzz)"]
        RAG_Svc["RAG Retrieval & Guardrail Engine"]
        Safety_Svc["Emergency & Diagnostic Interceptor"]
    end

    subgraph Database ["Cloud Database (Neon Serverless PostgreSQL)"]
        PG["PostgreSQL 18.6 Database Engine"]
        VEC["pgvector 0.8.6 (768-dim Embeddings)"]
        Tables["Tables: medicines, sources, mrp_reference, knowledge_chunks, user_cabinet, users"]
    end

    subgraph AI ["AI & LLM Services"]
        Gemini_Vision["Google Gemini 3.5 Flash (Vision OCR)"]
        Gemini_Chat["Google Gemini 3.5 Flash (Multilingual LLM)"]
        Gemini_Embed["Google Gemini Embedding-001 (768-dim)"]
    end

    UI --> Router
    Router --> OCR_Svc
    Router --> Match_Svc
    Router --> RAG_Svc
    Router --> Safety_Svc

    OCR_Svc --> Gemini_Vision
    RAG_Svc --> Gemini_Embed
    RAG_Svc --> VEC
    RAG_Svc --> Gemini_Chat
    Match_Svc --> Tables
    Router --> PG
```

---

## 🛠️ Technology Stack

| Layer                         | Technologies                                                                                                                                                                                                        |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**                  | [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), Lucide Icons                               |
| **Backend**                   | [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [Pydantic v2](https://docs.pydantic.dev/), [Python 3.12](https://www.python.org/)                                                    |
| **Database & Vector Search**  | [Neon Serverless PostgreSQL](https://neon.tech/) (v18.6), [pgvector](https://github.com/pgvector/pgvector) (0.8.6), [SQLAlchemy 2.0 Async](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/) |
| **AI / OCR / Embeddings**     | [Google Gemini 3.5 Flash](https://ai.google.dev/) (Multimodal OCR & Multilingual Chat), [Gemini Embedding-001](https://ai.google.dev/) (768-dim Vector Embeddings)                                                  |
| **Authentication & Security** | Passlib (Bcrypt Password Hashing), PyJWT (Bearer Tokens), Role-Based Access Control (RBAC)                                                                                                                          |
| **Testing**                   | [Pytest](https://pytest.org/), [Pytest-Asyncio](https://pytest-asyncio.readthedocs.io/) (118 Automated Unit & Integration Tests)                                                                                    |
| **Deployment**                | [Vercel](https://vercel.com/) (Frontend), [Render](https://render.com/) / [Railway](https://railway.app/) (Backend), [Neon](https://neon.tech/) (Database)                                                          |

---

## 📂 Repository Structure

```
AfiyaAI/
├── apps/
│   ├── api/                          # FastAPI Python Backend
│   │   ├── alembic/                  # Database migration versions (0001 - 0008)
│   │   ├── app/
│   │   │   ├── db/                   # Database engine, ORM models, seeders & pgvector scripts
│   │   │   │   ├── database.py       # SQLAlchemy Base & declarative models
│   │   │   │   ├── seed_data.py      # 40 DRAP-registered medicines & market prices
│   │   │   │   ├── seed_mrp.py       # Official DRAP MRP price caps
│   │   │   │   ├── seed_knowledge.py # Grounded knowledge chunk generation
│   │   │   │   └── seed_embeddings.py# 768-dim Gemini vector embeddings generator
│   │   │   ├── models/               # Pydantic request/response schemas
│   │   │   ├── routers/              # API endpoints (auth, ocr, medicines, chat, price_check, cabinet, admin)
│   │   │   ├── services/             # Core business logic (OCR, matching, RAG, safety)
│   │   │   ├── config.py             # App environment configuration
│   │   │   └── main.py               # FastAPI entrypoint, lifespan & CORS
│   │   ├── tests/                    # 118 unit and integration test suite
│   │   ├── requirements.txt          # Python dependencies
│   │   └── alembic.ini               # Alembic database configuration
│   │
│   └── web/                          # Next.js 15 TypeScript Frontend
│       ├── public/                   # Static assets, branding, and icons
│       ├── src/
│       │   ├── app/                  # Next.js App Router (layout, page, admin)
│       │   ├── components/           # Reusable UI component modules
│       │   │   ├── auth/             # Login / Register modal
│       │   │   ├── chat/             # AI RAG Chat interface
│       │   │   ├── layout/           # Header, Footer, Navigation
│       │   │   ├── medicine/         # MedicineCard, PriceTable, MrpChecker, CabinetModal
│       │   │   ├── shared/           # CustomCursor, ThemeToggle, Toast
│       │   │   └── upload/           # Prescription ImageUploader & OCRResults
│       │   └── lib/                  # API client, auth helpers, types, i18n localization
│       ├── package.json              # Node.js dependencies
│       ├── tailwind.config.ts        # Tailwind styling & dark mode setup
│       └── tsconfig.json             # TypeScript compiler settings
│
├── data/                             # Curated DRAP reference datasets
├── docs/                             # Architecture Decision Records (ADRs) & Specs
├── AGENTS.md                         # Project development rules & guidelines
└── README.md                         # Master documentation (this file)
```

---

## ⚡ Local Development Setup

### 1. Prerequisites

- **Node.js**: v18+ or v20+
- **Python**: v3.11+ or v3.12+
- **Google Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)

---

### 2. Backend Setup (FastAPI)

```powershell
# Navigate to api directory
cd apps/api

# Create & activate Python virtual environment
python -m venv venv
.\venv\Scripts\activate      # Windows (PowerShell)
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Create .env configuration
cp .env.example .env
```

Configure your `apps/api/.env`:

```env
DATABASE_URL=postgresql+asyncpg://neondb_owner:<password>@<neon-host>/neondb?ssl=require
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=http://localhost:3000
ADMIN_EMAILS=admin@afiya.ai
```

Run database migrations & start the backend:

```powershell
# Apply all 8 database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Backend API**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### 3. Frontend Setup (Next.js)

```powershell
# Navigate to web directory
cd apps/web

# Install dependencies
npm install

# Create .env.local configuration
cp .env.example .env.local
```

Configure your `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server:

```powershell
npm run dev
```

- **Web Application**: `http://localhost:3000`

---

## 🚀 Deployment & Live Links

| Component | Platform | Configuration / Build Command | Live URL |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | [Vercel](https://vercel.com/) | Next.js 15 App (`apps/web`) | [**`https://afiya-ai.vercel.app`**](https://afiya-ai.vercel.app) |
| **Backend REST API** | [Railway](https://railway.app/) | FastAPI Python 3.12 (`apps/api`) | [**`https://afiyaai-production.up.railway.app`**](https://afiyaai-production.up.railway.app) |
| **Interactive API Docs** | [Swagger UI](https://swagger.io/) | Auto-generated OpenAPI 3.1 | [**`https://afiyaai-production.up.railway.app/docs`**](https://afiyaai-production.up.railway.app/docs) |
| **Vector Database** | [Neon](https://neon.tech/) | PostgreSQL 18.6 + `pgvector` 0.8.6 (768-dim) | *Managed Cloud (Live)* |

---

## 🧪 Testing & Quality Assurance

Afiya AI includes a comprehensive automated test suite with **118 unit and integration tests** covering:

- Prescription OCR candidate extraction and parsing
- Fuzzy medicine name matching and DRAP registration verification
- Vector similarity search and RAG context retrieval
- Emergency keyword detection and diagnostic refusal safety guardrails
- Price gouging detection and DRAP MRP baseline validations
- JWT authentication, password hashing, and Admin RBAC gating
- Migration reversibility and database schema integrity

```powershell
cd apps/api
pytest -v
```

```
========================= 118 passed in 62.59s =========================
```

---

## 🔒 Medical Ethics & Safety Guardrails

> [!IMPORTANT]
> **Afiya AI is strictly an educational information assistant and NOT a medical practitioner.**
>
> - **Zero Prescriptions / Diagnosis**: The system is programmatically barred from providing medical diagnoses or prescribing treatments.
> - **Grounded Fact Retrieval**: Structured medicine facts (ingredients, manufacturer, MRP, prices) originate strictly from authoritative DRAP records, never from generative hallucination.
> - **Emergency Interception**: Any critical medical query (e.g., chest pain, overdose, difficulty breathing) immediately triggers an urgent medical emergency directive advising the user to seek immediate professional hospital care.

---

## 👥 Team & Project Credits

<div align="center">

| Name                         | Role                                              | Responsibilities & Contributions                                                                                                                                                                                                                                                                                                                                                                                    |
| :--------------------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Muhammad Taha Khan**       | **Team Lead & Project Visionary**                 | • Conceptualized the original project idea<br>• Project planning, strategic direction & team management<br>• Pitch deck preparation & presentation delivery                                                                                                                                                                                                                                                         |
| **Muhammad Mubashir Khalid** | **Sole Full-Stack Developer & Software Engineer** | • **Engineered the complete technical codebase end-to-end**<br>• Designed & implemented the Next.js 15 UI and interactive components<br>• Built the Python FastAPI backend, REST endpoints & middleware<br>• Architected the PostgreSQL + pgvector (768-dim) RAG pipeline<br>• Integrated Gemini Multimodal Vision OCR with fallback cascades<br>• Authored all 8 Alembic database migrations & 118 automated tests |
| **Muhammad Sultan Abbasi**   | **Research & Quality Assurance**                  | • DRAP official medicine pricing & registration dataset research<br>• User acceptance testing & edge-case scenario validation<br>• Pharmaceutical data verification & documentation review                                                                                                                                                                                                                          |

</div>

---

<div align="center">

**Built with ❤️ for Pakistan's Digital Healthcare Future.**

</div>
