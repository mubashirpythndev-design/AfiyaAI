# Local-first prescription OCR

## Request flow

`POST /api/ocr/extract` validates the image, then runs a lazy, process-local
`rapidocr-onnxruntime==1.4.4` engine before any cloud call. The wheel includes
PP-OCRv4 detection and recognition weights; scan requests do not download models.
The engine uses CPU inference, four intra-op threads, one inter-op thread and a
736-pixel detector limit. Native inference and preprocessing run off the event
loop. One executor worker bounds CPU jobs; concurrent identical uploads share it.
Its last completed text reading can be reused for five minutes. Fresh scans bypass
completed results. The singleton and its mutable detection settings are protected
by a lock. An abandoned native call is not falsely described as cancelled.

The local request stage waits at most 1.5 seconds. If inference is still running,
or a different document occupies the worker, return the pharmacist handoff
immediately, without adding a cloud timeout. The single native job finishes in the
background, and a later retry can use the actual reading. No native job queue or
unbounded image cache is created. This speed-first policy is necessary because
the real handwritten sample does not meet the native latency target.

With a Gemini key deliberately unset, measured coordinator response times were
1.515 s (cold printed sample handoff) and 1.513 s (handwritten sample handoff).
Retries after native completion took 0.002 s and 0.006 s respectively. These
retry figures measure reuse of actual text, not fresh sub-second recognition.

If timely local OCR produces medicine candidates, return immediately with zero
Gemini calls. If it finishes with no usable candidates, and a Gemini key is
configured, try the unchanged ordered cloud chain:

1. `gemini-3.5-flash-lite`
2. `gemini-3.1-flash-lite`
3. `gemini-3.8-flash`

Cloud failures or a missing key yield a valid HTTP 200 `OCRResponse` with empty
candidates, `engine: "concierge"`, `fallback_available: true`,
`error: "OCR_SERVICE_BUSY"` and a manual-review message. The frontend recognizes
this successful handoff payload and displays the existing direct pharmacist
submission button with the original image. Old HTTP 503/429 responses remain
recognized for compatibility. Malformed/oversized images still receive HTTP 400.

## Parsing and catalog facts

Keep every recognized product line with strength, dosage form, frequency, Rx
prefix or catalog name evidence, including out-of-catalog products. Support bars,
lotions, creams and other medication forms as well as oral medicines. Filter
obvious administrative text and standalone directions. Join nearby same-row text
fragments without merging distant columns or two complete strength-bearing lines.
The existing 80-candidate safety bound remains in effect.

Resolve catalog names using the database session and existing matching service.
Keep original OCR text and suggestions separate. Attach stored medicine metadata,
candidate choices, current notified MRP/pack and inventory stock where available.
Unknown products never receive guessed catalog IDs, prices, strengths or forms.
Low-confidence/ambiguous matches stay unverified; all local candidates require
image confirmation. `verification_performed` stays false: a fast local reading
does not establish complete prescription coverage. Existing checkout, Rx review
and user confirmation gates remain unchanged.

## Measured limits

Measurements on this workstation, with network access disabled:

| Native inference sample | Cold / first call | Warm calls | Usable medicine candidates |
| --- | --- | --- | --- |
| Printed synthetic prescription | 3.966 s | 1.362 s, 1.190 s | 3 of 3 |
| `prescription1.jpeg`, handwritten | 12.722 s | 12.896 s, 9.982 s | 0 |

Therefore native sub-second extraction and reliable recognition of arbitrary
handwriting have **not** been demonstrated. The 1.5-second request budget controls
user waiting; it does not make native inference faster. Database/network latency,
image upload/validation and response serialization are outside that native-stage
budget. Timely zero-candidate scans that invoke Gemini can still take the cloud
deadlines described in spec 15. The pharmacist option bypasses that wait.

Run `python scripts/benchmark_local_ocr.py` for native timings with no dotenv
loading, provider calls or prescription text output. The printed sample is generated
locally; the handwritten sample is included only when present in the workspace.
Mocked-engine/database tests establish orchestration and schema behavior, not
handwriting accuracy. Full backend and frontend regression checks remain required.
