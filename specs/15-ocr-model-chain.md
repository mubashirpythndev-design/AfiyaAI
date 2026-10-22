# Gemini Vision OCR and pharmacist fallback

## Active extraction chain

The prescription upload endpoint uses Gemini Vision directly, in this exact order:

1. `gemini-3.8-flash`
2. `gemini-3.5-flash-lite`
3. `gemini-3.1-flash-lite`

Cache version `vision-primary-38-v9` prevents reuse of prior-model results.
Transcription keeps products and their attributes separate across lines/columns.
An unreadable independent reading of an initially readable line retains the first
transcription, flags the uncertainty and triggers the bounded detail-crop path;
it cannot silently count as agreement. Existing conflicting alternatives remain
visible. This does not guarantee correct recognition of illegible handwriting.

The model array is defined in `ocr_models.py` and cannot be reordered by legacy
model environment overrides. Stable endpoint lifecycle information is available
in [Google's official model documentation](https://ai.google.dev/gemini-api/docs/deprecations/).
Account access, capacity and quota remain provider-dependent. No separate compute
partition or quota pool is assumed.

RapidOCR, its dependency, CPU worker, local parser and demo fallback items are
removed. Image validation, EXIF handling, image enhancement and bounded crop
preparation remain because Gemini receives prescription images. Unknown product
names, unreadable entries, alternative readings and human-review flags remain
visible; OCR does not establish verified clinical facts or prescribing advice.

## Timeout and failover

The Gemini SDK HTTP transport is exactly **35,000 milliseconds**, and the service
processing window is **35 seconds per model attempt**, bounded by the remaining
scan deadline. Legacy 12-second fallback or 90-second primary settings cannot
change this fixed transport deadline. SDK retries are disabled; the application
catches each failure, logs only safe diagnostics, and advances to the next eligible
model. Failed models are not probed again during that scan; quota cooldowns avoid
repeated exhausted calls. Cancellation closes the async SDK client.

Interactive scans retain a 120-second budget and thorough scans default to 180
seconds, including queue wait. Optional coverage/detail readings retain their
bounded call count; failed audits preserve a successful initial transcription
with an explicit review warning. The browser waits 150 seconds for normal scans
and 210 seconds for thorough scans so it does not abort before the fallback chain
can finish. A 35-second per-attempt deadline is not a 35-second whole-chain promise.

## Router and UI contract

If all model attempts fail, or a final timeout/failure reaches the router, return
HTTP 503, `Retry-After: 60` and this exact top-level JSON:

```json
{"error":"OCR_SERVICE_BUSY","message":"AI OCR models are temporarily busy. Please use our instant Pharmacist Concierge flow.","fallback_available":true}
```

Invalid/corrupt/oversized image inputs still return HTTP 400 before extraction.
The frontend parses the busy code and HTTP 503 without crashing, retains the
original uploaded photo, and offers **Send Rx to Pharmacist (Zero Wait)**. This
button uses the existing private upload and concierge APIs, creates an
`AWAITING_PHARMACIST_CART` order and displays its reference/status. It never calls
OCR again. Zero AI wait does not imply instantaneous pharmacist review.

## Verification

Existing cloud parsing, cancellation, cache, matching and marketplace regressions
remain covered. Obsolete local-engine/demo tests are replaced with tests for the
restored Gemini entry point and fixed transport across all three models, including
caller deadlines below and above 35 seconds. Route tests verify the exact busy
payload for timeouts and general failures, and retain redaction checks. Frontend
contracts verify the 503 handoff and one-time original-image submission.

Use `python scripts/run_backend_tests_isolated.py` and
`node scripts/build-web-isolated.cjs` to verify without loading dotenv files.
Mocked tests do not verify live Gemini quota, model access or handwriting accuracy.
