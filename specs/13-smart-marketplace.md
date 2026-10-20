# Smart pharmacy marketplace backend (local Part 1)

The store is a deterministic FastAPI/SQLAlchemy backend. It does not call OCR,
an LLM, or an external pharmacy. Existing medicine information and price-check
routes remain separate. No payment, shipment, live license verification, or
prescription authenticity verification is implemented by these endpoints.

## Data and money

- Four additive tables: `pharmacy_sellers`, `store_inventory`, `orders`,
  `order_items`. UUID strings and Numeric(10,2) amounts work on SQLite and PostgreSQL.
- A quantity is a **whole pack**. Inventory selling price, MRP and order-item
  unit price are PKR per pack. Money is computed with Decimal to two places.
  JSON consumers must accept amounts represented as either numbers or decimal
  strings and format them as currency.
- The current MRP is the latest effective-date reference (null dates last),
  with updated timestamp and ID as tie breakers. An explicit catalog refresh
  updates the stored baseline by registration number. Earlier pack/date snapshots
  are retained. This is not a complete SRO audit log.
- Switch suggestions require the same stored generic, normalized strength,
  and dosage form. Tablet/capsule pack counts can be compared per unit; other
  forms require identical known pack descriptions. Unknown pack conversions
  produce no suggestion. Suggestions exclude unavailable or recalled stock.
- Cart savings use actual whole-pack costs. The `target_quantity` must be used
  when applying a suggestion across differently sized packs. Catalog comparisons
  expose their `comparison_basis`; they are not a checkout quote.
- New catalog medicines require supplied generic, strength, form and brand/product
  name. Unknown categories receive a neutral knowledge description. Missing
  clinical facts are never generated. Catalog synchronization only accepts PKR.

## Duplication screening

`POST /api/v1/duplication-check` accepts `items` containing exact medicine names,
IDs, or `{medicine_id}` / `{medicine_query}` objects, plus `lang` (`en`, `ur`,
`roman_ur`). Authentication is required. Only uniquely resolved stored identities
are screened. Unresolved and ambiguous inputs are returned separately.

Same normalized generic names produce HIGH warnings regardless of strength.
Different generics in the same stored category produce MODERATE screening
warnings; same-generic pairs are not repeated in the class warning. Broad dataset
categories are not a clinically validated interaction or substitution database.
All results include a doctor/pharmacist disclaimer and never instruct a patient
to stop medication. A clear result does not establish clinical safety.

## Purchase and review transitions

Public store endpoints: `GET /api/v1/store/catalog` and
`POST /api/v1/store/cart-evaluate`.

Authenticated store endpoints: `POST /checkout`, `POST /concierge-rx`,
`GET /my-orders`, `POST /my-orders/{order_id}/confirm-cart`, under
`/api/v1/store`. Buyer reads and confirmations are scoped to their own account.

Cart evaluation checks known items, quantities, verified seller, current MRP cap,
unresolved batch alerts, stock, Rx requirements and duplication. An attachment
allows an Rx/duplication cart to be submitted for review; it does not approve it.

- Pure OTC checkout: `CONFIRMED`, stock deducted atomically.
- Checkout with a prescription reference: `PENDING_RX_REVIEW`, no deduction yet.
- Pharmacist approval: `PENDING_RX_REVIEW` → `CONFIRMED`, stock checked again and
  deducted once; rejection of stock/MRP/recall/seller checks rolls back the transition.
- Concierge submission: `AWAITING_PHARMACIST_CART`.
- Admin builds a cart: `CART_READY_FOR_USER`, records pharmacist verification.
- Buyer confirms: `CONFIRMED`, reevaluates current prices and stock, deducts once.
  Optional replacements must preserve the pharmacist-built list and quantities,
  or apply an evaluated compatible cheaper alternative.

Prescription references accept HTTPS or `/uploads/` paths; the backend does not
fetch or authenticate the referenced document. An admin review remains required.
Status transitions use conditional updates. Stock subtraction requires sufficient
stock in the UPDATE itself. Failures roll back the whole order transaction.

## Admin contracts

All added `/api/admin` routes require the existing authenticated admin gate:

- `GET /analytics`: confirmed/delivered revenue and savings, queue counts,
  low stock (<10 packs), category demand and a demo-data disclosure.
- `GET /orders`: buyers and item snapshots, newest orders first.
- `POST /orders/{id}/build-cart`, `POST /orders/{id}/approve-rx`.
- `GET /inventory`, `PATCH /inventory/{medicine_id}`: supplied non-null updates;
  reject above-MRP prices and unresolved matching batch alerts with HTTP 422.
- `GET /sellers`, `POST /sellers/{id}/verify`: VERIFIED or REJECTED.
- `POST /catalog-sync`: registration-keyed records and `dry_run` (default true).
  Returns inserted/updated/unchanged counts and price differences. Validation
  precedes mutation; applying changes is transactional. Inventory prices above
  a reduced MRP are lowered while existing discounts/stock are preserved.

## Local seeding and migration

SQLite startup seeds marketplace data after MRP and demo alerts. Repeated seeding
preserves sold stock, seller decisions and existing orders. The three requested
pharmacies, their license references and five historical orders are **synthetic
demo data**, not real licensed sellers or actual patient sales. API responses
label demo sellers/orders and analytics disclose their inclusion. The 250 PKR
fallback is labeled `demo_fallback_unverified`; it is not a notified MRP.

Existing revision `0007` already creates overcharge reports. To preserve it, the
requested `0007_add_marketplace_store.py` uses revision `0007_marketplace_store`
with parent `0006`. Merge revision `0012_marketplace_merge` joins it with the
existing `0011` history, leaving one Alembic head. The marketplace downgrade
alone removes only its four tables. Existing local migrations 0010/0011 are
prerequisites, preserved without modification.

No live migrations, deployment or remote git updates are part of this task.

## Verification

From the repository root:

```powershell
python scripts\run_backend_tests_isolated.py
```

The runner disables dotenv loading for application settings, uses process-only
dummy settings, blocks external socket connections, and runs the complete pytest
suite on temporary SQLite fixtures. New tests cover migration round trips,
idempotent upgrades/seeds, exact/ambiguous name resolution, all three languages,
authorization and ownership, cart gates, pack conversions, regulated inventory,
review transitions, atomic rollback, repeated approvals, concurrent stock use,
catalog synchronization, and synthetic analytics.
