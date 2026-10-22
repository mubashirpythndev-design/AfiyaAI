# Local feature QA — 2026-10-12

This review uses a local Next.js production preview and FastAPI with the isolated SQLite database `.local/feature-qa.db`. The supplied prescription was tested through the API and Chrome upload control. Existing Gemini and Clerk integrations were used; no code was pushed, no site was deployed, and no live Neon database was changed. Existing unrelated working-tree changes were retained.

## Defects corrected

- JSON, OCR and voice uploads share readable connection/outage errors and bounded request timeouts, including response-body delivery. HTML proxy errors, invalid/empty JSON and validation detail arrays no longer produce misleading raw exceptions. A 401 retry now uses the retry's actual status rather than treating a later 503 as an authentication failure.
- Price checking initially displays the stored pack size. Editing quantity, unit or price clears the prior result. Switching medicine remounts the checker so another brand's result cannot remain visible. The selected stored package is included in the baseline request.
- Cabinet reminder changes update only reminder fields; instruction changes update only instruction fields. Overlapping reminder toggles are blocked during saves, and buttons expose their selected state to accessibility tools.
- Category browsing returns a safety assessment per medicine. Cards no longer reuse the previous search's registration number and risk badge. Removed an invented fixed '3 Brands' count.
- OCR review labels distinguish pending human review from an absent catalog match. Existing confirmation/mismatch gates remain. Batch save failures are shown to the user instead of being console-only.
- Removed remaining unsupported official-verification/bioequivalence claims in comparison/generic views and feedback descriptions. This does not verify the underlying records or change clinical generation.
- Corrected the local frontend launcher to use Webpack and localhost, consistent with Clerk and the API origin. Successful detail/price retries clear earlier errors. Improved dark-theme success badge contrast.

## Verification

| Area | Evidence |
| --- | --- |
| Backend regressions | Full isolated suite: 247 passed. Subsequently, category-specific safety regression plus four voice regressions: 5 passed (four repeat tests; 248 distinct backend cases overall). |
| Frontend API handling | scripts/test-api-errors.mjs passes network failures for JSON/OCR/voice, header/body timeouts, proxy HTML, validation messages, expired-token retry status and 204 deletion. |
| Cabinet pricing | scripts/test-cabinet-prices.mjs passes proportional/whole-pack prices, rounding, multi-item totals, savings, unavailable data and actual selector rendering. |
| OCR review | scripts/test-ocr-review.mjs passes bounded matching, review/mismatch/LASA gates, conflict recovery and actual review rendering in three languages. |
| Build | Production Webpack build and TypeScript compilation passed. |
| Lint | Changed client/components checked: zero errors, eight existing-pattern warnings (unused feedback state/imports and effect-state/dependency warnings). |
| Search and directory | Panadol brand, Paracetamol generic, unsupported query and category navigation worked in Chrome. Category records now show different registration numbers; Brufen displays Caution rather than Panadol's OTC badge. |
| Medical info and prices | Database information/source links, compatible alternative prices and switching Panadol/Calpol loaded successfully. Initial pack is 10 tablets; changing units/brands clears old check results. |
| Cabinet | Individual and confirmed-prescription batch saves worked. Two strips of Panadol normalize to 20 tablets and PKR 145.40. Quantity, instructions and morning/night reminders persisted after reopening. Capsule/strip/pack options appeared for Risek. Incomplete quantities correctly leave the whole-cabinet budget unavailable. |
| Prescription | Supplied prescription1.jpeg returned HTTP 200 with eight candidates and eight model-counted lines, coverage review_required. Chrome upload completed and displayed review. Candidates absent from the limited catalog remained unmatched; no prices were invented. |
| Demo prescription | Three sample entries extracted; confirmation unlocked comparison/save actions and batch save added the sample medicines locally. |
| Chat | Live factual medicine query returned an answer with source/disclaimer. Backend tests cover refusal and unsafe-output replacement. |
| Feedback/admin | Synthetic qa@example.com feedback submitted successfully (201), appeared in admin summary/detail, search filters worked and user listing loaded. Backend tests cover non-admin rejection and allowlist revocation. No roles changed. |
| Error recovery | Intentionally stopped local backend: Chrome displayed a readable connection message. Restarted backend: search/category requests recovered. |
| UI controls | Six guide steps, mobile menu, English/Roman Urdu/Urdu and theme controls worked. Urdu renders RTL. At a 390px viewport, document width and scroll width both measured 385px, with no horizontal overflow. |

## Limits and follow-up

Passing these checks is not a guarantee of zero future bugs or perfect OCR accuracy. There is no pharmacist-labelled ground truth for this prescription; detecting eight entries does not prove each handwritten name, strength or instruction is correct. Existing clinical explanation generation is preserved as requested.

Camera capture on a real phone, live microphone speech quality and scheduled OS notification delivery still need device/permission testing. Notifications require the app to remain open. WhatsApp formatting was inspected; no prescription was sent to another person. Account signup/password/OTP changes and destructive admin actions were not performed against the user's account; API authorization and deletion behavior are covered by isolated regressions.

Gemini primary-provider ServiceUnavailable was observed during scan; existing fallback completed successfully. External provider/network/quota outages can still occur and should produce clear errors or fallback, not a promise of uninterrupted availability. Legacy Gemini SDK, Next.js middleware naming and datetime deprecation warnings remain. Production Vercel/Render/Neon environments and PostgreSQL migrations were not tested by this local run.

Evidence images in artifacts/feature-qa use local/synthetic cabinet data rather than exposing the supplied prescription's patient/doctor details.
