# Afiya AI — Complete End-to-End Deployment & Live Database Guide

This document is an exhaustive, step-by-step guide to taking **Afiya AI** from local development to production. It covers pushing code to GitHub, configuring and populating the live **Neon PostgreSQL** database with `pgvector`, deploying the **FastAPI backend on Render**, deploying the **Next.js frontend on Vercel**, frontend/backend connection architecture, verifying all production endpoints, and implementing future product roadmap features.

---

## Table of Contents
1. [Prerequisites & Account Setup](#1-prerequisites--account-setup)
2. [Current Repository & Architecture Summary](#2-current-repository--architecture-summary)
3. [Section 1: Frontend & Backend Connection Architecture](#section-1-frontend--backend-connection-architecture)
4. [Section 2: Pushing Code & Tags to GitHub](#section-2-pushing-code--tags-to-github)
5. [Section 3: Setting Up & Making Neon Database Live](#section-3-setting-up--making-neon-database-live)
6. [Section 4: Deploying the FastAPI Backend on Render](#section-4-deploying-the-fastapi-backend-on-render)
7. [Section 5: Deploying the Next.js Frontend on Vercel](#section-5-deploying-the-nextjs-frontend-on-vercel)
8. [Section 6: End-to-End Production Verification Checklist](#section-6-end-to-end-production-verification-checklist)
9. [Section 7: Troubleshooting & Common Deployment Pitfalls](#section-7-troubleshooting--common-deployment-pitfalls)
10. [Section 8: Future Product Roadmap & Next Features](#section-8-future-product-roadmap--next-features)

---

## 1. Prerequisites & Account Setup

Before starting, ensure you have active accounts on the following free-tier / developer cloud services:
* **GitHub Account**: Hosting the repository `1089taha/AfiyaAI`.
* **Neon Account**: Hosting PostgreSQL + `pgvector` extension ([neon.tech](https://neon.tech)).
* **Render Account**: Hosting the Python FastAPI backend ([render.com](https://render.com)).
* **Vercel Account**: Hosting the Next.js App Router frontend ([vercel.com](https://vercel.com)).
* **Google AI Studio Account**: API Key for Gemini (`gemini-3.6-flash` and `text-embedding-004`) ([aistudio.google.com](https://aistudio.google.com)).

---

## 2. Current Repository & Architecture Summary

* **Frontend**: Next.js (App Router, TypeScript) located in `apps/web`.
* **Backend**: FastAPI (Python) located in `apps/api`.
* **Local Database**: SQLite (`afiya_test.db`).
* **Production Database**: Neon PostgreSQL with `pgvector` enabled.
* **Migrations**: Managed via Alembic (Revisions `0001` through `0006`).

### Completed & Verified Features:
* **Stage 1**: Medicines database (40 DRAP-matched items), generic + strength grouping, unit price calculations ("Save X%").
* **Feature A (MRP Checker)**: Additive migration `0002` (`mrp_reference`), pure DB price comparison (`OVERCHARGED`, `OK_AT_MRP`, `BELOW_MRP`), 0 LLM dependency.
* **Feature B (Authenticity Alert Checker)**: Additive migration `0003` (`drap_alerts`), batch & name-only recall alerts.
* **pgvector RAG Chat**: Migration `0004` (vector column 768-dim), RAG grounding over verified DB facts.
* **Emergency Safety Gate**: Fast keyword filtering in English & Roman-Urdu for cardiac, respiratory, and overdose emergencies (`safety_service.py`).
* **Authentication**: Migration `0005` (`users`), JWT tokens + password hashing via `bcrypt`.
* **Admin Portal**: Migration `0006` (`is_admin`), RBAC access for `/api/admin/users` and `/admin` UI page.

---

## Section 1: Frontend & Backend Connection Architecture

Your frontend (`apps/web`) and backend (`apps/api`) are **100% connected in code** out-of-the-box.

### How the Connection Works:

1. **Typed API Client**:
   All frontend requests are handled by `apps/web/src/lib/api.ts`. It manages request headers, attaches JWT Bearer tokens for authenticated endpoints, and automatically handles 401 token expiration errors.

2. **API Base URL Resolution**:
   In `apps/web/src/lib/constants.ts`:
   ```typescript
   export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
   ```
   - **Local Mode**: When `NEXT_PUBLIC_API_URL` is omitted, the frontend automatically communicates with `http://localhost:8000`.
   - **Production Mode**: Setting `NEXT_PUBLIC_API_URL=https://afiya-api.onrender.com` on Vercel routes all frontend requests to Render.

### Frontend to Backend Connection Diagram:

```
┌──────────────────────────────┐                ┌──────────────────────────────┐
│       Vercel Frontend        │  HTTP Fetch   │        Render Backend        │
│  (https://afiya-ai.vercel.app)├───────────────►(https://afiya-api.onrender.com)│
└──────────────┬───────────────┘                └──────────────┬───────────────┘
               │                                               │
   Set NEXT_PUBLIC_API_URL                            Set FRONTEND_URL
  = https://afiya-api.onrender.com                   = https://afiya-ai.vercel.app
                                                      (Enables FastAPI CORS)
```

### Complete Endpoint Connection Map:

| Feature / UI Component | Frontend Function (`api.ts`) | Backend Endpoint | Access Level |
| :--- | :--- | :--- | :--- |
| **Medicine Search** | `matchMedicine()` | `POST /api/medicines/match` | Public |
| **Cheapest Brand Prices** | `getPrices()` | `GET /api/medicines/{id}/prices` | Authenticated |
| **MRP Overcharge Checker** | `checkPrice()` | `POST /api/v1/price-check` | Authenticated |
| **Recall Alert Checker** | `checkAlerts()` | `POST /api/v1/alert-check` | Authenticated |
| **Prescription OCR Upload** | `extractFromImage()` | `POST /api/ocr/extract` | Public |
| **RAG Chat Assistant** | `sendMessage()` | `POST /api/chat` | Public |
| **User Sign-up & Sign-in** | `registerUser()`, `loginUser()` | `POST /api/auth/register`, `/login` | Public |
| **Admin User Directory** | `fetchAdminUsers()` | `GET /api/admin/users` | Admin Only |

---

## Section 2: Pushing Code & Tags to GitHub

### Step 2.1: Verify Ignored Environment Files
To prevent accidental secret leaks, verify that `.env` files are ignored by git:

Open PowerShell in `D:\Works\Hackathon 2\AfiyaAI` and run:
```powershell
git check-ignore -v .env apps/api/.env apps/web/.env.local
```

**Expected Output:**
```text
.gitignore:2:.env	.env
.gitignore:2:.env	apps/api/.env
apps/web/.gitignore:34:.env*	apps/web/.env.local
```

### Step 2.2: Check Workspace Status
Check for untracked files or uncommitted changes:
```powershell
git status
```
*Note: Unused temporary scratch files like `auth_review_diff.txt` can either be removed or left untracked. They will not be pushed.*

### Step 2.3: Push Local Commits to GitHub
Your local `main` branch contains all commits for Features A & B, RAG Chat, Auth, Emergency Safety, and Admin RBAC. Push to remote:
```powershell
git push origin main
```

### Step 2.4: Push All Release Tags
Push all release milestone tags (e.g. `after-auth`, `after-admin-users-view`, `after-emergency-fix`):
```powershell
git push origin --tags
```

---

## Section 3: Setting Up & Making Neon Database Live

Neon PostgreSQL acts as the single source of truth for production data and vector embeddings.

### Step 3.1: Obtain Connection String from Neon
1. Log into your [Neon Dashboard](https://console.neon.tech).
2. Select your project **AfiyaAI** (or create a new project named `AfiyaAI`).
3. Click **Connection Details** on the project dashboard.
4. Copy the connection string. It will look like:
   ```text
   postgres://alex_owner:npg_1234abcd@ep-cool-flower-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

### Step 3.2: Convert Protocol for SQLAlchemy (`asyncpg`)
FastAPI uses `asyncpg` to connect asynchronously to PostgreSQL. You **must** change the prefix from `postgres://` or `postgresql://` to `postgresql+asyncpg://`.

**Formatted Neon String:**
```text
postgresql+asyncpg://alex_owner:npg_1234abcd@ep-cool-flower-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### Step 3.3: Update Backend `.env` File
Open `apps/api/.env` locally and set the `DATABASE_URL`:
```env
DATABASE_URL=postgresql+asyncpg://alex_owner:npg_1234abcd@ep-cool-flower-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars
ADMIN_EMAILS=your_email@example.com
```

### Step 3.4: Execute Alembic Database Migrations
Run Alembic from the `apps/api` folder to create all tables and indexes on Neon:

```powershell
# Navigate to the backend directory
cd "D:\Works\Hackathon 2\AfiyaAI\apps\api"

# Execute all migration scripts up to HEAD (Revisions 0001 -> 0006)
alembic upgrade head
```

**What this creates on Neon:**
* `0001_add_drap_reg_no`: Creates `medicines` and `sources` tables with unique index `uq_medicines_drap_reg_no`.
* `0002_add_mrp_reference`: Creates `mrp_reference` table for official price lookups.
* `0003_add_drap_alerts`: Creates `drap_alerts` table for recall alerts.
* `0004_add_embeddings_vector`: Executes `CREATE EXTENSION IF NOT EXISTS vector` and adds `embedding vector(768)` to `embeddings` table.
* `0005_add_users`: Creates `users` table for email/password authentication.
* `0006_add_is_admin`: Adds `is_admin` Boolean column to `users` for RBAC.

### Step 3.5: Seed Base Medicines, Prices, Alerts & Knowledge
Run the FastAPI backend once locally connected to Neon to run automatic startup seeders:

```powershell
# From apps/api directory:
fastapi dev app/main.py
```

**Verify Console Logs:**
```text
INFO: Seeded 40 medicines successfully
INFO: Seeded 40 MRP reference entries
INFO: Seeded 4 demo alert records
INFO: Seeded 40 knowledge chunks
```
*(Press `Ctrl+C` to stop the server once seeding logs complete).*

### Step 3.6: Seed `pgvector` Embeddings
Populate the 768-dimensional Gemini vector embeddings in Neon for RAG search:

```powershell
# From apps/api directory:
python -m app.db.seed_embeddings
```

**Expected Output:**
```text
[seed_embeddings] Database engine: postgresql
[seed_embeddings] Embedding column verified on 'embeddings' table.
[seed_embeddings] Generating & storing vector embeddings for 40 knowledge chunks...
[seed_embeddings] Successfully stored 40 vector embeddings in Neon pgvector.
```

---

## Section 4: Deploying the FastAPI Backend on Render

Render hosts the Python FastAPI application and handles production HTTP requests.

### Step 4.1: Create Render Web Service
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect your repository `1089taha/AfiyaAI`.

### Step 4.2: Configure Web Service Settings
Fill in the deployment configuration fields:

| Field | Value |
| :--- | :--- |
| **Name** | `afiya-api` |
| **Region** | Singapore / Frankfurt / Oregon (Choose closest to users) |
| **Branch** | `main` |
| **Root Directory** | `apps/api` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt && alembic upgrade head` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

### Step 4.3: Set Render Environment Variables
Under the **Environment** section, click **Add Environment Variable** and enter:

```env
DATABASE_URL=postgresql+asyncpg://alex_owner:npg_1234abcd@ep-cool-flower-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
GEMINI_API_KEY=AIzaSyYourProductionGeminiKeyHere
JWT_SECRET=a_very_long_secure_random_string_for_production_jwt_signing_32chars
ADMIN_EMAILS=your_email@example.com,admin@afiya.ai
FRONTEND_URL=https://afiya-ai.vercel.app
```

### Step 4.4: Deploy Service & Note Public URL
1. Click **Create Web Service**.
2. Render will build the environment, run Alembic migrations against Neon, and start Uvicorn.
3. Copy your assigned Render URL (e.g. `https://afiya-api.onrender.com`).

---

## Section 5: Deploying the Next.js Frontend on Vercel

Vercel hosts the Next.js App Router frontend.

### Step 5.1: Import Repository to Vercel
1. Log into [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository `1089taha/AfiyaAI`.

### Step 5.2: Configure Project Framework & Root Directory
1. **Framework Preset**: Next.js (Auto-detected).
2. **Root Directory**: Click *Edit* and select `apps/web`.

### Step 5.3: Add Environment Variable
Expand **Environment Variables** and add:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://afiya-api.onrender.com` *(Replace with your exact Render backend URL)* |

### Step 5.4: Deploy
1. Click **Deploy**.
2. Vercel will compile the TypeScript code and generate static & server-rendered pages.
3. Copy your public production domain (e.g. `https://afiya-ai.vercel.app`).

### Step 5.5: Update Backend CORS Settings
Go back to your **Render Dashboard** for `afiya-api` → **Environment** → Update `FRONTEND_URL` to match your exact Vercel URL (`https://afiya-ai.vercel.app`), then click **Save Changes**.

---

## Section 6: End-to-End Production Verification Checklist

Run these quick checks against your deployed site:

### 1. Backend Health Check
Open `https://afiya-api.onrender.com/health` in your browser.
- **Expected Result**: `{"status": "ok", "database": "connected"}`

### 2. Search & MRP Price Checker
1. Go to `https://afiya-ai.vercel.app`.
2. Search for **"Losec 20mg"**.
3. Verify that cheapest brand alternative (**Risek**) displays with correct percentage savings ("Save 59.99%").
4. Click **MRP Price Checker**, enter paid price `40.00`, and submit.
5. Verify response flags `OVERCHARGED` against DRAP MRP (Rs 32.14 per unit).

### 3. Authenticity Alert Checker
1. Open **Alert Checker** tab.
2. Search for batch `DEMO-BATCH-001`.
3. Verify response flags `ALERT_FOUND` with recall reason and safety disclaimer.

### 4. Admin Portal Access
1. Sign up a new user with the email configured in `ADMIN_EMAILS`.
2. Navigate to `https://afiya-ai.vercel.app/admin`.
3. Verify the user management table loads correctly without exposing `password_hash`.

### 5. RAG Chat Knowledge Search
1. Open Chat panel.
2. Ask: *"What is Panadol used for?"*
3. Verify that the answer retrieves grounded facts from Neon `pgvector` with legal disclaimers.

---

## Section 7: Troubleshooting & Common Deployment Pitfalls

### Pitfall 1: `asyncpg` Protocol Error
* **Symptom**: SQLAlchemy error `invalid DSN: scheme 'postgres' not recognized`.
* **Fix**: Ensure `DATABASE_URL` starts with `postgresql+asyncpg://`, not `postgres://`.

### Pitfall 2: CORS Blocked Requests
* **Symptom**: Browser console shows `Access-Control-Allow-Origin` error.
* **Fix**: Ensure `FRONTEND_URL` on Render matches your exact Vercel URL (including `https://`, without trailing `/`).

### Pitfall 3: Gemini 429 Rate Limit (`ResourceExhausted`)
* **Symptom**: Chat or OCR displays fallback response `encountered an error`.
* **Fix**: The Gemini free tier limit is 20 req/day per Google Cloud project. Enable billing on your Google AI Studio project to unlock standard throughput. (Note: Consumer *Gemini Advanced/Plus* subscriptions do **not** increase API key quotas).

### Pitfall 4: Short JWT Secret Warning
* **Symptom**: Backend logs show `InsecureKeyLengthWarning`.
* **Fix**: Set `JWT_SECRET` in Render environment to a random string of at least 32 characters.

---

## Section 8: Future Product Roadmap & Next Features

After deployment, expand Afiya AI with these high-value features:

```
┌───────────────────────────────────────────────────────────┐
│ Feature 1: Therapeutic Duplication Alert ("Overdose Shield")│
│ • Detects duplicate active ingredients (e.g. Losec + Risek)│
│ • 0 Gemini API cost, 100% rule-based DB matching          │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ Feature 2: DRAP Price Gouging Overcharge Reporter         │
│ • Migration 0007: overcharge_reports table                │
│ • User overcharge reporting -> Admin Audit Dashboard      │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ Feature 3: My Digital Medicine Cabinet                    │
│ • Save active medications to user profile                 │
│ • Auto-check cabinet against new DRAP recall alerts       │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│ Feature 4: Handwritten Prescription Structurer            │
│ • Multi-drug vision extraction into structured JSON       │
│ • Automatic batch price & alert checking                  │
└───────────────────────────────────────────────────────────┘
```

### Feature Details:

1. **Therapeutic Duplication Alert ("Overdose Shield")**:
   - Compares active ingredients (`generic_name`) across a user's medication list to prevent accidental double-dosing.
   - Deterministic Python/SQL logic with strict medical warnings.

2. **DRAP Price Gouging Reporter**:
   - When MRP checker detects `OVERCHARGED`, provides a reporting form (Pharmacy name, city, receipt note).
   - Saves to `overcharge_reports` (Migration `0007`) and displays crowded market violations in `/admin`.

3. **My Digital Medicine Cabinet**:
   - Persistent per-user saved drug list linking users with automatic recall push notifications.

4. **Handwritten Prescription Structurer**:
   - Enhances prescription OCR to output structured drug schedules (`Name`, `Strength`, `Form`, `Frequency`, `Duration`) for one-click compliance checks.
