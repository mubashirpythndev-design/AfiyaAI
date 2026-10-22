# Local fixes — 2026-10-10

These changes are for team review locally. No push, deployment, or live database migration was performed. Existing uncommitted work was preserved.

## Run the preview

Open two PowerShell terminals at the repository root:

1. Run `./scripts/start-local-api.ps1`.
2. Run `./scripts/start-local-web.ps1`.
3. Open http://localhost:3000.

The API launcher overrides DATABASE_URL with a workspace SQLite database in .local/afiya.db. The frontend launcher overrides NEXT_PUBLIC_API_URL with localhost:8000. Local secrets/cache/database are ignored by Git. Existing Gemini/Clerk credentials may still be used for those integrations; they are not copied or changed. No live Neon database is used by these launchers. Tests use dummy credentials and SQLite via ./scripts/test-local.ps1.

## Changes

- Chat refuses personal diagnosis/prescribing requests before provider invocation; unsafe generated advice is replaced with a localized refusal. Removed symptom-to-drug recommendation tables and hardcoded alternative prices.
- Public registration cannot grant admin privileges. Clerk primary email must be verified; unsigned client identity headers are not trusted. Admin allowlist removals revoke access on subsequent requests. Unverified local accounts are not silently linked. Production mode requires a strong JWT secret.
- Catalog membership does not imply active DRAP registration. Registration numbers are not fabricated; source verification status is explicit. Stored dataset prices are described as reference values unless statutory provenance is present.
- Migration 0010 adds cabinet directions, reminder schedule, monthly units, verification status and embedding content hashes. Existing price observations and MRP versions are preserved. Production startup checks schema rather than mutating/seeding the live catalog.
- Savings use explicit user monthly quantities and actual whole-pack costs for compatible alternatives. Unknown quantities/prices produce an incomplete budget. Modified release forms remain distinct from ordinary tablets. Price comparison selects current rows and consistent pack/currency. Quantity calculators use stored pack sizes rather than assumed boxes.
- Browser reminders follow the saved morning/afternoon/night schedule, with per-day delivery records. App must remain open and notification permission must be granted; background push delivery when the browser is closed is not implemented.
- Chat/audio provider work runs outside the event loop with bounded concurrency, timeouts and rate-limit cooldown. Alternative prices are fetched in one group query. Embeddings use all knowledge chunks with content hashes. OCR cache uses transactional SQLite writes.

## Preserved OCR behavior

OCR extraction, uncertainty handling, prompts, and clinical explanation behavior were not redesigned. Only cache persistence changed. Existing OCR regression tests pass.

## Validation

184 backend tests passed across separate local batches, including 26 new regression cases. Frontend TypeScript validation passed. Frontend production build passed; Google Fonts required network access. Local API health, seeded matching, reference-price retrieval and safe chat smoke checks passed. No live AI quality evaluation or Neon/PostgreSQL migration run was performed. Current dependency deprecation warnings remain (legacy Gemini SDK, datetime.utcnow, Next.js middleware naming).

Production rollout remains a separate team decision. Migration 0010 and environment configuration must be reviewed against a staging PostgreSQL database before deployment.

## Cabinet quantity selector (2026-10-10)

Monthly quantity can now be entered as tablets, capsules, doses, strips or packs, as applicable to the medicine form and stored pack size. Strips are offered only for tablets/capsules with known AxB blister packaging; packs require a known unit count. Example: a 3x10 pack gives 10 units per strip and 30 per pack, so 4 strips normalize to 40 units and a budget of two whole packs. Unsupported packaging is not guessed.

The selector previews the conversion and requires an explicit Save quantity action. Selected quantity/unit persist in migration 0011; existing monthly_units remain valid. Clearing quantity makes the budget incomplete. Quantity is not a dosage recommendation. English, Urdu and Roman Urdu labels are included. Unit limits, API rejection, persistence, actual pack budgeting and migration reversal are covered by regression tests.

The existing local apps/api/afiya_test.db was backed up in .local and upgraded to 0011. No live database was migrated. Restart the API and refresh the frontend to load this feature.

## Live cabinet prices

The cabinet now previews each selected quantity's proportional reference cost and the separate cost of purchasing complete packs. Quantity or unit edits also preview the cabinet monthly/annual budget immediately. Save commits the quantity; unsaved previews cannot be shared as a saved schedule. Reverting an edit restores the saved budget.

Prices and conversion factors use the same newest stored PKR price row and pack size; unrelated MRP rows and older cheaper pack prices are no longer mixed into cabinet item display. Money calculations use integer paisa and only round the final proportional value. Unknown prices/pack sizes remain unavailable. Cabinet budgets reuse these snapshots for consistency. No schema migration was needed for this change.

Example using a stored PKR 90 pack of 30 capsules: 4 strips of 10 capsules preview PKR 120 for the selected 40 capsules; purchasing two complete packs costs PKR 180. The price is a proportional reference estimate; loose-unit pharmacy rates can differ.

Validation: 58 relevant backend regressions passed, TypeScript validation passed, and scripts/test-cabinet-prices.mjs verifies price math, multi-item live totals and rendering of the actual cabinet selector.


## OCR coverage and review — 2026-10-11

The previously deferred extraction/review improvements are now implemented locally under the user’s new authorization. See [OCR_LOCAL_FIXES.md](OCR_LOCAL_FIXES.md) for all nine areas, validation and the remaining real-prescription benchmark. Clinical explanation generation is preserved. No database migration is needed for the OCR response fields.


## UI refinement (2026-10-12)

Local frontend refinements replace the green dark theme with midnight slate, soft blue and ivory accents. Gentle finite entry/hover animations respect reduced-motion preferences. A trilingual source notice below the main header links to the DRAP price portal, states that compiled catalog records still require verification, and distinguishes catalog/price references from prescription transcription and clinical explanations. It does not claim DRAP endorsement or a live DRAP feed. No backend, database or deployment changes.

## Prescription image removal and scanning feedback

The uploader and the post-scan review screen have a visible Remove image action in English, Urdu and Roman Urdu. Removing clears the selected file, preview, OCR results, scan error and processing state. The browser aborts its upload request and increments the scan serial so late OCR/catalog responses cannot restore a removed scan or overwrite a newer upload. Removing a selected image does not delete medicines already saved in the cabinet, and browser cancellation does not guarantee that an already-started provider job stops processing.

The selected image shows a moving scan line and frame while scanning, alongside a prominent live scanning status and indeterminate activity bar. Fresh and selected-region rescans use the same indicator. There is no simulated percentage or completion estimate. Reduced-motion preferences retain a static indicator and readable status. Preview object URLs are released when the file changes or the component unmounts, and file inputs reset to permit selecting the same image again.

Verification: scripts/test-prescription-upload.mjs exercises the actual page handlers with delayed OCR/matching promises (remove, late success/failure, re-upload and rescan failure) and renders real components in three languages. scripts/test-api-errors.mjs covers explicit cancellation separately from timeouts; scripts/test-ocr-review.mjs checks existing review gates. These scripts and TypeScript passed. Chrome confirmed the visible animation, active Remove image during a pending scan, cleared photo/status after removal and a subsequent sample upload. The browser preview used a temporary local test API configuration; this change does not validate Gemini availability or OCR accuracy. Screenshot: artifacts/prescription-ui/scanning.jpg. All preview services are stopped after verification. Lint reported zero errors and three warnings about preview/review effect state and the existing review img element.
