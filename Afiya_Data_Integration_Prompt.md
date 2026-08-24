# Afiya AI — Enriched Data Integration Prompt  (Step 0 — do this BEFORE the 2 Phase-1 features)

> **Goal:** migrate your EXISTING core app off the old JSON (which had no generic) onto
> `DRAP_40_Medicines_enriched.json` (adds `Generic` / `Strength` / `Form`, keeps every original key
> unchanged), and wire the **"cheapest brand within a generic"** feature to group by **generic + strength**.
> Everything **additive + reversible**. Runs on the Neon **`production`** branch, after a snapshot.
> Do this first; then use `Afiya_Phase1_Build_Prompt.md` for the Overcharge + Alert features.

---

## Safety gate — before any migration (this is the "runs on production" part)

- Your live app uses the **`production`** branch, and this migration applies **on `production`**. First
  create a **frozen snapshot** off `production` in the Neon console → e.g. `afiya-before-enriched-data`.
  The app keeps using `production`; the snapshot is only the rollback point. (spec 10 §15.1)
- `git commit` + tag the current code so DB and code roll back together.
- **Optional zero-risk:** build/test on a `phase0-dev` branch first, then apply the same migration to
  `production` once it passes.

---

## The prompt — paste into your CLI coding agent

```
Read specs 02 (schema), 04 (medicine matching), 08 (safety). Treat their rules as hard constraints.

CONTEXT: our medicine data was originally seeded from an old JSON that had NO generic/active-ingredient
field (only a therapeutic `Category`). We now have an enriched seed file
`DRAP_40_Medicines_enriched.json` (40 rows) that ADDS `Generic`, `Strength`, `Form` and keeps every
original key unchanged (Product_name, Registration_No, Manufacturer, Category, Packsize, Price,
"effective from" [note the space], source). Registration_No is the canonical DRAP key.

SAFETY GATE (first, do not skip): confirm a Neon snapshot branch off `production`
(`afiya-before-enriched-data`) exists and the code is committed. Do NOT run any migration until both
are true. Report what you found before continuing.

STEP 1 — Inspect current state (change nothing yet, report first):
Show how medicine data is currently stored and read — is there a `medicines` table seeded from the old
JSON, or does the app read the JSON directly? Adapt the following steps to whatever you find.

STEP 2 — Additive migration (Alembic, with a working downgrade):
- Add nullable columns to `medicines`: `generic TEXT`, `strength TEXT`, `form TEXT`.
- Ensure a unique canonical key column `drap_reg_no` exists (from Registration_No); add it additively if missing.
- Do NOT drop, rename, or retype any existing column. Prices and all existing data stay untouched.

STEP 3 — Backfill / re-seed (idempotent, keyed on drap_reg_no = Registration_No):
- From DRAP_40_Medicines_enriched.json set generic<-Generic, strength<-Strength, form<-Form for each
  matching medicine. Must be re-runnable with no duplicates and without overwriting Price or other fields.

STEP 4 — "Cheapest brand within a generic" feature:
- Grouping key = (generic, strength). NEVER group by generic alone, and NEVER by Category.
  (e.g. Ciprofloxacin exists at 250mg AND 500mg here — different strengths must NOT be grouped/compared.)
- Compare on PER-UNIT price, because pack sizes differ. Parse Packsize -> units:
    "AxB's" -> A*B   (e.g. "1x14's"->14, "10x10's"->100, "5x10's"->50)
    "N doses" -> N   (inhalers, e.g. "200 doses"->200)
  per_unit = Price / units.
- Given a medicine, return all same-(generic, strength) brands sorted by per_unit ascending: the cheapest
  brand, plus each brand's pack Price + Packsize + per_unit, and the % saving vs the queried brand.
- All numbers come from the DB. The LLM never generates or estimates a price.
- Safety flag: attach "consult a pharmacist before switching" for narrow-therapeutic-index drugs
  (warfarin, levothyroxine, phenytoin, digoxin, lithium), modified/extended-release forms, and biologics.
  (None of the current 3 groups are NTI, but keep the guard for when the dataset expands.)

STEP 5 — Tests (pytest), must pass:
- Migration upgrade->downgrade reversibility (schema returns to prior state).
- Backfill: all 40 rows have non-null generic/strength/form; spot-check e.g. Risek -> Omeprazole 20mg.
- Cheapest-brand returns (per-unit PKR):
    Omeprazole 20mg    -> Risek    12.86  (cheapest)  vs Losec 32.14
    Cetirizine 10mg    -> Rigix     6.00  (cheapest)  vs Softin 9.50, Zyrtec 11.00
    Rosuvastatin 10mg  -> Xplendid 24.00  (cheapest)  vs Rovista 26.00, Crestor 60.71
- Guardrail: Ciprofloxacin 250mg (Novidat) and 500mg (Ciproxin) are NOT grouped together.

Keep everything additive and reversible. STOP and show me the diff before wiring anything into the UI.
```

---

## Rollback (if needed)

- **Surgical:** `ALTER TABLE medicines DROP COLUMN IF EXISTS generic, strength, form;` (also `drap_reg_no`
  only if you added it), then `alembic downgrade`.
- **Full:** restore `production` from the `afiya-before-enriched-data` snapshot (spec 10 §15.4).
- **Verify:** the app boots and existing endpoints still respond.
