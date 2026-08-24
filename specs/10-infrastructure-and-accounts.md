# 10 Infrastructure & Accounts Specification — Free-First Deployment

> **Purpose of this file:** Define the accounts/services, the free-tier strategy, the provisioning order, and the **database safety / backup / rollback** procedure so Afiya AI can be built and run at **~$0/month** for the MVP, with a clear paid upgrade path. Follows the structure of specs 00–09 and adds notes so a CLI coding agent (e.g., Claude Code) can scaffold the configuration and deployment files.
>
> **Read alongside:** 01-architecture (provider abstraction), 02-database, 08-safety, 09-priority-features (§16 references the rollback process here).
>
> **Note:** Specific free-tier limits and prices change frequently — the free-vs-paid *model* below is stable, but verify current limits on each provider's pricing page before relying on them.

---

## 1. Goal
Run the MVP on free tiers and open-source components at ~$0/month, keep the tool free for end users, and document exactly where costs appear and how to avoid or subsidize them. Phase-1 features (spec 09) must run with **zero paid AI dependency**. Every schema change must be **safely reversible** (§15).

## 2. Scope
- Accounts for: source control, frontend hosting, backend hosting, database, and (optional) LLM/OCR/embeddings.
- Free-tier limits to watch and the recommended provisioning order.
- Environment/secrets layout and provider abstraction the coding agent should scaffold.
- **Database safety: backups, snapshots, and rollback (§15).**

## 3. Out of Scope
- Production-grade autoscaling (per 01).
- Manual account signup — the coding agent scaffolds *config*, not credentials; a human creates accounts and supplies keys.
- Long-term monetization design (covered separately; see sustainability note in §13).

## 4. Inputs
- Developer accounts (created manually by the human).
- API keys / connection strings supplied via environment variables or platform secret stores.

## 5. Outputs
- A deployable frontend + backend + database, secrets managed via env.
- A documented "free stack", a cost-watch list, and a repeatable DB backup/rollback procedure.

## 6. Functional Requirements
- All secrets via environment variables / platform secret stores — never committed to the repo and never exposed to the frontend (01/08).
- Provider specifics abstracted where feasible (01), so DB / LLM / OCR / embeddings can be swapped by config, not code changes.
- Phase-1 runs without any paid LLM or OCR dependency (templated multilingual responses; manual text entry as OCR fallback).
- A snapshot/restore point must exist before any schema change or destructive operation (§15).

## 7. Technical Design

### 7.1 Recommended Free Stack
- **Source control:** GitHub — free.
- **Frontend (Next.js):** Vercel *Hobby* — free (non-commercial terms). Alternatives: Netlify, Cloudflare Pages.
- **Backend (FastAPI):** Render free web service — free, spins down on inactivity (cold starts). Alternatives: Fly.io, Railway (trial/usage-based).
- **Database (Postgres + pgvector): Neon — chosen.** Confirmed setup (2026-08): **Free plan**, project **"Hackathon"**, database **`neondb`**, primary branch named **`production`** (not "main"). Serverless, autoscale-to-zero, and — importantly — supports **copy-on-write branching + branch restore** ("Backup & Restore"), which is the backbone of the rollback process in §15. Alternative: Supabase (also free tier, pgvector; free projects pause on inactivity).
- **LLM (optional — chat/phrasing only):** Google Gemini via AI Studio (free tier: text + vision + embeddings) or Groq (fast, free, open models). Alternatives: OpenRouter. Avoid OpenAI/Anthropic *direct* if cost is the priority (pay-per-token, no lasting free tier).
- **OCR (optional):** Tesseract (open-source, self-host; weak on handwriting) or Gemini vision (free tier). Alternative: Google Cloud Vision (monthly free units, then paid).
- **Embeddings (optional — RAG only, spec 05):** open-source sentence-transformers (self-host, free) or Gemini embeddings (free tier).
- **DRAP data:** public — no account, free.
- **Domain:** `*.vercel.app` subdomain free; custom domain ~$10–15/yr (optional).

### 7.2 Cost Model & Free-Tier Limits to Watch
- **Vercel Hobby** is non-commercial; budget for Pro if Afiya becomes a real commercial service.
- **Render free** spins down on inactivity → cold-start latency on first request.
- **Neon free** has storage caps and **short point-in-time history retention** — which is exactly why §15 uses a *durable named snapshot branch* rather than relying on point-in-time history. Compute autoscales to zero, so an idle backup branch costs almost nothing.
- **Gemini/Groq free** are rate-limited (requests/min, tokens/day).
- **Google Vision OCR** gives a monthly free allotment, then charges per unit.
- Scale is what breaks "free": as usage grows, LLM/OCR calls and hosting begin to cost money.

### 7.3 Environment / Secrets (agent scaffolds)
- Provide a `.env.example` with: `DATABASE_URL`, `LLM_PROVIDER`, `LLM_API_KEY`, `OCR_PROVIDER`, `OCR_API_KEY`, `EMBEDDINGS_PROVIDER`, `FRONTEND_API_BASE_URL`.
- Real secrets live in platform stores (Vercel/Render env), never in the repo or client bundle.
- `DATABASE_URL` points at the Neon `production` branch; a dev branch (if used, §15.5) has its own connection string.

### 7.4 Provider Abstraction (ties to 01)
- Define thin interfaces — `LLMClient`, `OCRClient`, `EmbeddingsClient`, and a single DB accessor — so swapping Gemini↔Groq, Tesseract↔Vision, or Neon↔Supabase is a config change, not a rewrite.

## 8. Workflow (Provisioning Order)
1. Create the **GitHub** repo.
2. Provision **Neon** → obtain `DATABASE_URL` for the `production` branch; enable the `pgvector` extension.
3. Deploy **backend on Render** → set env (`DATABASE_URL`, keys).
4. Deploy **frontend on Vercel** → set `FRONTEND_API_BASE_URL` to the backend.
5. (Optional) Add **LLM/OCR** keys when building chat/OCR features.
6. (Optional) Attach a custom **domain**.
7. **Before any schema change:** create a Neon snapshot branch as a restore point (§15.1).

## 9. Error/Edge Cases
- Free backend cold start → first request slow (acceptable for MVP; add a health-check ping if needed).
- Paused DB (Supabase) → wake on connect, or prefer Neon autoscale.
- Free LLM rate-limit hit → degrade gracefully to templated responses (Phase-1 needs no LLM anyway).
- Bad migration or unwanted feature → roll back via §15 (snapshot restore or surgical drop).

## 10. Security/Safety Considerations
- No credentials in the frontend or repo (01/02/08).
- Parameterized DB access; least-privilege DB user (02/08).
- Rotate keys; use platform secret stores.
- Never log PII from prescriptions/receipts (00/08).
- **Never run a destructive statement (`DROP`/`DELETE`/`TRUNCATE`) or a schema migration without a fresh snapshot** (§15).

## 11. Acceptance Criteria
- App deploys on free tiers; Phase-1 works with zero paid AI dependency.
- Swapping a provider requires only env/config changes (01).
- No secret appears in the repo or the client bundle.
- A documented, tested rollback path exists: the DB can be returned to its pre-change state (§15).

## 12. Testing Requirements
- Config loads from env; a missing required secret fails fast with a clear error.
- Smoke test: each deployed layer (frontend ↔ backend ↔ DB) communicates (per 01).
- Rollback drill: after a snapshot + a test migration, restoring the snapshot (or the surgical drop) returns the DB to its prior state and the app still boots (§15).

## 13. Open Questions
- Best region/provider for Pakistan latency **and** free-tier availability?
- Long-term sustainability: self-host the AI parts vs subsidize a free consumer tool with marketplace/affiliate revenue (from future Phase-2)?

## 14. Notes for a CLI Coding Agent
- Scaffold **config only** — do not attempt to create accounts or invent secrets; read them from `.env` / platform stores.
- Build the provider-abstraction interfaces (§7.4) **first**, so Phase-1 can ship with templated responses (no LLM) and optional OCR.
- Keep everything swappable per spec 01; commit a `.env.example` but never a real `.env`.
- **Do not run migrations until the §15.1 safety checkpoint is in place** (Neon snapshot branch off `production` + code committed). Every migration must be additive and reversible (working Alembic `downgrade`).

---

## 15. Database Safety, Backups & Rollback (Neon)

> **Confirmed setup (2026-08):** Neon, Free plan, project "Hackathon", database `neondb`, primary branch **`production`**. Neon's **copy-on-write branching** and **branch restore** ("Backup & Restore" in the console) are the backbone of this process. On the Free plan, point-in-time history retention is short, so a **durable named snapshot branch** is preferred over relying on point-in-time history.

The whole lifecycle is three phases — **protect → build → roll back** — with one principle throughout: keep the **database** (Neon) and the **code** (git/folder copy) in sync. Protect both; roll back both. A code checkpoint alone does **not** undo a database change, and a DB restore alone does not undo code changes.

### 15.1 Phase 0 — Before changing schema (create the safety net)
- **Database (snapshot branch):** in the Neon console, click **Branches → Create branch**, set the parent to **`production`** at its current state, and name it clearly (e.g. `afiya-before-phase1`). This instantly captures schema **and** data as they are now. Leave it **frozen** — don't connect the app to it or write to it. An idle branch is nearly free (compute auto-suspends; storage is copy-on-write), and the Free plan allows up to 10 branches.
  - CLI equivalent (verify current syntax): `neonctl branches create --name afiya-before-phase1`.
- **Code:** commit and tag in git (or keep a labeled folder copy) so code and DB can be rolled back to the same moment.

### 15.2 Phase 1 — Apply changes safely
- Make all schema changes through **versioned, reversible Alembic migrations** (each `upgrade` has a working `downgrade`). Migration files live in the repo, so the code checkpoint captures them.
- Keep changes **additive**: add new tables/rows only; never alter or delete existing tables or data. (Phase-1 adds only `mrp_reference` and `drug_alerts` — see 09 §16.)
- **Golden rule:** take a fresh snapshot branch before any destructive statement (`DROP` / `DELETE` / `TRUNCATE`).

### 15.3 Phase 2 — Decision point
- **Keep the changes** → optionally delete the snapshot branch later to tidy up, or just leave it (it's cheap).
- **Reject the changes** → roll back (§15.4).

### 15.4 Phase 3 — Roll back (choose one)
- **Option A — full rewind (cleanest "back to before"):** In Neon, open **Backup & Restore** (or **Branches → production → Restore**) and restore **`production`** using your snapshot branch (`afiya-before-phase1`) as the source. Neon automatically keeps a backup of the pre-restore state, so even the rollback is reversible. Then restore the matching **code** checkpoint and **restart the backend**. The connection string is unchanged, and schema + data + migration state all rewind together.
  - Caveat: a full restore rewinds **all** of `production` to the snapshot moment — anything written after the snapshot is not kept. For a pre-feature MVP that's usually nothing precious; if you have post-snapshot data to keep, use Option B.
- **Option B — surgical (keep post-snapshot data):** in the **SQL Editor** on `production`, drop only what the change added. For Phase-1:

```sql
DROP TABLE IF EXISTS mrp_reference, drug_alerts CASCADE;
DELETE FROM sources WHERE name IN ('DRAP Price Notification', 'DRAP Alert');  -- only rows added for these features; verify names first
```

  Then run `alembic downgrade` on the code side so migration history matches the database.

**Verify (either option):**

```sql
SELECT to_regclass('public.mrp_reference'), to_regclass('public.drug_alerts');  -- both NULL when removed
```

Then boot the backend and confirm the app runs.

### 15.5 Optional — gold-standard isolation (build on a branch)
To keep `production` **completely untouched** while experimenting: create a `phase1-dev` branch, point a **local** copy of the app at that branch's connection string (`DATABASE_URL`), build and test there, and only apply the same migrations to `production` once you and the team approve. If the work is rejected, simply delete the dev branch — `production` never saw the change. This is more setup than the §15.1 snapshot approach, but it's the safest pattern Neon offers.

### 15.6 What each backup does / doesn't cover
- A **Neon branch restore** reverts schema + data + migration state together — no connection-string change needed.
- A **code checkpoint** (git/folder copy) reverts code + migration files but **not** the database.
- Therefore: always pair the two, and when rolling back, restore both to the same point.

### 15.7 Quick reference
- Snapshot before change: **Branches → Create branch → parent `production` → name it**.
- Undo everything: **Backup & Restore → restore `production` from the snapshot branch** (+ restore code, restart backend).
- Undo just Phase-1 tables: **SQL Editor → `DROP TABLE IF EXISTS mrp_reference, drug_alerts CASCADE;`** (+ `alembic downgrade`).
- Verify: **`SELECT to_regclass('public.mrp_reference'), to_regclass('public.drug_alerts');`** → both `NULL`.
