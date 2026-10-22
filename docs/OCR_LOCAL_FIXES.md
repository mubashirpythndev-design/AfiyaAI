# Local OCR extraction and review improvements — 2026-10-11

All changes are local. Nothing was pushed, deployed or migrated on Neon. Existing clinical explanation generation and summary presentation remain in place; this change does not validate those clinical statements.

## Nine areas addressed

1. **Unreadable and missing entries:** keep unclear names as visible review entries. If the model counts more medicine lines than it returns, show missing-line placeholders instead of silently dropping them. This still cannot reveal a line that every model pass fails to notice.
2. **Image detail:** preserve up to a 3072-pixel longest edge, JPEG quality 95, EXIF orientation; do not upscale small photos. Native-resolution region retries use PNG. Inspect small/low-contrast images and reject corrupt uploads, over 10 MB or 30 megapixels.
3. **Whole-page inventory:** extraction and coverage prompts inspect columns, margins and bottom notes. Preserve each raw line and its location, including unsupported medicine names. Require valid bounded JSON; reject truncated/blocked responses.
4. **Completeness and fallback:** default auto mode performs a separate whole-page reading even when the first extraction sounds confident. Audit disagreements stay visible. Unclear regions receive selective native-resolution retries. Up to four provider attempts per request, a configurable 150-second provider budget (60 seconds per provider request by default), shared concurrency limit and quota cooldown prevent unbounded retries. Slow preprocessing/scheduling can add wall-clock time; no exact latency guarantee is made. Fast mode is explicit API opt-in and skips the coverage pass.
5. **Cache:** SHA-256 covers image, prompt, model configuration, scan mode, selected region and cache version. Complete results expire after 24 hours; partial/review-required extractions are not cached. Fresh scan bypasses both memory and disk cache. SQLite cache is bounded to 500 entries.
6. **Confidence:** keep model-reported legibility unchanged; catalog similarity is a separate match confidence. Missing/invalid confidence becomes zero. Spelling suggestions and conflicting readings require review; confidence is not a calibrated probability of medical correctness.
7. **Database coverage:** retain out-of-catalog entries visibly. Catalog matching does not mean prescription completeness, correct reading or verified DRAP registration. Unreadable entries bypass catalog matching.
8. **Human review:** compare the original image, correct name/strength/form, add a missing medicine, fresh full scan, or select a region to rescan. Region results merge into existing entries; conflicting readings are displayed rather than silently overwriting. Every entry requires explicit confirmation before cabinet saving, and strength/form/LASA mismatch gates remain active. Unsupported entries remain visible but cannot be saved as invented catalog medicines. Full fresh scan replaces current extraction, including manual edits.
9. **Measured quality:** offline benchmark tooling now distinguishes missed names, extra names, wrong strengths/forms, unreadable entries and complete-correct prescriptions; it also reports available latency and provider-call metrics. Mocked tests prove program behavior, not handwriting recognition accuracy.

## Local verification

Backend: test_ocr_pipeline.py, test_ocr_review.py, test_ocr_benchmark.py cover coverage recovery, corruption, crop geometry, cache expiry/version/refresh, quota fallback, bounded retries, API validation and evaluator metrics. The rest of the backend suite covers auth, cabinet, prices, medical chat and migrations.

Frontend:

~~~powershell
node scripts/test-ocr-review.mjs
node scripts/test-cabinet-prices.mjs
npm --prefix apps/web run build
~~~

The review test checks actual component rendering in English, Urdu and Roman Urdu, matching concurrency, confidence preservation and cabinet eligibility gates. A successful build does not substitute for a real user trial.

## Offline real-prescription benchmark

Prepare redacted images with consent and have a pharmacist independently transcribe every medicine, strength and form. Use a fixed holdout set containing printed and handwritten prescriptions, mixed Urdu/English, margins, multiple columns, poor photos, unsupported names and similar medicine names. Do not use model-generated labels as truth.

Both input files are arrays of records with unique ids. Example shape (synthetic, not accuracy evidence):

~~~json
[
  {
    "id": "redacted-001",
    "medicines": [
      {"name": "Panadol", "strength": "500mg", "form": "Tablet"},
      {"name": "Risek", "strength": "20mg", "form": "Capsule"}
    ]
  }
]
~~~

For predictions, export the model pipeline output **before manual corrections**, using displayed candidate name/strength/form and unreadable flag. Include all extra entries and duplicates; do not discard failures. Optional per-prescription latency_ms and provider_attempts measure efficiency. Missing prediction ids count as failures. Compare baseline and updated pipelines using identical images and labels. Names/attributes are matched exactly after case and whitespace normalization; clinically meaningful brand/generic equivalences must be decided by the reviewing pharmacist, not silently inferred by this evaluator. Missing reference attributes are not graded. Repeated-name entries are counted separately. Names and strengths with different units require reference normalization before evaluation.

~~~powershell
python scripts/evaluate_ocr.py reference.json baseline_predictions.json
python scripts/evaluate_ocr.py reference.json updated_predictions.json
~~~

This script is offline: it sends no images to an API and makes no billable provider calls. No real pharmacist-labelled dataset was supplied or run in this implementation. Consequently no new accuracy percentage, launch-readiness certification or bug-free guarantee is claimed. Model choice should be based on this benchmark, not model-name assumptions. The existing google.generativeai SDK emits its existing deprecation warning; SDK migration is a separate remaining maintenance task.


## DeadlineExceeded fix — 2026-10-11

The OCR previously hard-coded a 28-second RPC deadline while also using the shared 28-second chat/audio gate. Slow provider responses could exhaust both model attempts and return 503. OCR now has separate validated configuration; chat/audio defaults stay unchanged. Queue wait consumes the total scan budget but does not consume the provider processing deadline. SDK request options explicitly disable internal retries; fallback and the four-attempt limit are controlled by the application. Logs include elapsed time and the actual provider deadline without prescription content. Final deadline failures return a helpful 503 with Retry-After: 5; failed coverage checks retain available candidates with mandatory review warnings. No automatic browser retry is added, avoiding accidental duplicate scan costs.

Optional values in apps/api/.env (the defaults already apply without editing it):

~~~dotenv
OCR_REQUEST_TIMEOUT_SECONDS=60
OCR_TOTAL_TIMEOUT_SECONDS=150
~~~

Restart the backend to load the new settings. No database migration is required. Provider availability, network speed and handwriting quality are external factors; this fix does not guarantee that Google will always respond within the configured deadline. Controlled tests used mocked providers, not live patient images or billable API calls.

## Medicine-name and product-form follow-up (local)

- Removed the prompt and normalization fallback that turned unspecified forms into Tablet. Recognize written Bar/soap, Cream, Ointment, Gel and Lotion, including product-form words embedded in names. A raw-line form conflicting with the model's form remains flagged for image review.
- The coverage pass now sees unenhanced, oriented original pixels and no previous names. It prefers the other configured model where available. Zero-temperature extraction reduces sampling variation but does not guarantee identical or correct readings.
- Conflicting names now receive targeted detail retries even if the whole-page count is complete. Compare original names before catalog corrections can hide disagreements. Prefer a blind audit reading only if a legible detail reading corroborates it without catalog spelling substitution; retain the previous reading and require confirmation. Clear directions associated with the rejected reading.
- Added Bar/Gel/Lotion to the review editor and a trilingual form-disagreement warning. Manual correction clears the old disagreement flag. The cache version changed, so older cached readings are not reused.
- There is no hardcoded Oilum/Oilatum replacement, no new catalog facts or prices, and no prescription-specific runtime answer. Regression fixtures exercise these distinct names and other unsupported products. A correct product form alone does not establish a correct brand name.

Verification: 265 backend tests passed, including 69 OCR regressions; TypeScript `tsc --noEmit` and `node scripts/test-ocr-review.mjs` passed. Existing SDK/ORM deprecation warnings remain. Program tests do not establish a handwriting accuracy percentage.

A fresh auto-mode scan of the supplied prescription1.jpeg also completed against the real Gemini API: eight candidates, including Oilum Bar. The primary model returned ServiceUnavailable; fallback completed extraction and independent coverage reading within the four-attempt cap. Other uncertain readings remained visible, including Cubriderm and strength/form disagreements. This is one successful sample, not a pharmacist-validated transcription or a repeatability benchmark. The restricted-network attempt failed before the successful network-enabled check. No app servers were started, and no deployment or live database changes were made.

## Quality-model integration and access check (supersedes older model defaults)

OCR now uses google-genai >=2.19,<3 through ocr_provider.py. Chat/audio/embeddings retain their existing code and settings. The OCR primary is models/gemini-4-argon, followed by explicitly configured models/gemini-3.1-pro-preview and models/gemini-3.8-flash. Change these with GEMINI_OCR_MODEL and GEMINI_OCR_FALLBACK_MODELS; OCR_THINKING_LEVEL accepts low/medium/high (default medium). The image processing resolution is HIGH and the token ceiling is 32,768 so thinking does not immediately consume a small output allowance. No sampling parameters are supplied. Default OCR processing deadline is 90 seconds per attempt within the existing 150-second total budget; frontend OCR timeout remains 180 seconds. Environment overrides take precedence.

The blind audit uses the same configured quality order. If any fallback is used, the response explicitly warns the user and requires review; it is not cached as a clean result. The four-attempt bound still includes failed model calls, so quota failures can leave no detail-crop budget. Catalog fuzzy spelling suggestions are now separate from the original displayed name and cannot inject a suggested generic into the transcription. Older cache entries are invalidated by quality-model-original-reading-v4 and model/thinking configuration fingerprints.

Real access checks on the configured API key: both gemini-4-argon and gemini-3.1-pro-preview returned 429 with generate_content_free_tier request/input-token limits of 0. gemini-3.8-flash returned 503 during the comparison. Consequently no stronger-model medicine reading or accuracy improvement was validated on this key. A zero model allowance requires model access/quota (Argon requires a paid Gemini API project); repeated OCR prompt changes cannot grant that access. No billing plan or key was changed.

Run explicit, bounded model comparisons on consented images from apps/api (makes up to three billable calls per run; no names are supplied as expected answers):

~~~powershell
python ../../scripts/compare_ocr_models.py ../../prescription1.jpeg
# After model quota/access is available, exercise the production OCR pipeline:
python ../../scripts/compare_ocr_models.py ../../prescription1.jpeg --pipeline
~~~

The script reports original readings, forms, strengths, suggestions, model names, latency and sanitized provider errors. It does not grade handwriting accuracy; use the pharmacist-labelled offline benchmark for that. OCR SDK contract tests cover high-resolution reasoning configuration, one transport attempt, deadline units, cancellation cleanup, original-name preservation and visible fallback review. Verification: 271 backend tests passed (existing SDK/ORM deprecation warnings remain), TypeScript tsc --noEmit passed, and the frontend OCR review regression script passed. Stronger-model live accuracy remains unverified because of the observed zero model quota. No production build or deployment was performed for this backend-focused change.

## Reliability and medication products (2026-10-16, latest)

The configured local environment currently selects Flash 3.8 without fallbacks; the quality-model defaults above still apply only when not overridden. This follow-up did not change the local environment, API key, billing, chat model, clinical-summary behavior or deployments.

- Fixed the single-model transient-failure path: configured alternatives are tried first, followed by one retry per transiently failing model. Backoff is one second plus jitter outside the shared AI slot. The existing four-provider-call and total-deadline caps still cover all extraction, audit and detail requests. Provider coroutines now also enforce the per-attempt deadline. Request-task cancellation interrupts backend waits/backoff. Browser removal cancels local token/upload waits and ignores late results; it does not guarantee cancellation of the backend request task or an already-started remote provider job.
- Quota and hard model-access/configuration errors are skipped for the rest of the request. They do not enter a retry loop. Existing quota cooldown remains. Logs now show safe status/category/attempt metadata without raw provider messages, patient text or keys. The API distinguishes quota, timeout, temporary unavailability and configuration errors, with Retry-After where appropriate. Successful primary candidates remain visible if later checks fail.
- Expanded product extraction prompts, normalization and the review editor to Spray, Shampoo, Solution, Wash, Mouthwash, Powder, Patch, Suppository, Pessary, Paste, Foam and Emulsion, alongside Bar, Lotion, Cream, Gel, Ointment and existing oral/injectable forms. Unsupported brands stay visible and forms without evidence remain unknown. No hardcoded prescription answer or invented catalog records were added.
- Fixed inline strength parsing that left `/5ml`, percentages, or duplicate supplied strengths in the medicine name. Strength disagreements remain unconfirmed. Form-only readings and invalid boolean fields cannot masquerade as legible medication names.
- Backend audit and frontend region-rescan merging now choose the best overlapping box with one-to-one line assignment. Two overlapping new lines cannot overwrite the same old row. Disagreements remain visible and unverified.
- Bounded the pre-upload OCR token lookup to ten seconds and connected it to image-removal cancellation, so a stalled sign-in request cannot leave the scan waiting indefinitely before fetch. Other endpoint token behavior is unchanged. Cache version is medication-products-retry-v5.

Live verification on the supplied prescription: the configured Flash 3.8 pipeline returned HTTP 503 high demand on both its initial call and retry. A second bounded pipeline check with a process-only Flash 3.6 fallback returned 429 for Flash 3.8 and 503 on both Flash 3.6 attempts. The alternate configuration was not persisted. These checks validated failure classification/retries but did not produce a successful new transcription. They do not establish a global provider outage or a handwriting accuracy improvement. No further live retries were made to avoid wasting quota. A successful representative, pharmacist-labelled evaluation is still needed before claiming launch readiness.

Local verification includes backend OCR/provider/API/merging regressions, frontend OCR review and image-removal scripts, API error/token cancellation tests, cabinet price regressions, TypeScript and an optimized Webpack production build. The build succeeds with the existing middleware-convention deprecation warning. No app server was started for this follow-up; browser end-to-end accuracy was not revalidated while provider calls were unavailable.

Final verification results: the full backend run passed 307 tests (9,540 existing SDK/ORM warnings). A subsequent focused reliability run passed all 40 tests, including four additional billing/transport classification cases added after the full run's collection; this focused count overlaps the full suite. Frontend OCR review, prescription upload/removal, API errors and cabinet price scripts all passed, as did TypeScript and the production Webpack build. No application servers were left running by this work.

## Interactive OCR latency follow-up (2026-10-16, latest)

The previous policy could wait 90 seconds on a retry, read every page repeatedly, then hide the transcription until catalog matching finished. This follow-up changes that interactive behavior locally:

- Auto/fast scans have a 65-second provider/queue budget, up to 40 seconds for the first reading and 15 seconds for review calls. A retry after transient unavailability/malformed output is capped at 12 seconds. A timed-out model is skipped for the rest of that scan rather than starting another potentially billable copy of its remote job. Overall upload/token/image processing overhead is separate. Thorough rescans retain the longer 150/90-second limits; chat is unchanged.
- Clear, count-complete auto readings can return after one call when all reported legibilities are at least .9, names/forms have no detected uncertainty and there are no image warnings. This reduces checks and is not an accuracy guarantee. The response explicitly says coverage was not independently checked, requires human review and keeps every candidate unverified. Uncertain, missing, zero-product and low-confidence first readings still trigger coverage checks. Thorough/forced-fresh scans request coverage. OCR_AUTO_VERIFY_CLEAR=true restores the previous always-audit auto behavior.
- Complete, readable primary-model results requiring review can be reused for five minutes in a bounded memory-only cache, preserving warnings, alternatives and confirmation flags. Failed/incomplete/unreadable/low-confidence/form-conflicting/fallback results are excluded. The existing clean-result disk cache stays at 24 hours. Fresh scan bypasses both caches. Cache version is interactive-budget-v6.
- Concurrent identical normal uploads share one task, return deep copies and release the registry on success/error/cancellation. One cancelled waiter does not cancel another; the last cancellation stops local work. Immediate remove/re-upload does not inherit a cancelling task. Remote provider cancellation is not guaranteed.
- The website displays names as soon as OCR returns instead of waiting for catalog lookup. OCR matching has an eight-second request budget including token lookup; failures retain the unverified names. Existing review gates and stale-result/removal guards remain. Normal browser OCR upload timeout is 90 seconds; thorough remains 180 seconds.

New settings are documented in apps/api/.env.example; existing 90/150 general environment values cannot override the smaller auto limits. The actual local key, model order, thinking level, clinical-summary prompt, image resolution, database and deployments were not changed. No model was silently substituted to meet a speed target.

Live evidence: the initial new normal pipeline check enforced 40 seconds on Flash 3.8 and 12 seconds on its retry, failing in 53.59 seconds with no transcription. The final policy subsequently removed same-model timeout retries; that rule is covered by controlled timing tests. A single Flash-Lite diagnostic returned eight candidates in 9.98 seconds but included incorrect readings such as Dilum Bar for the user's known Oilum Bar. It was not enabled. One Flash 3.6 diagnostic returned provider HTTP 503 high demand in 10.8 seconds. No successful new main-pipeline handwriting accuracy or throughput benchmark was established. These observations do not prove a global provider outage, nor guarantee a key/model change fixes availability.

The diagnostic script supports --pipeline --allow-cache for normal interactive policy and --timeout for a bounded isolated model call. Its default pipeline command remains an intentional fresh coverage scan. Provider status and model accuracy must be evaluated separately before public launch.

Verification: full backend suite 321 passed (9,539 existing warnings); the subsequent focused latency/race suite passed all 11 tests including the immediate re-upload cancellation guard. Frontend API-error/deadline, prescription-upload, OCR-review and cabinet-price scripts passed. TypeScript and optimized production Webpack build passed; existing middleware deprecation remains. Patch formatting check passed. No application servers were started/left running, and no push, deployment or live database changes were made.

## Isolating vision failures (2026-10-16)

Added scripts/diagnose_ocr_provider.py, a bounded explicit diagnostic that changes no application settings and never logs keys or provider payloads. It queries configured model metadata, tests a tiny JSON text request, then a short image-transcription prompt on the supplied image. --full compares the production prompt only after successful baselines. --synthetic-only uses a generated TEST 123 image rather than uploading the prescription. It disables SDK retries, applies coroutine deadlines and stops after a failed baseline.

Observed with the configured Flash 3.8 key/model: metadata succeeded in 0.48 seconds, a tiny text request correctly returned JSON in 2.77 seconds, but the simple prescription image request timed out at 30 seconds. The production-prompt comparison was therefore skipped. A separate synthetic-only check got metadata in 1.14 seconds and received HTTP 503 on the tiny printed image in 1.09 seconds. No clinical prompt or patient image was in that failing generation call. This shows failure is not confined to the application's clinical prompt/handwriting workload; it does not prove a global Gemini outage or exclude all client/network factors. Text access works, while image generation was unreliable in these observed requests. Model/provider capacity and handwriting accuracy need independent evaluation; billing alone is not an availability guarantee. No provider/model/key/billing/deployment changes were made. Diagnostic syntax compilation passed; production code was unchanged in this diagnostic follow-up.

## Free-only constraint and fallback evaluation (latest)

The user has confirmed they currently have only a free Gemini API key. Do not enable billing, require a paid-only model or ask the same budget question again. The saved local configuration remains Flash 3.8 with an empty fallback list. Provider metadata listing was checked with --list-models; metadata visibility does not establish free generation quota. Listing handles errors with safe status/category output and uploads no image.

A documented free-tier Flash 3.1 Lite isolated reading completed in 10.14 seconds and returned eight candidates, including the user-confirmed Oilum Bar, but other names/forms were uncertain or incomplete. A process-only fallback pipeline trial completed in 54.59 seconds: primary Flash 3.8 returned 503, the fallback extracted candidates, an audit re-probed primary and wasted 15 seconds on a timeout, then fallback finished coverage. Its eight-line count merged into eleven candidates with duplicates/conflicts. Review gates preserved uncertainty; this was not a validated transcription. This fallback was NOT persisted or automatically enabled.

Fixed the independently observed wasted-call issue: when a configured fallback succeeds, models that returned unavailability/network errors in that reading are skipped in subsequent audit/detail phases for the same scan. A primary that recovers on its own retry remains eligible. This saves a provider attempt for useful reading/detail work without changing the selected model or discarding uncertain candidates. The four-call/deadline limits, fallback warning and mandatory review remain unchanged. It does not fix provider uptime or the weak model's handwriting accuracy. The comparison report now includes review, coverage and warning metadata so future evaluations do not confuse transport success with verified extraction. All changes remain local.

Verification for this routing follow-up: all 127 OCR/provider/pipeline/latency regressions passed, including skipping a failed primary after successful fallback and keeping a primary eligible after its own recovery. Diagnostic/comparison script compilation and patch formatting checks passed. Frontend, database schema, saved model/key settings and deployment were not changed; no live service availability or accuracy guarantee is established.
