# 09 Priority Features Specification — MRP/Overcharge Checker & Authenticity/Recall Checker

> **Purpose of this file:** A build-ready specification for the two highest-priority, partnership-free features recommended for Afiya AI ("Phase 1"). It follows the same structure as specs 00–08 and adds implementation sections (tech stack, data model, API contract, file structure, an ordered build plan, and a rollback/DB-safety procedure) so it can be handed directly to a CLI coding agent (e.g., Claude Code) to implement.
>
> **Read alongside:** 00-product, 01-architecture, 02-database, 03-ocr, 04-medicine-matching, 07-chat, 08-safety, and **10-infrastructure-and-accounts (§15 for the full Neon backup/rollback process)**. This spec extends them; it does not replace their rules.

---

## 1. Goal
Ship two trust-building consumer features that reuse the existing OCR (03) and medicine-matching (04) pipelines and **DRAP public data only** — no pharmacy partnerships or external price feeds required:

- **Feature A — MRP / Overcharge Checker:** tell a user whether the price they paid (or were quoted) for a medicine is at, below, or **above** the DRAP-notified Maximum Retail Price (MRP), and by how much.
- **Feature B — Authenticity & Recall/Alert Checker:** tell a user whether a medicine (and, if provided, a specific batch) appears in any active DRAP recall / spurious / substandard / quality alert.

Both features must preserve the safety posture of spec 08: **prices and statuses come only from stored, provenance-tagged data — the LLM never generates them.**

## 2. Scope
- Store DRAP-notified MRP per medicine + pack size, versioned by effective date, for the 40 MVP medicines.
- Compare a user-supplied price against the latest MRP and compute overcharge/discount.
- Store DRAP alerts and look them up by medicine and/or batch number.
- A **shared, scheduled DRAP ingestion pipeline** that feeds both features.
- Localized output (English / Urdu / Roman Urdu) reusing the chat layer (07).

## 3. Out of Scope
- Real-time live scraping of prices (consistent with 06); ingestion is scheduled batch, not per-request.
- Buy-links, seller integration, and inventory/stock (future Phase 2).
- **Any guarantee of batch-level authenticity.** Feature B only matches against *published* DRAP alerts; absence of an alert is not proof of genuineness.
- Diagnosis, prescribing, or symptom→medication (strictly prohibited per 08).

## 4. Inputs
- **Feature A:** a medicine reference (free-text query or `medicine_id`), `pack_size`, `price_paid`, optional currency; optionally a receipt/pack image routed through OCR (03).
- **Feature B:** a medicine reference, optional `batch_no`.
- **Ingestion:** DRAP source documents — price notifications / SROs (for MRP) and recall/alert notices.

## 5. Outputs
- **Feature A:** `status` ∈ {`OVERCHARGED`, `OK_AT_MRP`, `BELOW_MRP`, `NO_DATA`}, plus MRP value, overcharge/discount amount, SRO reference, effective date, and source. 
- **Feature B:** `status` ∈ {`ALERT_FOUND`, `NO_ALERT`}, plus a list of matching alerts (type, description, source, issue date).
- All outputs carry **provenance + a freshness/effective date** and a localized, safety-checked explanation.

## 6. Functional Requirements
- Persist DRAP-notified MRP per (`medicine_id`, `pack_size`) with `sro_ref` and `effective_date`; never overwrite — insert a new versioned row.
- Compute `price_paid − latest_mrp` and classify the result. Math must be exact and performed in code (not the LLM).
- Persist DRAP alerts; retrieve only **active (unresolved)** alerts, matched by `medicine_id`, `batch_no`, or a guarded name match.
- Resolve free-text/OCR input to a `medicine_id` by **reusing the matching pipeline in spec 04** (high threshold; fall back to user confirmation on low confidence).
- Return responses localized per spec 07; the LLM composes prose around DB values but never invents numbers or statuses.
- **All schema changes ship as additive, reversible Alembic migrations** (new tables only; a working `downgrade`). Never alter or drop existing tables/data as part of Phase 1 (see §16).

## 7. Technical Design

### 7.1 Tech Stack (aligned with 00/01)
- **Frontend:** Next.js (React); internationalization for EN/UR/Roman Urdu (e.g., `next-intl` or an in-repo string catalog).
- **Backend:** FastAPI (Python) with Pydantic models for request/response validation.
- **Database:** PostgreSQL + pgvector (per 02), hosted on **Neon** (see 10). Access via SQLAlchemy (models) + Alembic (migrations); **parameterized queries only** (02/10). Migrations must be **additive and reversible** — provide a real `downgrade` for every `upgrade` so Phase 1 can be undone cleanly (§16).
- **Ingestion:** Python — `pdfplumber` / `camelot-py` for PDF tables, `openpyxl` / `pandas` for Excel, `rapidfuzz` for name normalization; scheduled via system `cron` or `APScheduler`.
- **Matching reuse:** the existing normalize → exact → alias → fuzzy pipeline from spec 04 (`rapidfuzz`/Levenshtein). Do **not** build a new matcher.
- **Testing:** `pytest` (unit + integration), with dedicated math and safety-wording suites.

### 7.2 Data Model (DDL)

```sql
-- Feature A: versioned DRAP MRP baseline
CREATE TABLE mrp_reference (
  id             SERIAL PRIMARY KEY,
  medicine_id    INT NOT NULL REFERENCES medicines(id),
  pack_size      TEXT NOT NULL,            -- e.g. "14 capsules", "100ml syrup"
  notified_mrp   NUMERIC(10,2) NOT NULL,   -- DRAP-notified maximum retail price
  currency       TEXT NOT NULL DEFAULT 'PKR',
  sro_ref        TEXT,                      -- DRAP SRO / notification reference
  effective_date DATE,                      -- date this MRP became effective
  source_id      INT REFERENCES sources(id),
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_mrp_medicine ON mrp_reference (medicine_id, pack_size, effective_date DESC);

-- Feature B: DRAP recall / quality alerts
CREATE TABLE drug_alerts (
  id                SERIAL PRIMARY KEY,
  medicine_id       INT REFERENCES medicines(id),   -- nullable (name-only alerts)
  medicine_name_raw TEXT,                            -- name as printed in the DRAP alert
  batch_no          TEXT,
  alert_type        TEXT NOT NULL,                   -- 'recall' | 'spurious' | 'substandard' | 'quality'
  description       TEXT,
  source_id         INT REFERENCES sources(id),
  issued_at         DATE,
  resolved          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_medicine ON drug_alerts (medicine_id);
CREATE INDEX idx_alert_batch    ON drug_alerts (batch_no);
```

Both tables reuse the existing `medicines` and `sources` tables from spec 02. They are **purely additive** — no existing table is modified — which is what makes the rollback in §16 clean.

### 7.3 API Contract

**`POST /api/v1/price-check`**

```jsonc
// request
{ "medicine_query": "Risek 20mg", "pack_size": "14 capsules", "price_paid": 250.00, "currency": "PKR", "lang": "roman-ur" }

// response
{
  "status": "OVERCHARGED",
  "medicine_id": 12,
  "matched_name": "Omeprazole 20mg (Risek)",
  "match_confidence": 0.98,
  "price_paid": 250.00,
  "mrp": 210.00,
  "overcharge_amount": 40.00,
  "sro_ref": "F.No.1-5/2024-Cost",
  "effective_date": "2024-11-01",
  "source": { "name": "DRAP Price Notification", "url": "https://dra.gov.pk/..." },
  "as_of": "2024-11-01",
  "message": "Aap se Rs. 40 zyada liye gaye. MRP Rs. 210 hai.",
  "disclaimer": "MRP change ho sakti hai (SRO). Latest DRAP notification se verify karein. Ye legal advice nahi."
}
```

**`POST /api/v1/alert-check`**

```jsonc
// request
{ "medicine_query": "Risek 20mg", "batch_no": "ABC123", "lang": "en" }

// response
{
  "status": "ALERT_FOUND",
  "alerts": [
    { "alert_type": "substandard", "description": "...", "batch_no": "ABC123",
      "source": { "name": "DRAP Alert", "url": "https://dra.gov.pk/..." }, "issued_at": "2025-02-10" }
  ],
  "match_basis": "batch_no",
  "disclaimer": "No alert found does NOT guarantee authenticity. Verify with your pharmacist and report suspicious products to DRAP."
}
```

Low-confidence matches must return the candidate list + a `needs_confirmation: true` flag rather than silently picking one (per 04).

### 7.4 Shared Ingestion Pipeline

```
DRAP source (PDF / Excel / SRO / portal)
  → parse/extract (pdfplumber | camelot | openpyxl)
  → normalize (map name+strength+pack → medicine_id via spec 04 matcher)
  → upsert:  mrp_reference (prices)  and/or  drug_alerts (alerts)
  → scheduled refresh (cron / APScheduler)  +  provenance row in `sources`
```

Rules: prices are **inserted as new versioned rows** (keyed by `effective_date`), never updated in place; every row must carry a `source_id`. If DRAP structured data is not yet parseable, run the pipeline in **manual seed mode** (see §15).

### 7.5 Suggested Module / File Structure

```
backend/app/
  features/
    price_check/{router.py, service.py, schemas.py}   # service.py = pure, unit-testable comparison
    alert_check/{router.py, service.py, schemas.py}
  matching/            # EXISTING (spec 04) — import & reuse, do not rewrite
  ingestion/{drap_prices.py, drap_alerts.py, seed_manual.py}
  db/{models.py, migrations/}
  core/{safety.py, i18n.py}                            # reuse spec 07/08 helpers
backend/tests/{test_price_check.py, test_alert_check.py, test_ingestion.py, test_safety.py}
frontend/
  components/{PriceCheckCard.tsx, AlertCheckCard.tsx}
  lib/i18n/{en.json, ur.json, roman-ur.json}
```

## 8. Workflow
**Feature A:** input → (OCR if image, per 03) → matching (04) → `medicine_id` → fetch latest `mrp_reference` for pack_size → compute diff → classify → localize (07) → return with source + effective_date.
**Feature B:** input → matching (04) → query active `drug_alerts` by medicine_id/batch/name → localize → return with source + disclaimer.
**Ingestion:** scheduled job → parse DRAP docs → normalize → upsert tables → log source + run timestamp.

## 9. Error/Edge Cases
- No MRP row for the pack → `NO_DATA` (never guess). 
- `effective_date` older than the freshness threshold → include a "may be outdated" flag.
- Multiple pack sizes for a medicine → require/confirm `pack_size` before comparing.
- Name-only alert match → mark as "possible match, verify" to avoid false positives.
- Low-confidence medicine match → return candidates + `needs_confirmation` (04).
- OCR receipt unreadable/low confidence → ask user to confirm/enter manually (03).
- Currency or unit mismatch → do not compare; surface a clear message.

## 10. Security/Safety Considerations
- **LLM never generates a price or an alert status** — both come only from DB rows (08). The LLM only phrases the result.
- Always display **provenance (source) + effective/issue date**; degrade to a staleness warning rather than showing a confidently stale number.
- Feature B wording must make explicit that **"no alert" ≠ authenticity guarantee** and must not imply batch-level verification the system cannot perform.
- If cheaper alternatives are ever surfaced here, attach a **substitution-caution** flag for narrow-therapeutic-index drugs (e.g., warfarin, levothyroxine, phenytoin, digoxin, lithium), modified/extended-release forms, and biologics — advise consulting a pharmacist/doctor; never auto-substitute.
- Parameterized queries only (02/10). Do **not** persist PII from receipts/prescriptions — process transiently and discard (00/08).
- Reuse the pre/post-generation safety checks and disclaimers from spec 08 on all localized output.
- **Data safety:** treat every schema change as reversible and snapshot the database before applying it (§16, and 10 §15). Never run a destructive statement without a fresh snapshot.

## 11. Acceptance Criteria
- Overcharge math is correct for over/equal/below cases; MRP retrieval always returns the row with the latest `effective_date`; missing data yields `NO_DATA` gracefully.
- Alert lookup returns only `resolved = FALSE` alerts; batch match is exact; name-only matches are flagged as unverified.
- Every price/alert in a response is traceable to a stored `sources` row.
- Output is correct and natural in English, Urdu, and Roman Urdu.
- Each migration has a working `downgrade`, and the rollback in §16 returns the DB to its pre-Phase-1 state.

## 12. Testing Requirements
- **Unit:** overcharge arithmetic (over/equal/below), `NO_DATA`, stale MRP; alert filtering (`resolved=false`), exact batch match, name over-match guard.
- **Integration:** matching → price-check and matching → alert-check end to end.
- **Safety:** disclaimer presence, "no-alert ≠ authentic" wording, no LLM-generated numbers; reuse prompt-injection tests from 07.
- **Ingestion:** parse fixtures → correct upserts; versioned insert (not overwrite) on MRP change.
- **Migration reversibility:** `alembic upgrade` then `alembic downgrade` returns the schema to its prior state without error.

## 13. Open Questions
- DRAP data access: what is the current format/availability on dra.gov.pk (PDF/SRO/portal/API)? **Verify before automating ingestion.**
- Acquisition strategy for the 40 MVP medicines: hand-curated CSV vs automated parsing for the first release?
- Is there any batch-level authenticity data source beyond published alerts?
- Canonical key for matching a DRAP alert's `medicine_name_raw` to our `medicines` rows.

---

## 14. Implementation Plan for a CLI Coding Agent (Claude Code, etc.)

**Before coding**, the agent should read specs 02 (schema), 04 (matching), 07 (chat/i18n), 08 (safety), and 10 (§15 rollback), and treat their rules as constraints. Keep the guardrails in §10 and §16 in context throughout.

**Step 0 — Safety checkpoint (do this before any migration):**
- **Database:** create a Neon snapshot branch off `production` named `afiya-before-phase1` (Branches → Create branch → parent `production` → current state). Leave it frozen. See 10 §15.1.
- **Code:** commit/tag in git (or keep a labeled folder copy) so code and DB can be rolled back together.

**Ordered tasks:**
1. **DB migrations** — add `mrp_reference` and `drug_alerts` (Alembic), each with a working `downgrade`; add SQLAlchemy models. Additive only — do not touch existing tables.
2. **Seed sources** — insert DRAP source rows into `sources` for provenance (note the exact `name` values so they can be removed on rollback — see §16).
3. **Manual seed ingestion** (`seed_manual.py`) — load a hand-curated CSV of the 40 medicines' MRP + pack sizes (and any known alerts) so the app is end-to-end testable *before* DRAP parsing exists (see §15).
4. **price_check service** — pure function `compare(price_paid, mrp) -> status/amounts`; fully unit-tested (no I/O).
5. **price-check endpoint** — `POST /api/v1/price-check`; validate with Pydantic; reuse matcher (04) to resolve `medicine_query → medicine_id`.
6. **alert_check service + endpoint** — active-alert lookup by medicine_id/batch/name with the false-positive guard.
7. **Localization** — wire responses through the i18n/safety layer (07/08) for EN/UR/Roman Urdu; attach disclaimers.
8. **Frontend cards** — `PriceCheckCard` and `AlertCheckCard` with provenance chips + freshness + language toggle.
9. **Automated DRAP ingestion** (`drap_prices.py`, `drap_alerts.py`) — only after the DRAP format is confirmed; schedule via cron/APScheduler.
10. **Tests** — implement the full suite in §12 (including migration reversibility); must pass before "done".

**Definition of done:** all §11 acceptance criteria met, §12 tests green, every migration has a working `downgrade`, no code path lets the LLM produce a price or alert status, and every displayed number/status links to a `sources` row.

**Suggested starter prompt for the CLI tool:**
> "Read specs 02, 04, 07, 08, 09, and 10 §15. FIRST confirm a Neon snapshot branch `afiya-before-phase1` exists (off `production`) and that the code is committed — do not run migrations until this safety checkpoint is in place. Then implement Feature A (MRP/Overcharge Checker) from spec 09: create the `mrp_reference` Alembic migration (with a working `downgrade`) + model, a pure unit-tested comparison service, and the `POST /api/v1/price-check` endpoint that reuses the existing matching pipeline (spec 04). The migration must be additive — do not alter existing tables. Do not let the LLM generate any price — all values must come from `mrp_reference` with a source and effective_date. Seed data via `seed_manual.py` from a CSV so we can test end to end. Then write the pytest suite from spec 09 §12 (including an upgrade→downgrade reversibility test) and make it pass. Stop and show me the diff before starting Feature B."

## 15. Suggested Seed Data (bootstrap without DRAP parsing)
To avoid being blocked on DRAP's document format, start with a hand-curated CSV for the 40 MVP medicines:

```
medicine_name, generic, strength, pack_size, notified_mrp, currency, sro_ref, effective_date, source_name, source_url
```

Load it through `seed_manual.py` (which maps each row to a `medicine_id` via the spec-04 matcher and inserts into `mrp_reference`). Do the same for any publicly known alerts into `drug_alerts`. This lets the coding agent build and test both features end to end immediately, and swap in automated DRAP ingestion later without changing the API or UI.

---

## 16. Rollback & DB Safety (undoing these two features)

These features are deliberately **additive**: they add only two new tables (`mrp_reference`, `drug_alerts`), their seed rows, and a couple of provenance rows in `sources`. Nothing existing is modified, so they roll back cleanly. The **full backup/restore process lives in spec 10 §15 (Neon branching)**; this section is the feature-specific undo. Rule of thumb: protect the **database** (Neon) and the **code** (git/folder copy) together, and roll back both together.

### 16.1 Before applying the migration (safety net)
- **DB snapshot:** create a Neon branch off `production` — e.g. `afiya-before-phase1` (10 §15.1). This is your durable return point (preferred over Free-plan point-in-time history, which is short). Leave it frozen.
- **Code snapshot:** commit/tag in git, or keep a labeled folder copy.

### 16.2 To roll back — choose one
- **Option A — full rewind (cleanest "back to before"):** restore `production` from the snapshot branch (10 §15.4, Option A), then restore the matching code checkpoint and restart the backend. The two tables and their migration state disappear together; the connection string is unchanged.
- **Option B — surgical (keep other post-snapshot data):** on `production`, drop only what these features added:

```sql
-- remove the two feature tables (indexes drop with them; FKs point outward, so medicines/sources are untouched)
DROP TABLE IF EXISTS mrp_reference, drug_alerts CASCADE;

-- remove ONLY the provenance rows added for these features (verify the exact names first)
DELETE FROM sources WHERE name IN ('DRAP Price Notification', 'DRAP Alert');
```

Then, on the code side, run `alembic downgrade` to the pre-Phase-1 revision so migration history matches the database.

### 16.3 Verify (either option)
```sql
SELECT to_regclass('public.mrp_reference'), to_regclass('public.drug_alerts');  -- both NULL when removed
```
Then boot the backend and confirm the pre-feature app still works (existing endpoints respond).

### 16.4 Golden rule
Never run a destructive statement (`DROP` / `DELETE` / `TRUNCATE`) without taking a fresh Neon snapshot branch first. Keep every Phase-1 migration additive (new tables only) and reversible (working `downgrade`); never alter or drop an existing table or its data.
