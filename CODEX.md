# Afiya AI — Codex Master Project Knowledge & Handoff Guide

> **Document Version:** 1.0.0  
> **Target Audience:** OpenAI Codex / Automated AI Software Engineering Agents  
> **Repository Root:** `D:\Works\Hackathon 2\AfiyaAI`  
> **Author & Founding Team:**  
> 1. **Muhammad Taha Khan** — Team Lead & Project Visionary  
> 2. **Muhammad Mubashir Khalid** — Lead Full-Stack Developer & Software Architect (Built entire technical codebase)  
> 3. **Muhammad Sultan Abbasi** — Research, Data Verification & Quality Assurance  

---

## 1. Executive Summary & Core Mission

### 1.1 Project Identity
- **Project Name:** **Afiya AI** (عافیہ اے آئی)  
  *(Note: The project was briefly tested under the candidate name "Qiyas AI" during development, but was formally finalized and standardized as **Afiya AI** across all UI banners, logos, routes, audio outputs, and documentation. Keep the name strictly as **Afiya AI**).*
- **Tagline:** Pakistan's First AI-Powered Clinical Prescription Intelligence & Medicine Price Transparency Platform.

### 1.2 The Real-World Problems Solved in Pakistan
Afiya AI was engineered specifically to solve chronic, life-threatening, and economic failures in Pakistan's healthcare and retail pharmacy ecosystem:
1. **Prescription Handwriting & Dispensing Errors:** Messy cursive handwriting and clinical shorthand cause 1 in 4 medication errors globally. In Pakistan, patients frequently receive the wrong drug or incorrect strength.
2. **Unregulated Pharmacy Price Gouging:** Retail pharmacies routinely charge consumers 20% to 150% above the Maximum Retail Prices (MRP) legally set by the Drug Regulatory Authority of Pakistan (DRAP). Patients have no easy way to verify if they are being overcharged.
3. **Originator Brand Monopolies & Household Poverty:** Multinational brands dominate prescriptions. Families spend thousands of rupees monthly on high-cost brands when identical, bioequivalent local generic alternatives cost 40% to 65% less.
4. **Language & Health Literacy Barriers:** Latin medical abbreviations (*TDS, BD, OD, ac, pc, stat*) and English-only packaging confuse patients. Urdu-speaking families struggle to adhere to daily routines.
5. **Polypharmacy & Missed Doses:** Chronic patients (diabetes, hypertension) juggle 5–8 pills daily without structured reminders, leading to missed doses or accidental double dosing.
6. **AI Hallucination & Medical Liability Risks:** Generic LLMs often hallucinate incorrect drug dosages or attempt to diagnose diseases without a medical license. Afiya AI solves this with strict, multi-layered clinical guardrails.

---

## 2. Core Constraints & Golden Rules for Codex

When working in this codebase, Codex **MUST ALWAYS** follow these non-negotiable rules:

1. **NO DIAGNOSIS AND NO PRESCRIBING:**
   - Afiya AI is an informational and decision-support assistant, **NOT** a doctor.
   - The LLM must **never** diagnose an illness or prescribe a treatment.
   - If a user asks *"What disease do I have?"* or *"Prescribe me medicine"*, the system must politely refuse and direct them to consult a licensed physician.
   - If life-threatening symptoms (chest pain, stroke, poisoning, severe bleeding) are detected, immediately trigger emergency deflection to **1122 (Rescue / Emergency Services)**.
2. **ZERO TOLERANCE FOR HALLUCINATED FACTS OR PRICES:**
   - All structured medicine facts (active generic molecule, indications, strengths, dosages, precautions, side effects, verified pack prices) must originate **strictly from the verified database** (PostgreSQL/pgvector or SQLite).
   - The LLM must **never** invent prices, alternate molecules, or statutory DRAP limits from its internal model weights.
3. **DRAP 2024 REGULATORY BASELINE:**
   - Price calculations must benchmark against official DRAP Statutory Regulatory Orders (S.R.O. ceiling gazettes).
4. **PRESERVE ALL EXISTING AUTOMATED TESTS:**
   - The backend contains a 158-test comprehensive regression test suite (`apps/api/tests`).
   - Any refactoring or feature additions must maintain `158/158` passing tests (`pytest apps/api/tests`).
5. **PRESERVE TRILINGUAL CAPABILITIES:**
   - The platform supports English, Urdu script, and Roman Urdu (*e.g., "1 goli subah aur sham khane ke baad"*).

---

## 3. Technology Stack & Architecture

```mermaid
flowchart TD
    User([Patient / Family / Pharmacist]) -->|Web App / Voice / Camera| Web[Next.js 16 Web Application]
    Web -->|REST API / JSON| API[FastAPI Python Backend]
    
    subgraph Frontend [apps/web (Next.js 16 + TypeScript)]
        UI[Tailwind CSS + Lucide Icons]
        Voice[Web Speech API Audio Engine]
        ClerkAuth[Clerk Authentication + JWT]
        I18n[Trilingual Engine: EN / UR / Roman Urdu]
    end

    subgraph Backend [apps/api (FastAPI + Python 3.12)]
        Router[API Routers: ocr, medicines, chat, cabinet, admin]
        OCR[Gemini 3.5 Flash Vision + OpenCV Preprocessor]
        Corrector[Pharmaceutical Lexicon Typo Corrector]
        Matcher[4-Tier Medicine Matching Engine]
        Safety[Clinical Safety & Emergency Deflector]
        RAG[pgvector Semantic Retrieval Engine]
    end

    subgraph Database [Storage & Knowledge]
        PG[(PostgreSQL + pgvector / SQLite Test)]
        JSONData[(102 DRAP Verified Medicines)]
        DiskCache[(SHA-256 Prescription OCR Disk Cache)]
    end

    API --> OCR
    API --> Matcher
    API --> RAG
    OCR --> DiskCache
    Matcher --> PG
    RAG --> PG
    API --> JSONData
```

### 3.1 Frontend (`apps/web`)
- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Language:** TypeScript (Strict typing)
- **Styling:** Tailwind CSS with responsive mobile-first UI
- **Icons:** Lucide React
- **Authentication:** Clerk Next.js SDK (`@clerk/nextjs`) with automated backend JWT syncing and guest fallback mode.
- **Voice Capabilities:** Web Speech API for speech-to-text recognition (voice medicine search & voice chat input) and text-to-speech synthesis in English and Urdu.
- **State & Storage:** Local state hooks + persistent browser LocalStorage for offline support.

### 3.2 Backend (`apps/api`)
- **Framework:** FastAPI (Python 3.12+)
- **ORM / Database Layer:** SQLAlchemy 2.0 (Async) + `asyncpg` (Production) / `aiosqlite` (Local tests)
- **Database Targets:**
  - **Production:** Neon Serverless PostgreSQL with `pgvector` extension (768 dimensions).
  - **Local Development & Automated Tests:** SQLite (`afiya_test.db` / in-memory).
- **Database Migrations:** Alembic
- **Validation:** Pydantic v2 schemas (`app.models.schemas`)
- **Security:** JWT bearer tokens (HS256 algorithm), Role-Based Access Control (Admin emails list in `ADMIN_EMAILS`).

### 3.3 AI Models & Vision Pipeline
- **Primary Vision OCR Model:** `models/gemini-3.5-flash` (Fast: ~3.8s–4.5s latency, superior Pakistani cursive handwriting recognition).
- **Secondary Vision Fallbacks:** `models/gemini-3.8-flash` and `models/gemini-flash-latest`.
- **Text & Chat Model:** `models/gemini-3.5-flash` with safety system prompts.
- **Embeddings:** `models/gemini-embedding-001` (768-dimensional vector space).
- **Computer Vision Preprocessing:** PIL (Pillow) & ImageOps for adaptive autocontrast, sharpening, and deskewing.
- **Optical Handwriting Correction:** RapidFuzz token matching against DRAP reference terminology.
- **OCR Caching:** Persistent disk-backed SHA-256 image hash cache (`apps/api/data/.prescription_ocr_cache.json`). Repeat scans execute in **0.001s** with **0 API quota consumed**.

---

## 4. Repository Structure & File Map

```text
AfiyaAI/
├── .env.example                               # Root environment configuration template
├── README.md                                  # Public documentation and hackathon pitch
├── MASTER_DOCUMENTATION.md                    # In-depth architectural specification
├── PROJECT_OVERVIEW.md                        # High-level feature matrix
├── CODEX.md                                   # This master file for Codex agents
├── afiya_medicine_comparison_dataset_clean.json # Core dataset: 102 verified medicines
│
├── apps/
│   ├── web/                                   # Frontend Next.js 16 Application
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx                   # Main Dashboard (Tabs: Search, Scan, MRP, Chat, Cabinet)
│   │       │   ├── layout.tsx                 # Root layout with Clerk Auth Provider & Nav
│   │       │   └── admin/page.tsx             # Protected Admin Portal (Stock, Prices, Telemetry)
│   │       ├── components/
│   │       │   ├── layout/                    # Header, Footer, Language Selector
│   │       │   ├── upload/                    # PrescriptionUpload, OCRResults, Interactive Cards
│   │       │   ├── medicine/                  # MedicineSearch, MedicineCard, MrpChecker, CabinetModal
│   │       │   ├── chat/                      # ChatInterface, Trilingual Voice Chat
│   │       │   └── shared/                    # VoiceButton, Alerts, Modals
│   │       └── lib/
│   │           ├── api.ts                     # Central typed API client calling FastAPI backend
│   │           ├── constants.ts               # Color tokens, DRAP baseline constants
│   │           ├── i18n.ts                    # Trilingual localization dictionaries (EN, UR, Roman Urdu)
│   │           ├── types.ts                   # TypeScript interfaces matching backend Pydantic models
│   │           └── useSpeechRecognition.ts    # Web Speech API custom hook
│   │
│   └── api/                                   # Backend FastAPI Application
│       ├── requirements.txt
│       ├── pytest.ini
│       ├── alembic.ini
│       ├── data/
│       │   ├── afiya_medicine_comparison_dataset_clean.json # Working dataset copy
│       │   └── .prescription_ocr_cache.json   # Persistent SHA-256 OCR cache
│       ├── app/
│       │   ├── main.py                        # FastAPI entrypoint, CORS, lifespan seeding
│       │   ├── config.py                      # Pydantic BaseSettings, env variable management
│       │   ├── db/
│       │   │   ├── database.py                # SQLAlchemy ORM Models (Medicine, Price, Cabinet, etc.)
│       │   │   └── seed_data.py               # Auto-seed logic populating 102 medicines & DRAP prices
│       │   ├── models/
│       │   │   └── schemas.py                 # Pydantic request/response schemas
│       │   ├── routers/
│       │   │   ├── ocr.py                     # Prescription upload & vision extraction endpoint
│       │   │   ├── medicines.py               # Search, lookup, price comparison, alternatives endpoints
│       │   │   ├── chat.py                    # RAG chat endpoint with voice synthesis support
│       │   │   ├── cabinet.py                 # Personal digital medicine cabinet & reminder routes
│       │   │   └── admin.py                   # Admin catalog management & system health telemetry
│       │   └── services/
│       │       ├── ocr_service.py             # Gemini Vision multimodal pipeline & fallback cascade
│       │       ├── image_preprocessor.py      # Contrast adjustment, sharpening, orientation
│       │       ├── pharmaceutical_corrector.py # Optical typo correction using DRAP brand lexicon
│       │       ├── matching_service.py        # 4-tier brand, generic, and fuzzy matching engine
│       │       ├── price_service.py           # Price comparison & DRAP MRP compliance evaluation
│       │       ├── cheapest_brand_service.py  # Bioequivalent alternative discovery & savings calculator
│       │       ├── rag_service.py             # Vector context retrieval from pgvector embeddings
│       │       ├── chat_service.py            # Conversational orchestration, owner FAQs, guardrails
│       │       ├── safety_service.py          # Anti-diagnosis rules & emergency 1122 deflection
│       │       ├── safety_layer.py            # Pre/post-generation clinical validation filters
│       │       ├── voice_guardrail.py         # Voice audio transcription safety checks
│       │       └── auth_service.py            # JWT verification & Clerk user synchronization
│       └── tests/                             # 158 Automated Pytest Test Cases
│           ├── test_ocr_pipeline.py           # Preprocessing, typo correction, shorthand tests
│           ├── test_cheapest_brand.py         # Alternative ranking & bachat calculation tests
│           ├── test_price_check.py            # DRAP MRP overcharge auditing tests
│           ├── test_cabinet.py                # Medicine cabinet CRUD & reminder schedule tests
│           ├── test_safety_and_voice.py       # Emergency deflection & anti-diagnosis tests
│           ├── test_auth.py                   # JWT & RBAC access control tests
│           └── ... (158 passing test files)
```

---

## 5. Complete Feature Catalog (What is Built & Working)

### Feature 1: Clinical Prescription Vision OCR & Extraction
- **File:** [`apps/api/app/services/ocr_service.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/services/ocr_service.py) & [`apps/web/src/components/upload/OCRResults.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/upload/OCRResults.tsx)
- **Workflow:** 
  1. User takes a photo or uploads a prescription image (JPEG/PNG).
  2. Preprocessor deskews and sharpens faint pencil/pen ink.
  3. Gemini 3.5 Flash processes the image using the clinical prescription prompt.
  4. Extracted entries pass through the Pharmaceutical Corrector to fix handwriting misreads (e.g., optical misreads like *"Panado1"* or *"Brvfen"* are snapped to *"Panadol"* and *"Brufen"*).
  5. Identifies brand, generic molecule, dosage strength (`500mg`, `20mg`), dosage form (`Tablet`, `Injection`, `Capsule`, `Syrup`, `Inhaler`), clinical frequency (`TDS`, `BD`, `OD`), and expands Pakistani shorthand (*"1+1"* $\rightarrow$ *"1 tablet twice daily after meals"*).
  6. Form-mismatch detection flags discrepancies (e.g., if a prescription says *"Risek Injection"* but the database has *"Risek Capsule"*, it warns the user: `FORM_MISMATCH`).
  7. Results are cached on disk by SHA-256 hash so re-scans take **0.001s**.

### Feature 2: DRAP-Grounded Medicine Search & Normalization
- **File:** [`apps/api/app/services/matching_service.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/services/matching_service.py) & [`apps/web/src/components/medicine/MedicineSearch.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/medicine/MedicineSearch.tsx)
- **Matching Engine:** 4-tier hierarchy:
  1. Exact Brand Match (case-insensitive).
  2. Brand Match without Strength (e.g., searching *"Augmentin 625mg"* matches *"Augmentin"*).
  3. Generic Molecule Match (e.g., searching *"Paracetamol"* returns all registered brands sorted by price).
  4. Whole-Word Token Set & Fuzzy Match (strict 82% threshold prevents false positives).
- **Search Capabilities:** Instant typeahead auto-suggest, therapeutic category badges, and bilingual speech voice search (English & Roman Urdu).

### Feature 3: Official DRAP Overcharge Auditor (MRP Checker)
- **File:** [`apps/api/app/services/price_service.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/services/price_service.py) & [`apps/web/src/components/medicine/MrpChecker.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/medicine/MrpChecker.tsx)
- **Workflow:**
  1. User enters medicine name, pack size, and the price charged at the pharmacy.
  2. System compares the price against the official DRAP 2024 S.R.O. ceiling price.
  3. Returns status:
     - 🔴 **OVERCHARGED:** Computes exact illegal excess paid in PKR and percentage gouged.
     - 🟢 **OK_AT_MRP:** Charged at or fairly aligned with the legal maximum.
     - 🔵 **BELOW_MRP:** Identifies discounted promotional pricing.
  4. Generates a formal, printable **DRAP Consumer Complaint Slip** citing official statutory regulations that the user can present to pharmacy managers or provincial drug inspectors.

### Feature 4: Bioequivalent Generic Substitution & Bachat Calculator
- **File:** [`apps/api/app/services/cheapest_brand_service.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/services/cheapest_brand_service.py) & [`apps/web/src/components/medicine/CheapestBrandCard.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/medicine/CheapestBrandCard.tsx)
- **Workflow:**
  - For any selected brand, the system queries the database for all bioequivalent medicines sharing the exact same active generic molecule, strength, and dosage form.
  - Automatically identifies the cheapest verified brand in Pakistan.
  - Computes exact pack savings and unit savings (typically **40% to 65% monthly savings**).
  - Reminds the patient to confirm with their doctor or pharmacist before switching brands.

### Feature 5: Personal Digital Medicine Cabinet & Reminder Routine
- **File:** [`apps/api/app/routers/cabinet.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/routers/cabinet.py) & [`apps/web/src/components/medicine/CabinetModal.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/medicine/CabinetModal.tsx)
- **Capabilities:**
  - **Save to Cabinet:** 1-click individual saving or 1-click *"Save All"* from prescription OCR results.
  - **Afiya Monthly Budget Estimator:** Aggregates total monthly prescription expense across all active cabinet medicines based on DRAP prices.
  - **Potential Monthly & Annual Bachat:** Projects exact money saved by switching cabinet medicines to verified local generic alternatives.
  - **Daily Routine Reminders:** Interactive toggles for:
    - 🌅 Morning (8:00 AM) / صبح
    - ☀️ Afternoon (2:00 PM) / دوپہر
    - 🌙 Night (8:00 PM) / رات
  - **Push Notification Toggle:** Browser desktop/mobile notification permission toggle.
  - **1-Click WhatsApp Share:** Formats and encodes the patient's complete daily medication schedule into a WhatsApp message link to share with family members or caregivers.

### Feature 6: Trilingual RAG Chat Assistant & Clinical Safety Layer
- **File:** [`apps/api/app/services/chat_service.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/services/chat_service.py) & [`apps/web/src/components/chat/ChatInterface.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/components/chat/ChatInterface.tsx)
- **Clinical Safety Guardrails:**
  - Emergency Symptom Deflector: Triggers immediate 1122 redirect for cardiac, stroke, poison, or trauma keywords.
  - Anti-Diagnosis Filter: Strictly refuses requests to diagnose symptoms or formulate medical treatment regimens.
  - Grounded Context: Injects verified database facts (active salts, side effects, precautions, prices) into prompt instructions.
  - Trilingual Answers: Fluent in English, Urdu script, and Roman Urdu.
  - Team & Owner FAQs: Accurately identifies founding team members (*Taha Khan, Mubashir Khalid, Sultan Abbasi*) when asked who developed Afiya AI.

### Feature 7: Protected Admin Portal & Telemetry
- **File:** [`apps/api/app/routers/admin.py`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/api/app/routers/admin.py) & [`apps/web/src/app/admin/page.tsx`](file:///D:/Works/Hackathon%202/AfiyaAI/apps/web/src/app/admin/page.tsx)
- **Capabilities:**
  - Role-Based Access Control (RBAC): Verifies user email against `ADMIN_EMAILS`.
  - Catalog Management: Live search, editing, and overrides for medicine prices and stock.
  - System Health Telemetry: Monitors database connection latency, active cache entries, and API route status.

---

## 6. Current Database State & Schemas

### 6.1 Database Models (`apps/api/app/db/database.py`)
1. **`Medicine`**:
   - `id` (Integer PK), `brand_name` (String, indexed), `generic_name` (String, indexed), `dosage_form` (String), `strength` (String), `manufacturer` (String), `description` (Text), `when_to_use` (Text), `side_effects` (Text), `precautions` (Text), `is_essential` (Boolean).
2. **`MedicinePrice`**:
   - `id` (Integer PK), `medicine_id` (FK to Medicine), `pack_price` (Numeric), `units_per_pack` (Integer), `unit_price` (Numeric), `source_id` (FK to Source), `is_discounted` (Boolean), `is_mrp` (Boolean), `scraped_at` (DateTime).
3. **`MedicineEmbedding`**:
   - `id` (Integer PK), `medicine_id` (FK to Medicine), `embedding` (Vector 768), `content_hash` (String).
4. **`Cabinet`**:
   - `id` (Integer PK), `user_id` (String / Clerk ID), `medicine_id` (FK to Medicine), `dosage_instruction` (String), `frequency` (String), `morning` (Boolean), `afternoon` (Boolean), `night` (Boolean), `reminders_enabled` (Boolean), `notes` (Text), `created_at` (DateTime).
5. **`Source`**, **`User`**, **`PriceReport`**, **`Feedback`**.

### 6.2 Seed Dataset (`afiya_medicine_comparison_dataset_clean.json`)
- **Total Verified Medicines in Database:** **102 medicines**
- **Unique Brand Names:** **102 brands**
- **Unique Active Generics (Molecules):** **34 generic molecules**
- **Dosage Forms:** `Tablet`, `Capsule`, `Inhaler`, `Tablet (Modified-release)`.
- Covers core essential drug classes in Pakistan: Analgesics/Antipyretics, PPIs/Antacids, Broad-Spectrum Antibiotics, Cardiovascular (Beta-blockers, ACE inhibitors, Calcium channel blockers), Anti-diabetic (Metformin, Glimepiride), Bronchodilators/Asthma, Antihistamines, and Vitamins/Supplements.

---

## 7. How to Run, Test & Build

### 7.1 Environment Setup
Backend requires `.env` in `apps/api/.env` (or root):
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./afiya.db
# For production Neon PostgreSQL:
# DATABASE_URL=postgresql+asyncpg://user:password@host/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_here
ADMIN_EMAILS=mubashirkhalid@example.com
```

Frontend requires `.env.local` in `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_pub_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### 7.2 Running Locally
- **Start Backend:**
  ```powershell
  cd "D:\Works\Hackathon 2\AfiyaAI\apps\api"
  fastapi dev main.py
  # Alternatively:
  uvicorn app.main:app --reload --port 8000
  ```
- **Start Frontend:**
  ```powershell
  cd "D:\Works\Hackathon 2\AfiyaAI\apps\web"
  npm run dev
  # Runs on http://localhost:3000
  ```

### 7.3 Running Test Suites & Verification
- **Run Backend Pytest Suite:**
  ```powershell
  python -m pytest apps/api/tests
  # Output: 158 passed
  ```
- **Build Frontend (Production Check):**
  ```powershell
  npm --prefix apps/web run build
  # Next.js 16 compiles cleanly with zero TypeScript errors
  ```

---

## 8. Key Solved Issues & Future Roadmap for Codex

### 8.1 Key Solved Issues (Reference for Codex)
1. **Gemini Quota Exhaustion Fix (`ocr_service.py`):**
   - *Previous Issue:* The OCR service had a short 12.0s timeout and a 6-model fallback chain. On cold starts, timing out triggered rapid burst API requests that depleted the Gemini Free Tier RPM/TPM quota immediately.
   - *Fix Applied:* Streamlined model candidates to `gemini-3.5-flash` (Primary, ~4s), `gemini-3.8-flash` (Secondary), and `gemini-flash-latest` (Stable). Raised timeout to `28.0s`. Implemented persistent disk caching (`apps/api/data/.prescription_ocr_cache.json`) and a `1.5s` backoff on 429 rate limits.
2. **Dosage Form Preservation (`matching_service.py`):**
   - *Previous Issue:* Scanning an injection (*"Risek Injection"*) would match a capsule record without warning.
   - *Fix Applied:* Implemented `evaluate_form_match` which flags `FORM_MISMATCH` with clear warning banners whenever the prescribed form does not match the available database form.

### 8.2 Next Roadmap Items Recommended for Codex
If the user asks Codex to expand the platform, here are the architectural next steps:
1. **Two-Tiered DRAP Brand Lexicon for 50,000+ Pakistani Medicines:**
   - Keep the verified database (102 medicines) for price comparisons, MRP auditing, and RAG facts.
   - Introduce a lightweight `brand_lexicon` table containing ~50,000 DRAP-registered brand names and forms strictly for OCR recognition. This will ensure non-database items like *Lubriderm*, *Oilum Bar*, or *Fucidin* are spelled accurately instead of being misread as *"Cubridem"*.
2. **Handwriting-Weighted Fuzzy Matching:**
   - In `pharmaceutical_corrector.py`, replace simple `fuzz.ratio` with weighted Levenshtein distance where common doctor cursive confusions (**C ↔ L**, **U ↔ V**, **rn ↔ m**, **1 ↔ l**) are penalized less.
3. **Multi-Zone Prescription Perimeter Scanning:**
   - For prescriptions with left margin notes (like `prescription1.jpeg`), prompt Gemini to first count and list all physical ink lines across the perimeter before extracting attributes.

---
*End of Codex Master Handoff Guide. Keep this file updated whenever adding new database tables, routes, or UI components.*


## Local implementation status (2026-10-10)

See [docs/LOCAL_FIXES.md](docs/LOCAL_FIXES.md) for the authoritative local fix summary and preview commands. Older claims in this handoff about 102 verified medicines, guaranteed bioequivalence, official statutory price ceilings, fixed test counts and background push notifications are historical and must not be treated as validated facts. Dataset entries require source verification; catalog membership alone is not DRAP registration verification. OCR interpretation remains unchanged, while its disk cache is now SQLite. Changes have not been deployed or applied to Neon.

Cabinet quantity selector: migration 0011 adds monthly_quantity and monthly_quantity_unit while keeping monthly_units as the normalized budget quantity. Purchase unit options come from stored medicine form and pack sizes, with an explicit save and conversion preview. See docs/LOCAL_FIXES.md.

Cabinet live prices: item pricing snapshots expose current pack price in paisa, unit count and compatible alternative pack prices. The UI previews selected-quantity reference prices and complete-pack budget on edits, then persists quantities on Save. Backend totals reuse the same snapshot. No migration beyond 0011 is needed.


## Local OCR coverage and review (2026-10-11)

See [docs/OCR_LOCAL_FIXES.md](docs/OCR_LOCAL_FIXES.md) and [specs/03-ocr.md](specs/03-ocr.md) for current behavior. These supersede historical OCR model, CLAHE, confidence boosting and permanent deterministic-cache claims above. Whole-page coverage checking, native-resolution region recovery, versioned 24-hour cache, preserved confidence, explicit image review and offline accuracy evaluation are implemented locally. Existing clinical explanation generation remains in place. Real pharmacist-labelled accuracy evaluation is still needed; nothing has been deployed.


OCR deadline handling now uses OCR_REQUEST_TIMEOUT_SECONDS=60 and OCR_TOTAL_TIMEOUT_SECONDS=150 defaults, independently from the existing chat/audio limit. SDK retries are explicitly disabled and the app controls fallback. Queue wait counts toward the total budget, not the provider processing allowance. See docs/OCR_LOCAL_FIXES.md. Local changes only; no deployment or database migration.

UI refinement (2026-10-12): midnight-slate dark theme, subtle accessible motion, and top-level DRAP portal attribution with pending-verification disclosure. See docs/LOCAL_FIXES.md. Local frontend changes only.


## Local feature QA (2026-10-12)

See [docs/FEATURE_QA.md](docs/FEATURE_QA.md) for the tested flows, fixes and remaining device/provider limits. Shared API errors/timeouts, stale price-check results, per-record category safety, cabinet partial-field reminder saves and OCR review/batch error display were corrected locally. Supplied prescription1.jpeg completed through both API and Chrome upload with eight candidates, requiring human review. No push, deployment, live Neon change or clinical explanation redesign.

## Local OCR name/form follow-up

See [docs/OCR_LOCAL_FIXES.md](docs/OCR_LOCAL_FIXES.md) and [specs/03-ocr.md](specs/03-ocr.md). Unknown forms no longer default to Tablet; Bar and topical product forms are retained, form conflicts are visible, and independent coverage readings receive no previous names. Conflicting names can trigger detail crops even on count-complete scans. Corroborated readings still require human review and retain the first reading visibly. Cache version is now independent-form-review-v3. These are local changes only; no deployment or live database migration.

## Local OCR quality-model integration (latest)

OCR now uses the supported google-genai SDK with independent GEMINI_OCR_MODEL / GEMINI_OCR_FALLBACK_MODELS / OCR_THINKING_LEVEL settings, high media resolution and original transcription preservation. Defaults target Argon, Pro, then an explicitly warned Flash 3.8 fallback. Cache version is quality-model-original-reading-v4. Chat settings are separate. The supplied key returned zero free-tier quota for Argon and Pro; stronger-model accuracy is NOT validated. See docs/OCR_LOCAL_FIXES.md for access requirements, bounded comparison commands and verification limitations. No billing change, push, deployment or live DB mutation.

Prescription UI: uploader and OCR review now offer Remove image and a visible image scan overlay/status during scans and rescans. Browser cancellation plus scan serial guards prevent removed results from reappearing. Three-language controls and reduced-motion support are included. See docs/LOCAL_FIXES.md and scripts/test-prescription-upload.mjs for verification. Local frontend changes only.

## Local OCR reliability follow-up (2026-10-16, latest)

See the latest section in [docs/OCR_LOCAL_FIXES.md](docs/OCR_LOCAL_FIXES.md) and [specs/03-ocr.md](specs/03-ocr.md). Added bounded transient retries for single-model configurations, safe HTTP error classification, per-attempt coroutine deadlines, additional medication-product forms, concentration/percentage name cleanup, one-to-one audit/region merging and bounded cancellable OCR token lookup. Cache version is medication-products-retry-v5. Clinical explanation behavior, model environment settings, billing and deployments remain unchanged.

Fresh live pipeline checks were blocked by Flash 3.8 high-demand 503 responses; a temporary Flash 3.6 fallback check also failed with 503, while Flash 3.8 returned 429 in that run. No successful new transcription or measured handwriting accuracy improvement was established. Do not describe these changes as perfect OCR or launch certification. Frontend production build and TypeScript pass; provider availability/quota and pharmacist-labelled accuracy evaluation remain external requirements. No push or live database migration.

## Interactive OCR latency (latest)

See the latest section in [docs/OCR_LOCAL_FIXES.md](docs/OCR_LOCAL_FIXES.md) and [specs/03-ocr.md](specs/03-ocr.md). Auto/fast provider budgets are now 65 seconds overall, 40 per initial call, 15 per review call and 12 per transient retry. Do not retry a timed-out model within the same scan. Clear auto scans may return one unverified reading with explicit human-review/coverage warnings; uncertain/empty readings still receive checks, and OCR_AUTO_VERIFY_CLEAR=true restores always-audit behavior. Thorough rescans retain their longer limits. A five-minute memory-only review-result cache, concurrent-upload deduplication and immediate name display before bounded catalog matching reduce repeat latency and calls. Cache version interactive-budget-v6 supersedes v5. Model order, key, thinking, clinical-summary behavior and deployments are unchanged.

The new main-pipeline live check still timed out (53.59 seconds before the final no-timeout-retry change). Flash-Lite responded in 9.98 seconds but misread known names and was not enabled; Flash 3.6 returned 503. Do not claim a successful live speed/accuracy benchmark. Controlled tests cover latency bounds, cancellation/re-upload races, review-preserving cache reuse and immediate name display. Production Webpack build and TypeScript pass. All work remains local.

Latency follow-up verification: 321 full backend tests passed; all 11 focused latency/race tests passed including the final immediate re-upload guard. Frontend API/upload/review/cabinet scripts, TypeScript and production Webpack build passed. Existing SDK/ORM and middleware deprecation warnings remain. No application servers were left running.

Latest provider diagnosis: scripts/diagnose_ocr_provider.py confirms Flash 3.8 metadata access and a correct tiny text response (2.77 seconds), while a simple prescription-image reading timed out at 30 seconds. A separate generated TEST 123 image, with no medical prompt/patient image, received 503 in 1.09 seconds. Image failures are therefore not confined to the long clinical prompt; no global outage is established. See docs/OCR_LOCAL_FIXES.md. Production code/model/key/billing were unchanged for this diagnostic follow-up. Selecting another provider requires the user's free/paid testing constraint and measured accuracy/latency, not another blind timeout increase.

User constraint now confirmed: free Gemini only for now; do not re-ask budget or enable billing. Flash 3.1 Lite answered in 10.14 seconds with some uncertain names; a temporary full fallback pipeline returned duplicate/conflicting candidates in 54.59 seconds, so it was NOT enabled in the saved configuration. Fixed the observed 15-second wasted primary-model audit re-probe after a fallback succeeds. This only changes within-scan routing after observed unavailability/network failures; original model/key/billing and review gates remain unchanged. See docs/OCR_LOCAL_FIXES.md for evidence and limits. Model metadata listing is available via diagnose_ocr_provider.py --list-models and does not establish free quota.
