# Deployment preparation — 2026-10-22

All application edits remain local and uncommitted on `feature/smart-marketplace`.
No commit, push, merge, tag or application deployment was performed.

## Production Neon changes applied with authorization

- Confirmed the user's selected connection targets production.
- Before: migration revision `0009`; 105 medicines and 102 MRP records.
- Created private same-database row snapshot `afiya_release_snapshot_9cda11ab42d8`
  for medicines, sources, embeddings, cabinet entries and migration versions.
  This is a migration recovery reference, not an independent backup.
- Applied additive migrations through `0013` and checked model tables/columns.
- After: revision `0013`, no missing model schema, no duplicate cabinet pairs.
- Preserved all 105 medicines and 102 MRP references; all 102 bundled registration
  identifiers were already present, so catalog synchronization was unnecessary.
- Seeded explicitly labeled demo pharmacies/inventory/history: 3 sellers,
  105 inventory records, 5 synthetic orders, plus demo alert fixtures.
- Read-only verification through the new catalog and analytics services returned
  105 stocked catalog rows, 5 demo orders, 0 non-demo orders, PKR 798.93 simulated
  monthly order revenue and PKR 0.00 non-demo revenue. These are not payments.

## Application changes awaiting the user's release

- Migration `0013` and the `PrescriptionAttachment` model store private bounded
  image bytes in the existing API database.
- Authenticated upload/read endpoints at `/api/v1/store/prescriptions` enforce
  valid JPEG/PNG/WebP uploads, a 10 MiB size cap and owner/admin access.
- Browser uploads and admin previews go directly to FastAPI. Existing `/uploads/`
  references remain compatible and web proxy routes remain available.
- No local filesystem is used by the attachment storage adapter. Existing old
  local image files were not imported automatically.
- Default `npm run build` selects the tested Webpack compiler; development
  `npm run dev` is unchanged.
- Privacy disclosures, README and deployment specification reflect storage.
- `scripts/prepare_database_release.py` defaults to read-only preview and prints
  only revisions/schema/counts. File-based credentials require an explicit flag;
  no environment file was edited or displayed.

## Verification

- Full isolated backend suite: **386 passed**.
- Frontend regression scripts: **15 passed**.
- Production Next.js build: successful compilation, TypeScript and generation.
- Live Neon schema, catalog and separated analytics: passed read-only checks.
- New code has not been tested through the public HTTP deployment because it
  has not been pushed. Existing Vercel/Render dashboard settings were not changed.
- Pre-existing SDK/ORM/vector-reflection and Next.js middleware warnings remain.

## After the user publishes

Confirm Vercel and Render deployed the intended commit from `main`. Check health,
sign-in, catalog/cart, admin authorization, and a fictional/deidentified
prescription upload through order creation and admin image preview. The database
is prepared, but this does not replace checking production credentials, CORS,
Clerk domains, provider quota and the deployed HTTP flows.
