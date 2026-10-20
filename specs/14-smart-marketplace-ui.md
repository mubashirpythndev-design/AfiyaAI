# Smart pharmacy marketplace UI (local Part 2)

## Buyer flow

The header has a dedicated mobile-friendly shop navigation row. Catalog entries,
search/category cards and price comparison tables offer Add to Cart actions.
Cart quantities mean whole packs. Catalog unit comparisons do not replace the
server's whole-pack cart evaluation; switches use its exact `target_quantity`.

The cart evaluates after quantity, item, warning-language or attachment changes.
It cancels superseded requests, shows Rx/duplication/stock/regulatory locks,
allows removal of overlapping medicines, and quotes server totals and savings.
Checkout requires authentication and a fresh successful evaluation. The backend
rechecks every condition; repeated client clicks are blocked during submission.

An attachment bypasses submission locks only by requesting pharmacist review.
It never constitutes prescription approval. OTC orders can be confirmed directly;
attached prescriptions produce pending-review orders. No payment or physical
shipment service is claimed.

OCR shopping is a separate staging tray: each identity requires a confirmation
checkbox, and uncertain matches require an explicit brand/strength/form selection.
Unresolved lines cannot be added. Selections add one pack each without inferring
a clinical dose. The original prescription photo accompanies confirmed selections.
There is no blind Add All action. Existing OCR review and medicine views remain.

Concierge submission skips OCR and creates a pharmacist queue request. My Orders
shows the returned status and lets buyers approve pharmacist-built carts or
request an evaluated cheaper compatible alternative. The server remains the
authority for compatibility, quantity, stock, pricing and order ownership.

## Admin flow

Five sections: revenue/safety analytics, pharmacist queue, regulated inventory
and catalog synchronization, seller verification, and registered users. The
existing registered-users table/search is retained. Community feedback remains
available as a subsection of Registered Users.

The queue shows the private prescription beside the editable pharmacist cart or
pending-review items. Images can be zoomed. Approval confirms an order; dispatch
is not implemented. Inventory saves show backend regulatory errors verbatim.
The registration number is loaded from the existing medicine-detail endpoint on
request, because marketplace inventory responses do not include that field.

Catalog JSON is validated and previewed before application. Selecting a new file
invalidates an old preview. The sample explicitly demonstrates a changed stored
reference; it is not presented as a new DRAP notification. Only a successful
preview can be applied. Sellers and analytics disclose synthetic demo data.

## Claims and schema alignment

Contracts come from `app/models/marketplace_schemas.py`, the three routers and
their service serializers (`app/schemas.py` does not exist). Amounts accept both
decimal strings and JSON numbers. Backend savings aggregate discounts and
switches, so analytics label the total as recorded patient savings rather than
claiming it measures generic switches alone.

The UI labels stored DRAP-aligned price references and demo sellers accurately.
The API does not establish live registration, actual license verification or
clinical substitutability, so these are not claimed by a badge.

## Local prescription storage

`POST /api/marketplace/prescriptions` accepts an authenticated JPEG/PNG/WebP up to
8 MB and returns `/uploads/{uuid}`, matching the backend URL constraint. The
multipart body is bounded even when Content-Length is absent. File signatures
are checked, filenames are generated, and images/owner metadata are written to
`.local/marketplace-prescriptions` outside public assets. Backend `/api/auth/me`
verifies the bearer token. `GET /uploads/{uuid}` permits only its owner or an
authorized backend admin and disables caching. The UI fetches private images
with the bearer token rather than placing tokens in URLs.

This is local disk storage for the requested local workflow. Durable private
object storage, retention controls and delivery/payment integration are needed
before a serverless public deployment; no deployment is performed here.

## Local verification

From the repository root:

```powershell
node scripts/build-web-isolated.cjs
node scripts/test-marketplace-web.cjs
node scripts/test-marketplace-prescriptions.cjs
python scripts\run_backend_tests_isolated.py
```

The build runner invokes `npm run build -- --webpack` in `apps/web`, with process-only
dummy public configuration and a preload hook blocking dotenv reads. Webpack is
used to avoid native Turbopack dotenv discovery. These dummy values belong only
to build verification; they are not working sign-in credentials. Start the usual
development server to test with your existing local authentication configuration:

```powershell
cd apps/web
npm.cmd run dev -- --webpack
```

Keep the local FastAPI server running separately. For manual checks:

1. Add an OTC medicine, adjust pack quantities and confirm checkout.
2. Add an Rx item or overlapping medicines; verify locked checkout, then attach
   a photo and submit for pharmacist review.
3. Review an OCR result, explicitly choose ambiguous identities, confirm individual
   lines, and add only confirmed items. Check the photo accompanies the order.
4. Submit concierge Rx, build its cart in `/admin`, switch an eligible brand in
   My Orders, then confirm. Verify the status and stock update.
5. Try an above-MRP price or recalled batch in inventory. Verify the 422 banner;
   preview/apply a sample catalog update and approve a demo pending seller.

Unit tests cover pack-switch behavior and decimal display. Prescription route tests
exercise real temporary disk storage and mocked backend identity responses,
including ownership, admin access, invalid images, size limits and traversal.
The backend suite separately verifies real JWT auth and marketplace transactions.
No real Clerk sign-in or browser purchase is claimed by these automated checks.
