# Afiya AI — Phase 1 Build Prompt (for a CLI coding agent)

> Use this alongside your existing spec `09-priority-features.md` — that spec stays the source of
> truth (schema DDL, API contract, tests). This file is just the **up-to-date starter prompt**,
> aligned to (a) your real seed file `DRAP_40_Medicines_enriched.json`, (b) the hackathon-demo scope,
> and (c) the generic+strength guardrail. Build **Feature A first**, verify, then Feature B.

---

## Before you paste anything — 2-minute safety checklist

1. **Neon snapshot (DB rollback point).** You already have `afiya-before-additional-features`.
   Either reuse it or create a fresh branch off `production` named `afiya-before-phase1`
   (Neon console → Branches → Create branch → parent `production` → current state). Leave it frozen.
   *Do not run any migration until this exists.* (See spec 10 §15.1.)
2. **Code checkpoint.** `git commit` + tag your current working code so DB and code can roll back together.
3. **Give the agent read access to:** specs `00`–`10`, and the seed file `DRAP_40_Medicines_enriched.json`.

## Data realities (keep these true in the build)

- **Feature A** runs on the enriched JSON's **2023-05-10 reference prices**. Fine for the demo **only if**
  every price-check response shows the `effective_date` **and** the "verify with the latest DRAP notification"
  disclaimer. Never show a bare "you were overcharged" without the date + disclaimer.
- **Feature B** has **no data** in the JSON. Seed a few alert rows first (see the Feature B section).
  **Never fabricate a recall/substandard claim about a real product/batch** — use genuinely published
  DRAP alerts (that you confirm) or rows clearly marked `DEMO DATA`.
- **Matching guardrail:** group / match by **generic + strength**, never generic alone
  (e.g. Ciprofloxacin exists at 250mg *and* 500mg in this dataset — not price-interchangeable).

---

## PROMPT — Feature A: MRP / Overcharge Checker  (paste into your CLI coding agent)

```
Read specs 02 (schema), 04 (medicine matching), 07 (chat/i18n), 08 (safety), 09 (priority features),
and 10 §15 (Neon backup/rollback). Treat their rules as hard constraints.

SAFETY GATE (do this first, do not skip):
- Confirm a Neon snapshot branch off `production` exists (`afiya-before-phase1` or
  `afiya-before-additional-features`) and that the current code is committed. Do NOT run any
  migration until both are true. Report what you found before proceeding.

TASK — implement Feature A (MRP / Overcharge Checker) from spec 09:

1. DB migration (Alembic, additive + reversible, with a working downgrade):
   - Create table `mrp_reference` exactly as in spec 09 §7.2. Do NOT alter or drop any existing table.
   - Ensure `medicines` has a canonical DRAP key column `drap_reg_no` (unique). If missing, add it
     additively.

2. Seeder — load `DRAP_40_Medicines_enriched.json` (40 rows). Map keys (note the SPACE in "effective from"):
       Registration_No  -> medicines.drap_reg_no   (CANONICAL KEY — upsert medicines on this, no fuzzy names)
       Product_name     -> medicines.brand_name
       Generic          -> medicines.generic
       Strength         -> medicines.strength
       Form             -> medicines.form
       Manufacturer     -> medicines.manufacturer
       Category         -> medicines.category
       Packsize         -> mrp_reference.pack_size
       Price            -> mrp_reference.notified_mrp     (whole-pack PKR)
       "effective from" -> mrp_reference.effective_date
       source           -> sources.url  (+ source_name = "DRAP Price Portal")
   Insert one `mrp_reference` row per medicine (currency default 'PKR', sro_ref = NULL is fine).
   Seeding must be idempotent (re-runnable without duplicates), keyed on drap_reg_no.

3. Pure comparison service — `compare(price_paid, notified_mrp) -> {status, amount}` where status ∈
   {OVERCHARGED, OK_AT_MRP, BELOW_MRP}. No I/O, fully unit-tested (over / equal / below cases).

4. Endpoint `POST /api/v1/price-check` (contract in spec 09 §7.3):
   - Resolve `medicine_query` -> medicine via the EXISTING spec-04 matcher (do not build a new matcher).
     Match on generic + strength; low confidence -> return candidates + needs_confirmation=true.
   - Fetch the latest `mrp_reference` row for that medicine + pack_size; if none -> status NO_DATA (never guess).
   - Compute the difference in code (the LLM must NEVER generate a price or status).
   - Response includes: status, mrp, overcharge_amount, effective_date, source, and a localized
     message + disclaimer (EN / Urdu / Roman-Urdu via spec 07). Always include effective_date +
     "MRP change ho sakti hai — latest DRAP notification se verify karein" disclaimer.

5. Tests (pytest) — from spec 09 §12: overcharge math (over/equal/below), NO_DATA, and an
   Alembic upgrade->downgrade reversibility test. All must pass.

Keep every change additive. STOP and show me the diff before starting Feature B.
```

---

## PROMPT — Feature B: Authenticity / Alert Checker  (only after Feature A is verified)

**First, seed alert data** (Feature B has none). Create a small `drap_alerts` seed — either real DRAP
alerts you have confirmed, or rows clearly marked `DEMO DATA`. One truthful real candidate already in
your dataset: **ranitidine (Zantac 150mg)** — the global NDMA-contamination recall. Confirm DRAP's exact
notice wording before presenting it as a DRAP alert; otherwise mark it `DEMO DATA`.

```
Read specs 04, 07, 08, 09 (Feature B), 10 §15. Safety gate first (snapshot + commit) as before.

Implement Feature B (Authenticity & Recall/Alert Checker) from spec 09:
1. Alembic migration for `drap_alerts` (spec 09 §7.2), additive + reversible downgrade.
2. Seeder from a small CSV `drap_alerts_seed.csv` (real, confirmed DRAP alerts OR rows flagged DEMO DATA).
   Never invent a recall/substandard claim about a real product/batch.
3. `POST /api/v1/alert-check` (spec 09 §7.3): resolve medicine via spec-04 matcher; return only
   `resolved = FALSE` alerts; exact batch match; name-only matches flagged as "possible, verify".
4. Wording MUST state: "no alert found does NOT guarantee authenticity" (spec 09 §10).
5. Tests: active-alert filtering, exact batch match, name over-match guard, migration reversibility.

Keep additive. Show me the diff when done.
```

---

## If you ever want to undo Phase 1

Full detail in spec 09 §16 / spec 10 §15. Quick version:
- Surgical: `DROP TABLE IF EXISTS mrp_reference, drug_alerts CASCADE;` then `alembic downgrade`.
- Verify: `SELECT to_regclass('public.mrp_reference'), to_regclass('public.drug_alerts');` → both NULL.
