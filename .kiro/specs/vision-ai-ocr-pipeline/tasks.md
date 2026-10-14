# Implementation Plan: Vision AI OCR Pipeline

## Overview

Implement the end-to-end Vision AI OCR Pipeline for SmartRelief. The work splits into three tracks that build on each other: (1) backend Pydantic schemas and the `JSON_Extractor` helper, (2) the `POST /api/needs/ocr` FastAPI endpoint wired to the NVIDIA NIM API, and (3) the frontend `Upload_Zone` inside `NeedsIntake.jsx` with Base64 encoding, OCR fetch, and Auto_Fill. Each track is independently testable before the final wiring step.

## Tasks

- [x] 1. Add OCR Pydantic schemas to `backend/schemas.py`
  - Add `OCRRequest` model with `image_base64: str = Field(..., min_length=1)`
  - Add `OCRResponse` model with `description: str`, `location: str`, `people_affected: int`
  - Import `Field` from pydantic if not already imported (it is — confirm)
  - _Requirements: 2.1, 3.2_

- [x] 2. Add `openai` dependency and configure `NVIDIA_API_KEY`
  - Append `openai` to `backend/requirements.txt`
  - Confirm `NVIDIA_API_KEY=` entry already exists in `backend/.env` (it does — verify comment text matches Requirement 5.2)
  - _Requirements: 5.2, 5.3_

- [x] 3. Implement `extract_ocr_json` helper in `backend/main.py`
  - Write the `extract_ocr_json(raw: str) -> dict` function with direct-parse attempt followed by `{`…`}` substring fallback
  - Write the `validate_ocr_fields(parsed: dict) -> dict` function that checks all three required keys are present and coerces `people_affected` to `int` if it is a string
  - Place both functions in `backend/main.py` above the routes section
  - _Requirements: 3.4, 3.5, 3.7, 3.8_

  - [ ]* 3.1 Write property test — Property 2: JSON_Extractor accepts any valid schema-conforming JSON
    - Create `backend/tests/test_ocr_pipeline.py` with Hypothesis imports
    - **Property 2: JSON_Extractor accepts any valid schema-conforming JSON**
    - **Validates: Requirements 3.2, 3.4, 3.7, 3.8**

  - [ ]* 3.2 Write property test — Property 3: JSON_Extractor recovers embedded JSON from surrounding text
    - Add to `backend/tests/test_ocr_pipeline.py`
    - **Property 3: JSON_Extractor recovers embedded JSON from surrounding text**
    - **Validates: Requirements 3.5**

  - [ ]* 3.3 Write property test — Property 4: JSON_Extractor rejects objects missing required keys
    - Add to `backend/tests/test_ocr_pipeline.py`
    - **Property 4: JSON_Extractor rejects objects missing required keys**
    - **Validates: Requirements 3.7**

  - [ ]* 3.4 Write unit tests for `extract_ocr_json` and `validate_ocr_fields`
    - Happy path: valid JSON string → correct dict
    - Fallback extraction: JSON wrapped in markdown fences → correct extraction
    - Missing key rejection: JSON missing each required key → `ValueError` or `KeyError`
    - Type coercion: `people_affected` as `"42"` → `42` (int)
    - _Requirements: 3.4, 3.5, 3.7, 3.8_

- [x] 4. Implement `POST /api/needs/ocr` endpoint in `backend/main.py`
  - Import `openai` at the top of `main.py` (inside the route or at module level)
  - Add the route after the existing routes section
  - Guard: if `os.getenv("NVIDIA_API_KEY")` is absent or empty, return HTTP 503 with `{"detail": "NVIDIA_API_KEY is not configured."}`
  - Initialise `openai.OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=nvidia_key)`
  - Build the messages payload: system prompt (OCR extraction engine, JSON-only output, schema definition) + user message with image data URI block (`data:image/jpeg;base64,{base64_string}`) and text extraction instruction
  - Call `client.chat.completions.create(model="meta/llama-3.2-90b-vision-instruct", messages=..., max_tokens=500, temperature=0)`
  - Pass `choices[0].message.content` to `extract_ocr_json`, then `validate_ocr_fields`
  - On `ValueError` from extractor: return HTTP 422 with `{"detail": "OCR extraction failed to produce valid JSON", "raw_response": raw_text}`
  - On missing keys after validation: return HTTP 422 with `{"detail": "OCR response missing required fields."}`
  - On success: return HTTP 200 `OCRResponse`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.6, 3.9, 5.1_

  - [ ]* 4.1 Write unit tests for the OCR endpoint (mocked LLM)
    - 503 guard: endpoint called with `NVIDIA_API_KEY=""` → HTTP 503
    - 422 guard: mocked LLM returns `"not json"` → HTTP 422
    - 200 path: mocked LLM returns valid JSON → HTTP 200 with correct fields
    - _Requirements: 2.2, 3.6, 3.9_

- [x] 5. Checkpoint — backend tests pass
  - Ensure all tests in `backend/tests/` pass with `pytest backend/tests/`
  - Confirm the endpoint is reachable at `POST /api/needs/ocr` via `uvicorn backend.main:app --reload --port 8000`
  - Ask the user if any questions arise before proceeding to frontend work.

- [x] 6. Refactor `NeedsIntake.jsx` — replace mock OCR zone with real `Upload_Zone`
  - Add `previewUrl` state (`useState(null)`) and extend `ocrState` to include `'error'` variant (`'idle' | 'scanning' | 'done' | 'error'`)
  - Add `requestIdRef = useRef(0)` for the stale-request guard
  - Remove the `OCR_FILL` mock constant, `triggerScan` function, and `progress` / `setProgress` state
  - Replace the existing file `<input>` with one that has `accept="image/*"` and `capture="environment"` attributes
  - Update the drop-zone `onClick` handler to always allow re-selection (not gated on `ocrState === 'idle'`)
  - _Requirements: 1.1, 1.3, 1.9_

- [x] 7. Implement `encodeToBase64` utility and `handleFileChange` in `NeedsIntake.jsx`
  - Write the `encodeToBase64(file)` promise-based `FileReader` helper that strips the data URL prefix and resolves with the raw Base64 string
  - Implement `handleFileChange(e)` using the stale-request guard pattern (`requestIdRef`):
    - Set `previewUrl` via `URL.createObjectURL(file)`
    - Set `ocrState` to `'scanning'`
    - Encode to Base64, POST to `http://localhost:8000/api/needs/ocr`
    - On success: call Auto_Fill state setters, set `ocrState` to `'done'`
    - On error / non-OK response: set `ocrState` to `'error'`, leave form fields unchanged
    - Discard result if `requestIdRef.current !== myId` (stale guard)
  - _Requirements: 1.4, 1.6, 1.7, 1.8, 4.5, 4.9_

  - [ ]* 7.1 Write property test — Property 1: Base64 encoding strips the data URL prefix
    - Create `backend/tests/test_base64_encoder.py` (Python simulation of the JS logic)
    - **Property 1: Base64 encoding strips the data URL prefix**
    - **Validates: Requirements 1.4**

- [x] 8. Implement Auto_Fill logic in `NeedsIntake.jsx`
  - After a successful OCR response, call `setForm` to update `needs_description`, `location`, and (if `people_affected > 0`) `estimated_people_affected` as a string
  - Leave `estimated_people_affected` unchanged when `people_affected === 0`
  - Do not set any field to `readOnly`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 8.1 Write property test — Property 5: Auto_Fill maps all non-zero OCR fields to form state
    - Create `src/tests/NeedsIntake.autofill.test.jsx` using Vitest + fast-check
    - Extract the Auto_Fill mapping logic into a pure `applyAutoFill(setForm, ocrResponse)` helper for testability
    - **Property 5: Auto_Fill maps all non-zero OCR fields to form state**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 8.2 Write property test — Property 6: Form state is preserved on OCR error
    - Add to `src/tests/NeedsIntake.autofill.test.jsx`
    - Extract the error handler into a pure `handleOcrError(setForm, currentForm)` helper (no-op) for testability
    - **Property 6: Form state is preserved on OCR error**
    - **Validates: Requirements 4.9**

- [x] 9. Implement Upload_Zone UI states in `NeedsIntake.jsx`
  - `idle`: camera/upload icon, primary label "Take Photo or Upload Image", secondary label "AI will extract the need details automatically", dashed rounded border consistent with glassmorphism design
  - `scanning`: spinner + "Extracting details…" text, loading overlay over form fields
  - `done`: checkmark icon, dismissible success banner reading "AI extracted the details below — please review before submitting" styled with emerald accent (`#34D399`) and a `CheckCircle` icon
  - `error`: inline error message inside the Upload_Zone reading "Could not extract text from this image — please fill in the details manually"
  - Thumbnail `<img>` rendered inside the zone using `previewUrl` when `previewUrl` is non-null (visible in all states after file selection)
  - _Requirements: 1.2, 1.3, 1.5, 1.7, 4.6, 4.8_

  - [ ]* 9.1 Write component tests for `NeedsIntake` Upload_Zone (Vitest + React Testing Library)
    - Assert file input has `accept="image/*"` and `capture="environment"`
    - Simulate file selection → assert thumbnail `<img>` appears
    - Mock successful OCR fetch → assert form fields are populated and success banner is visible
    - Mock failed OCR fetch → assert error message appears inside Upload_Zone
    - Assert auto-filled fields are not `readOnly`
    - _Requirements: 1.1, 1.2, 1.5, 4.6, 4.7, 4.8_

- [x] 10. Final checkpoint — full pipeline wired and verified
  - Ensure all backend tests pass: `pytest backend/tests/`
  - Ensure all frontend tests pass: `npx vitest --run`
  - Manually verify the Upload_Zone renders correctly in the NeedsIntake page (idle state, labels, styling)
  - Ask the user if any questions arise before marking the feature complete.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 5 and 10) ensure incremental validation before moving to the next layer
- Property tests use **Hypothesis** (Python) for backend properties and **fast-check** (JS) for frontend properties
- The `openai` package is the only new backend dependency — it provides the OpenAI-compatible client for the NVIDIA NIM API
- The stale-request guard (`requestIdRef`) in task 7 is critical for correctness when a user rapidly re-selects images
- All auto-filled fields remain editable; no `readOnly` attributes are set
