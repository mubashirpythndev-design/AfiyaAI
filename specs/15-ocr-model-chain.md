# Ordered OCR recovery and pharmacist handoff

## Contract

Image extraction uses `OCR_MODEL_CHAIN` in this exact order:

1. `gemini-3.5-flash-lite`
2. `gemini-3.1-flash-lite`
3. `gemini-3.8-flash`

Legacy model configuration cannot reorder this chain. A failed model is not retried
within the scan. Every provider exception advances to the next eligible model;
quota cooldowns prevent repeated requests to a model known to be exhausted.
Provider SDK retries are disabled. Cancellation, concurrency limits and the shared
scan deadline remain active. Each attempt receives a share of the remaining time
so a hung primary cannot consume the entire fallback budget. Optional coverage
audits retain their smaller call budget and never block a successful reading just
because a failed provider is unavailable.

All three models use high-resolution media and the configured thinking level.
The SDK processing timeout and initial extraction attempts have a 35-second
minimum, including legacy short environment values. The normal interactive budget
is 120 seconds; thorough mode defaults to 180 seconds. Three processing windows
plus scheduling headroom are reserved before attempting the chain. Queue wait and
optional coverage/detail passes still count toward the overall deadline, so a
late audit can have less time remaining. The browser waits 150 seconds for normal
scans and 210 seconds for thorough scans, allowing token/upload overhead.

Google lists these stable endpoints in its
[model lifecycle documentation](https://ai.google.dev/gemini-api/docs/deprecations/).
Account access and quota remain provider-dependent; fallback does not guarantee
separate capacity or quota pools. Legacy models and preview identifiers are absent
from the OCR chain.

If no eligible model succeeds, the service raises `OCRServiceBusy`. The OCR route
returns HTTP 503 with `Retry-After: 60` and this top-level JSON:

```json
{"error":"OCR_SERVICE_BUSY","message":"AI OCR models are temporarily busy. Please use our instant Pharmacist Concierge flow.","fallback_available":true}
```

## Buyer handoff

The frontend recognizes the busy code and HTTP 503/429, retaining the selected
original image. Its prominent fallback offers “Send Rx to Pharmacist (Zero Wait)”.
The authenticated action uploads the original image through the existing private
prescription-upload route, then calls the existing concierge endpoint. Success
shows the `AWAITING_PHARMACIST_CART` order reference and links to My Orders.
No OCR request is made by this action. Duplicate clicks are blocked and failed
order submissions can reuse the uploaded reference. Pharmacist review still
takes time; “zero wait” means bypassing AI, not immediate clinical approval.
Existing demo sellers remain labeled as demos.

The private upload limit and both marketplace image selectors accept 10 MB,
matching the OCR upload limit, so a valid OCR image also fits the handoff.

## Verification

Mocked provider tests verify literal order, success at every chain position,
all-model exceptions, quota cooldowns, deadlines, cancellation, uncached failures,
and the exact route response. Existing retry-policy tests now expect the ordered
chain instead of repeated calls to the same failed model. Frontend executable
tests verify typed error handling and original-image upload/order creation without
another OCR call. Backend fixtures use SQLite and no external provider requests.

Run `python scripts/run_backend_tests_isolated.py` and
`node scripts/build-web-isolated.cjs` to test without loading dotenv files.
Run `node scripts/test-ocr-concierge.cjs` for the frontend handoff contracts.
These checks do not validate model access, account quota or handwriting accuracy
against a live provider. No database migration or model change is needed.
