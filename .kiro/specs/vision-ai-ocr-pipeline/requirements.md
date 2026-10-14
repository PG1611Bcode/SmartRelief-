# Requirements Document

## Introduction

The Vision AI OCR Pipeline adds image-based need reporting to the SmartRelief humanitarian aid platform. Field workers can photograph handwritten or printed aid request forms using their mobile device camera or upload an image from their gallery. The image is sent to an NVIDIA-hosted vision language model (Llama 3.2 90B Vision Instruct) which extracts structured data — description, location, and people affected — and automatically populates the NeedsIntake form. The feature is an enhancement: the form remains fully functional without an image, and all auto-filled values are editable before submission.

## Glossary

- **OCR_Pipeline**: The end-to-end feature comprising the frontend image capture component, the `/api/needs/ocr` backend endpoint, and the NVIDIA Vision LLM integration.
- **NeedsIntake**: The existing React page (`src/pages/dashboard/NeedsIntake.jsx`) where humanitarian needs are reported.
- **Upload_Zone**: The image capture UI section rendered above the existing form fields in NeedsIntake.
- **Base64_Encoder**: The frontend FileReader-based utility that converts a selected image file into a raw Base64 string (data URL prefix stripped).
- **OCR_Endpoint**: The `POST /api/needs/ocr` FastAPI route in `backend/main.py`.
- **Vision_LLM**: The `meta/llama-3.2-90b-vision-instruct` model accessed via the NVIDIA NIM API at `https://integrate.api.nvidia.com/v1`.
- **JSON_Extractor**: The backend utility that parses the Vision_LLM response text into a structured JSON object, with a regex-based fallback.
- **OCR_Response**: The validated JSON object returned by the OCR_Endpoint with the schema `{"description": string, "location": string, "people_affected": integer}`.
- **Auto_Fill**: The frontend behavior that maps OCR_Response fields to NeedsIntake form state setters after a successful OCR call.

---

## Requirements

### Requirement 1: Image Capture and Base64 Conversion

**User Story:** As a field worker, I want to photograph or upload an image of a handwritten aid request form, so that the platform can automatically extract the need details without manual typing.

#### Acceptance Criteria

1. THE Upload_Zone SHALL render a file input element with `accept="image/*"` and `capture="environment"` attributes so it activates the rear camera on mobile devices and the standard file picker on desktop.
2. THE Upload_Zone SHALL display a primary label "Take Photo or Upload Image" and a secondary label "AI will extract the need details automatically" to communicate its purpose.
3. THE Upload_Zone SHALL be styled as a visually prominent rounded bordered area consistent with the existing glassmorphism design, positioned above the existing NeedsIntake form fields.
4. WHEN a file is selected, THE Base64_Encoder SHALL read the file using the FileReader API `readAsDataURL` method and strip the data URL prefix so only the raw Base64 string is produced.
5. WHEN a file is selected, THE Upload_Zone SHALL display a thumbnail preview of the selected image inside the upload zone so the user can confirm the correct image was chosen.
6. WHEN the Base64_Encoder produces a raw Base64 string, THE NeedsIntake SHALL automatically trigger the OCR_Endpoint call without requiring a separate button press.
7. WHILE an OCR request is in flight, THE NeedsIntake SHALL display a loading indicator over the form fields to signal that extraction is in progress.
8. WHEN a new image is selected while an OCR request is in flight, THE NeedsIntake SHALL cancel the pending loading state and initiate a fresh OCR request with the new image.
9. WHILE no image has been selected, THE NeedsIntake SHALL function normally and allow form submission without any image — image capture is an enhancement, not a requirement for submission.

---

### Requirement 2: Vision OCR Backend Endpoint

**User Story:** As the SmartRelief platform, I want a backend endpoint that accepts a Base64-encoded image and returns structured extracted data, so that the frontend can auto-fill the needs form.

#### Acceptance Criteria

1. THE OCR_Endpoint SHALL accept `POST /api/needs/ocr` requests with a JSON body containing a single field holding the raw Base64 image string.
2. WHEN the `NVIDIA_API_KEY` environment variable is absent or empty at request time, THE OCR_Endpoint SHALL return HTTP 503 with a descriptive error message rather than raising an unhandled exception.
3. THE OCR_Endpoint SHALL initialize the OpenAI-compatible client with `base_url="https://integrate.api.nvidia.com/v1"` and `api_key` set to the value of `NVIDIA_API_KEY`.
4. WHEN processing a request, THE OCR_Endpoint SHALL call the Vision_LLM using the `meta/llama-3.2-90b-vision-instruct` model with a messages payload that includes an image content block constructed as a data URI in the format `data:image/jpeg;base64,{base64_string}` alongside the text prompt content item.
5. THE OCR_Endpoint SHALL set `max_tokens` to 500 and `temperature` to 0 for deterministic extraction output.
6. THE OCR_Endpoint SHALL use a standard blocking (non-streaming) completion call and await the full response before processing.

---

### Requirement 3: Structured JSON Extraction via System Prompt

**User Story:** As the SmartRelief platform, I want the Vision LLM to return only a valid JSON object matching a defined schema, so that the backend can reliably parse and validate the extracted data.

#### Acceptance Criteria

1. THE OCR_Endpoint SHALL send a system prompt that instructs the Vision_LLM that it is an OCR data extraction engine for a humanitarian aid platform, that its sole function is to extract structured information from the provided image, and that it must respond with only a valid JSON object with no preamble, explanation, markdown code fences, or trailing text.
2. THE OCR_Endpoint SHALL require the Vision_LLM output to conform to the schema `{"description": "full extracted text describing the need or situation", "location": "extracted or inferred location name, city, or region — empty string if not found", "people_affected": integer representing number of people affected or 0 if not determinable}`.
3. THE OCR_Endpoint SHALL send a user prompt alongside the image instructing the Vision_LLM to extract all readable text and map it to the schema fields, inferring `people_affected` from numeric references and `location` from place names, landmarks, or geographic references.
4. WHEN the Vision_LLM response text is valid JSON, THE JSON_Extractor SHALL parse it directly into the OCR_Response object.
5. WHEN direct JSON parsing fails, THE JSON_Extractor SHALL attempt to extract a JSON object from within the response string by finding the substring from the first `{` to the last `}` and retrying the parse.
6. IF JSON parsing fails after the fallback extraction attempt, THEN THE OCR_Endpoint SHALL return HTTP 422 with a body containing `{"detail": "OCR extraction failed to produce valid JSON", "raw_response": "<model output>"}`.
7. WHEN JSON parsing succeeds, THE JSON_Extractor SHALL validate that all three keys (`description`, `location`, `people_affected`) are present in the parsed object.
8. WHEN `people_affected` in the parsed object is a string representation of an integer, THE JSON_Extractor SHALL coerce it to an integer type.
9. WHEN validation and coercion succeed, THE OCR_Endpoint SHALL return HTTP 200 with the validated OCR_Response object.

---

### Requirement 4: Auto-Fill Form Fields from OCR Response

**User Story:** As a field worker, I want the form fields to be automatically populated from the OCR result, so that I can review and submit the need report with minimal manual effort.

#### Acceptance Criteria

1. WHEN the OCR_Endpoint returns HTTP 200, THE Auto_Fill SHALL map the `description` field from OCR_Response to the `needs_description` textarea state variable in NeedsIntake.
2. WHEN the OCR_Endpoint returns HTTP 200, THE Auto_Fill SHALL map the `location` field from OCR_Response to the `location` text input state variable in NeedsIntake.
3. WHEN the OCR_Endpoint returns HTTP 200 and `people_affected` is greater than 0, THE Auto_Fill SHALL map the `people_affected` field from OCR_Response to the `estimated_people_affected` number input state variable in NeedsIntake.
4. WHEN the OCR_Endpoint returns HTTP 200 and `people_affected` is 0, THE Auto_Fill SHALL leave the `estimated_people_affected` field empty rather than populating it with zero.
5. THE Auto_Fill SHALL apply field values by calling the existing React state setters — it SHALL NOT manipulate the DOM directly.
6. WHEN auto-fill completes, THE NeedsIntake SHALL remove the loading indicator and display a dismissible success banner reading "AI extracted the details below — please review before submitting", styled with the emerald accent color and a checkmark icon.
7. AFTER auto-fill, THE NeedsIntake SHALL allow the user to freely edit any auto-filled field before submitting — auto-filled fields SHALL NOT be read-only or locked.
8. WHEN the OCR_Endpoint returns HTTP 422 or any error status, THE NeedsIntake SHALL remove the loading indicator and display an inline error message inside the Upload_Zone reading "Could not extract text from this image — please fill in the details manually".
9. WHEN the OCR_Endpoint returns an error, THE NeedsIntake SHALL leave all form fields unchanged so the user can proceed with manual entry.

---

### Requirement 5: Environment Configuration

**User Story:** As a developer deploying SmartRelief, I want clear instructions for configuring the NVIDIA API key, so that the OCR pipeline can be activated without guesswork.

#### Acceptance Criteria

1. THE OCR_Endpoint SHALL load `NVIDIA_API_KEY` via `os.getenv("NVIDIA_API_KEY")` after `load_dotenv()` is called.
2. THE `backend/.env` file SHALL contain an `NVIDIA_API_KEY` entry with a comment instructing the developer to paste their key obtained from `https://integrate.api.nvidia.com`.
3. THE `backend/requirements.txt` SHALL include the `openai` package so the OpenAI-compatible client is available for the NVIDIA NIM API calls.
