# Local CPU prescription OCR and review UI

## Execution contract

`POST /api/ocr/extract` runs only local PP-OCRv4 via
`rapidocr-onnxruntime==1.4.4`. The upload flow never invokes Gemini, even when an
API key exists. Legacy private cloud helpers remain solely for compatibility and
regression tests; they are not part of the upload coordinator.

The local stage now allows 10 seconds instead of 1.5 seconds. One bounded worker
loads the lazy engine once, coalesces identical uploads and reuses its last actual
text reading for five minutes. A fresh scan bypasses a completed reading. A
10-second timeout does not pretend to kill native ONNX work: that single job can
finish in the background and serve a later retry. Different uploads do not build
an unbounded native job queue. Image upload, validation and database latency are
outside the native processing budget.

EXIF-oriented, size-validated images pass through the existing Pillow cleanup,
then into a contiguous uint8 OpenCV BGR array. Grayscale input is handled by RGB
normalization; genuinely low dynamic-range images receive CLAHE. Normal
high-contrast text keeps its existing pixel contrast. CPU inference is serialized
because the engine mutates detection settings. No weights are downloaded during
scanning; the installed wheel contains them.

## Results and safe fallback

Only genuinely recognized medication lines enter `candidates`. Unknown products
remain visible and unverified. Database matching attaches existing identities,
MRP/pack and stock where available. Original text and suggestions remain separate;
all names require confirmation against the image. A reading is not proof that all
prescription lines were found.

If no medicine is confirmed, preserve all actual recognized text in `raw_text`.
Return HTTP 200 with `fallback_available: true`, `engine: "concierge"` and a safe
manual-review message. Unexpected processing errors also return this structured
review state, without exposing exception payloads or returning HTTP 503/429.
Malformed/oversized inputs still return HTTP 400 before processing.

Optional `demo_catalog_items` are fetched from stored Panadol/Augmentin tablet
records. They are NOT prescription candidates, inferred medicines, treatment
recommendations or substitutes for unreadable text. Missing database records do
not cause fabricated examples or prices.

The frontend preserves this HTTP 200 review payload and always renders:

- Unverified recognized text, or an explicit no-readable-text explanation.
- A manual-entry form; names entered by the user are labelled as such and require
  exact catalog selection and prescription confirmation through the existing tray.
- The existing direct pharmacist handoff using the original image.
- A separate catalog demo, labelled **not my prescription** (expanded when stored examples exist). Its sample
  switch preview changes only component state: no real cart, prescription upload,
  checkout or order call occurs. Prices/switch options come from existing catalog
  data, and unavailable prices are never replaced with made-up values.

Review text and manually entered rows clear when the image changes or the user
signs out. No blank review screen depends on injecting invented prescription items.

## Verification and limitations

Tests cover reads completing beyond the former 1.5-second guard, a 10-second
configured window, uint8 three-channel arrays, no cloud calls in any coordinator
path, known/unknown products, raw text preservation, separately typed database
examples, clean HTTP 200 failures and isolated demo switch/manual-entry behavior.
Use `python scripts/run_backend_tests_isolated.py` and
`node scripts/build-web-isolated.cjs` without loading dotenv files.

`python scripts/benchmark_local_ocr.py --pipeline-only` measures actual local
request times with external connections blocked. A longer processing window does
not guarantee cursive handwriting recognition. An image with no confirmed
medicine names must remain a manual-review case, even for a hackathon demo.

Current local-only coordinator measurements: the printed sample returned all three
medicine candidates in 2.549 seconds; the handwritten sample completed in 8.632
seconds with no confirmed medicines. Both made zero cloud calls. The latter still
requires manual review; sample catalog cards are not extracted medicine results.
