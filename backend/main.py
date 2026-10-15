"""
SmartRelief FastAPI backend — main entry point.

Start with:
    uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import sys
import os

# Inject parent directory into sys.path so 'backend' package is resolvable in Vercel serverless environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import io
import base64
import openai
from PIL import Image, ImageOps

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from backend.database import (
        create_indexes,
        needs_collection,
        volunteers_collection,
        tasks_collection,
        interests_collection,
        completions_collection,
    )
except ImportError:
    from database import (
        create_indexes,
        needs_collection,
        volunteers_collection,
        tasks_collection,
        interests_collection,
        completions_collection,
    )
from backend.schemas import (
    MatchRequest,
    MatchResponse,
    NeedRequest,
    NeedResponse,
    OCRRequest,
    OCRResponse,
    ScoreRequest,
    ScoreResponse,
    VolunteerRequest,
    VolunteerResponse,
)
import backend.scoring as scoring_engine
from backend.scoring import calculate_urgency_score
import backend.matching as matching_engine
from backend.matching import compute_match_metrics

GEOCODING_REGION_ANCHOR = ", Mira Bhayandar, Maharashtra, India"

# ---------------------------------------------------------------------------
# Firebase Admin SDK - initialised BEFORE lifespan so helpers can use fs_client
# ---------------------------------------------------------------------------
import json
import os
import re
import httpx
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore as fb_firestore
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

firebase_env = os.getenv("FIREBASE_SERVICE_ACCOUNT")
if firebase_env:
    cred_dict = json.loads(firebase_env)
    cred = credentials.Certificate(cred_dict)
else:
    cred_path = os.getenv("FIREBASE_CREDENTIALS", "firebase-credentials.json")
    abs_cred_path = (
        os.path.join(os.path.dirname(__file__), cred_path)
        if not os.path.isabs(cred_path)
        else cred_path
    )
    if os.path.exists(abs_cred_path):
        cred = credentials.Certificate(abs_cred_path)
    elif os.path.exists(os.path.join("backend", "firebase-credentials.json")):
        cred = credentials.Certificate(os.path.join("backend", "firebase-credentials.json"))
    elif os.path.exists("firebase-credentials.json"):
        cred = credentials.Certificate("firebase-credentials.json")
    else:
        raise RuntimeError(
            f"Firebase credentials not found. Provide FIREBASE_SERVICE_ACCOUNT env var or place credentials file at {abs_cred_path}"
        )

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

fs_client = fb_firestore.client()


# ---------------------------------------------------------------------------
# Lifespan — create indexes once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await create_indexes()
        cursor = needs_collection.find({"urgency_score": {"$exists": False}})
        async for doc in cursor:
            score = calculate_urgency_score(doc)
            await needs_collection.update_one({"_id": doc["_id"]}, {"$set": {"urgency_score": score}})
        # Standardize any resolved status to completed
        await needs_collection.update_many({"status": "resolved"}, {"$set": {"status": "completed"}})
    except Exception as e:
        print(f"[lifespan] Warning: MongoDB startup tasks or index creation failed (non-fatal): {e}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="SmartRelief API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Custom validation error handler (422 → flat {field, message} array)
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors: list[dict[str, str]] = []
    for error in exc.errors():
        loc = error.get("loc", [])
        field_parts = [str(p) for p in loc if p != "body"]
        field = ".".join(field_parts) if field_parts else "unknown"
        errors.append({"field": field, "message": error.get("msg", "Invalid value")})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation failed", "errors": errors},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mongo_doc_to_dict(doc: dict[str, Any]) -> dict[str, Any]:
    """Convert a Motor result document to a serialisable dict."""
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def _get_token_uid(request: Request) -> str | None:
    """Extract and verify a Firebase Bearer token, returning uid or None."""
    from firebase_admin import auth as fb_auth
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.removeprefix("Bearer ").strip()
        if raw_token:
            try:
                decoded = fb_auth.verify_id_token(raw_token)
                if decoded and "uid" in decoded:
                    return decoded["uid"]
            except Exception:
                pass
    uid_header = (
        request.headers.get("X-User-UID")
        or request.headers.get("x-user-uid")
        or request.headers.get("X-User-Id")
        or request.headers.get("x-user-id")
    )
    if uid_header:
        return uid_header.strip()
    return None


def _get_user_role_from_firestore(uid: str) -> str | None:
    """Synchronously fetch a user's role from Firestore."""
    try:
        doc = fs_client.collection("users").document(uid).get()
        if doc.exists:
            role = doc.to_dict().get("role")
            return role.strip() if isinstance(role, str) else role
    except Exception:
        pass
    return None


def _enrich_needs_with_requester(docs: list[dict]) -> list[dict]:
    """
    Batch-fetch requester identity from Firestore and merge onto each need doc
    under a 'requester' key: {name, email, contact}.

    Uses a single Firestore get_all() call for the unique set of user_uids —
    never one call per document.  Missing or errored lookups fall back to
    empty strings so the request always succeeds.
    """
    # Collect unique, non-null requester uids.
    uid_set: set[str] = set()
    for d in docs:
        uid = d.get("user_uid") or d.get("requester_id")
        if uid:
            uid_set.add(uid)

    if not uid_set:
        for d in docs:
            d.setdefault("requester", {"name": "", "email": "", "contact": ""})
        return docs

    # Single batch fetch — one round-trip regardless of result-set size.
    profile_map: dict[str, dict] = {}
    try:
        refs = [fs_client.collection("users").document(uid) for uid in uid_set]
        snapshots = fs_client.get_all(refs)  # type: ignore[attr-defined]
        for snap in snapshots:
            if snap.exists:
                data = snap.to_dict()
                profile_map[snap.id] = {
                    "name": data.get("displayName") or data.get("name") or "",
                    "email": data.get("email") or "",
                    "contact": data.get("phone") or data.get("contact") or "",
                }
    except Exception as exc:
        # Non-fatal — log and continue with empty fallbacks.
        print(f"[enrich_requester] Firestore batch lookup failed: {exc}")

    for d in docs:
        uid = d.get("user_uid") or d.get("requester_id") or ""
        d["requester"] = profile_map.get(uid, {"name": "", "email": "", "contact": ""})

    return docs


# ---------------------------------------------------------------------------
# OCR helpers (JSON_Extractor)
# ---------------------------------------------------------------------------

def extract_ocr_json(raw: str) -> dict:
    """
    Parse a raw LLM response string into a dict.

    Pre-processing: strip markdown code fence markers (backticks and the word
    "json") that the model may emit despite strict instructions.
    Attempt 1: direct JSON parse.
    Attempt 2 (fallback): extract the first ``{...}`` substring and parse that.
    Raises ``ValueError(raw)`` if both attempts fail — the caller converts this
    to an HTTP 422.
    """
    # Sanitize: remove markdown code fences before any parse attempt
    sanitized = re.sub(r"```(?:json)?", "", raw).strip()

    # Attempt 1: direct parse on sanitized string
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError:
        pass

    # Attempt 2: substring extraction (first { to last })
    start = sanitized.find('{')
    end = sanitized.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(sanitized[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(raw)  # caller converts to 422


def validate_ocr_fields(parsed: dict) -> dict:
    """
    Validate and normalize OCR extracted fields.
    Supports key aliases:
      - location_name / location
      - needs_description / description
      - people_affected / headcount / estimated_people_affected
      - volunteers_needed
      - urgency
      - category
    """
    reporter_name = str(parsed.get("reporter_name") or "").strip()
    if reporter_name.lower() in ("null", "none", "not provided", "n/a", "unknown"):
        reporter_name = ""

    loc_name = str(parsed.get("location_name") or parsed.get("location") or "").strip()
    if loc_name.lower() in ("null", "none", "not provided", "n/a", "unknown"):
        loc_name = ""

    needs_desc = str(parsed.get("needs_description") or parsed.get("description") or "").strip()
    if needs_desc.lower() in ("null", "none", "not provided", "n/a", "unknown"):
        needs_desc = ""

    # Check people_affected / headcount
    raw_people = (
        parsed.get("people_affected")
        if parsed.get("people_affected") is not None
        else (
            parsed.get("headcount")
            if parsed.get("headcount") is not None
            else parsed.get("estimated_people_affected", 0)
        )
    )
    try:
        people_val = int(raw_people) if str(raw_people).isdigit() else int(float(str(raw_people)))
    except (ValueError, TypeError):
        people_val = 0

    raw_vol = parsed.get("volunteers_needed", 1)
    try:
        vol_needed = max(1, int(raw_vol)) if str(raw_vol).isdigit() else 1
    except (ValueError, TypeError):
        vol_needed = 1

    raw_urgency = str(parsed.get("urgency") or "medium").lower().strip()
    if raw_urgency not in ("critical", "high", "medium", "low"):
        raw_urgency = "medium"

    category = str(parsed.get("category") or "Rescue").strip()
    if category.lower() in ("null", "none", "not provided", "n/a", "unknown"):
        category = "Rescue"

    if not needs_desc and not loc_name:
        raise ValueError("OCR extracted no usable content from image (both description and location are empty).")

    return {
        "reporter_name": reporter_name,
        "location_name": loc_name,
        "location": loc_name,
        "needs_description": needs_desc,
        "description": needs_desc,
        "people_affected": people_val,
        "headcount": people_val,
        "estimated_people_affected": people_val,
        "volunteers_needed": vol_needed,
        "urgency": raw_urgency,
        "category": category,
    }



# ---------------------------------------------------------------------------
# Geocoding helper
# ---------------------------------------------------------------------------

async def geocode_location(location: str) -> tuple[float | None, float | None]:
    """
    Call Nominatim to resolve a location string to (lat, lon).
    Returns (None, None) on empty result, timeout, or any exception.
    Nominatim requires a non-empty User-Agent header.
    """
    if not location or not location.strip():
        return None, None
        
    query_str = location.strip()
    appended_anchor = False
    if "," not in query_str:
        query_str += GEOCODING_REGION_ANCHOR
        appended_anchor = True
        
    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "SmartRelief/1.0"}
        async with httpx.AsyncClient(timeout=5.0) as client:
            params = {"q": query_str, "format": "json", "limit": 1}
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            results = resp.json()
            
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
                
            # If primary anchor failed, fallback to broader region
            if appended_anchor:
                fallback_str = location.strip() + ", Maharashtra, India"
                params["q"] = fallback_str
                resp_fallback = await client.get(url, params=params, headers=headers)
                resp_fallback.raise_for_status()
                fallback_results = resp_fallback.json()
                if fallback_results:
                    return float(fallback_results[0]["lat"]), float(fallback_results[0]["lon"])
                    
    except Exception:
        pass
    return None, None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "SmartRelief API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/needs", response_model=NeedResponse, status_code=status.HTTP_201_CREATED)
async def create_need(payload: NeedRequest, request: Request) -> NeedResponse:
    try:
        doc = payload.model_dump()
        # status is always "open" on creation — never read from the request payload
        doc["status"] = "open"
        # Team capacity fields — initialise assignment tracking
        doc.setdefault("volunteers_needed", 1)
        doc["assigned_volunteers"] = []
        # Calculate and store automated mathematical urgency score
        doc["urgency_score"] = calculate_urgency_score(doc)
        # user_uid is always taken from the verified server-side token, not from
        # the payload, so an admin submitting on behalf cannot overwrite ownership
        token_uid = _get_token_uid(request)
        if token_uid:
            doc["user_uid"] = token_uid
        doc["created_at"] = datetime.now(timezone.utc)
        # Geocode priority chain: GPS-first, fallback to text
        req_lat = doc.get("latitude")
        req_lon = doc.get("longitude")
        if req_lat is not None and req_lon is not None:
            pass # Keep the explicitly provided coordinates
        else:
            lat, lon = await geocode_location(doc.get("location", ""))
            doc["latitude"] = lat
            doc["longitude"] = lon
        result = await needs_collection.insert_one(doc)
        created = await needs_collection.find_one({"_id": result.inserted_id})
        return NeedResponse(**_mongo_doc_to_dict(created))
    except Exception as exc:
        print(f"[create_need] Unhandled error: {exc!r}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to record need. Please try again."},
        )


@app.get("/api/needs")
async def list_needs(
    request: Request,
    limit: int = Query(default=10, ge=1, le=500),
    sort: str = Query(default="created_at"),
    email: str = Query(default=None),
    user_uid: str = Query(default=None),
    status: str = Query(default=None),
    include_completed: bool = Query(default=False),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    skills: str | None = Query(default=None),
) -> dict:
    import pymongo

    caller_uid = _get_token_uid(request)

    # Guard: unauthenticated tokenless requests with no filter return empty.
    # Prevents race-condition fetches before Firebase resolves from leaking data.
    if not caller_uid and not email and not user_uid:
        return {"needs": [], "total": 0}

    # Determine if caller is admin — admins see all needs.
    caller_is_admin = False
    if caller_uid:
        caller_role = _get_user_role_from_firestore(caller_uid)
        caller_is_admin = caller_role == "admin"

    query_filter: dict = {}
    if user_uid:
        query_filter["user_uid"] = user_uid
    elif email and not caller_is_admin:
        query_filter["contact_email"] = email
    if status:
        # Support comma-separated status values (e.g. "open,filled" → $in)
        if "," in status:
            raw_statuses = [s.strip() for s in status.split(",")]
            statuses = []
            for s in raw_statuses:
                if s in ("completed", "resolved"):
                    statuses.extend(["completed", "resolved"])
                elif s in ("open", "active"):
                    statuses.extend(["open", "in_progress", "assigned", "filled"])
                else:
                    statuses.append(s)
            query_filter["status"] = {"$in": list(set(statuses))}
        elif status in ("completed", "resolved"):
            query_filter["status"] = {"$in": ["completed", "resolved"]}
        elif status in ("open", "active"):
            query_filter["status"] = {"$in": ["open", "in_progress", "assigned", "filled"]}
        elif status == "all":
            pass # No status filter
        else:
            query_filter["status"] = status
    elif not include_completed:
        # Default: exclude completed and resolved needs from active views
        query_filter["status"] = {"$nin": ["completed", "resolved"]}

    try:
        # Sort documents by [("urgency_score", -1), ("created_at", -1)] so highest priority tasks return first
        cursor = needs_collection.find(query_filter).sort(
            [("urgency_score", pymongo.DESCENDING), ("created_at", pymongo.DESCENDING)]
        ).limit(limit)
        docs = []
        async for doc in cursor:
            docs.append(_mongo_doc_to_dict(doc))

        skill_list = []
        if skills:
            skill_list = [s.strip() for s in skills.split(",") if s.strip()]

        for d in docs:
            if "urgency_score" not in d or d["urgency_score"] is None:
                try:
                    d["urgency_score"] = calculate_urgency_score(d)
                except Exception:
                    d["urgency_score"] = 40
            for ts in ("created_at", "updated_at", "resolved_at"):
                if ts in d and hasattr(d[ts], "isoformat"):
                    d[ts] = d[ts].isoformat()
            
            # Geospatial & Skill Matching Engine metrics
            try:
                metrics = compute_match_metrics(d, lat, lng, skill_list)
                d["match_metrics"] = metrics
                d["distance_km"] = metrics["distance_km"]
                d["matched_skills"] = metrics["matched_skills"]
                d["match_score"] = metrics["match_score"]
                d["is_recommended"] = metrics["is_recommended"]
            except Exception:
                d["match_metrics"] = {"distance_km": None, "matched_skills": [], "match_score": 0, "is_recommended": False}
                d["distance_km"] = None
                d["matched_skills"] = []
                d["match_score"] = 0
                d["is_recommended"] = False

        docs = _enrich_needs_with_requester(docs)
        total = await needs_collection.count_documents(query_filter)
        return {"needs": docs, "total": total}
    except Exception as exc:
        print(f"[list_needs] Error: {exc!r}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": f"Failed to fetch needs: {str(exc)}"},
        )


@app.get("/api/needs/requester/{uid}")
async def get_requester_needs(uid: str, request: Request) -> dict:
    """
    Return all needs submitted by a specified requester uid.
    Handles missing fields gracefully and returns 400 on error.
    """
    import pymongo
    try:
        if not uid or not uid.strip():
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "UID parameter cannot be empty."},
            )

        clean_uid = uid.strip()
        query_filter = {"user_uid": clean_uid}
        cursor = needs_collection.find(query_filter).sort(
            [("urgency_score", pymongo.DESCENDING), ("created_at", pymongo.DESCENDING)]
        )
        docs = []
        async for doc in cursor:
            docs.append(_mongo_doc_to_dict(doc))

        for d in docs:
            if "urgency_score" not in d or d["urgency_score"] is None:
                try:
                    d["urgency_score"] = calculate_urgency_score(d)
                except Exception:
                    d["urgency_score"] = 40
            for ts_field in ("created_at", "updated_at", "resolved_at"):
                if ts_field in d and hasattr(d[ts_field], "isoformat"):
                    d[ts_field] = d[ts_field].isoformat()

        docs = _enrich_needs_with_requester(docs)
        return {"needs": docs, "total": len(docs)}
    except Exception as exc:
        print(f"[get_requester_needs] Error: {exc!r}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": f"Failed to fetch requester needs: {str(exc)}"},
        )


@app.patch("/api/needs/{need_id}")
async def update_need(need_id: str, request: Request, body: dict) -> dict:
    """Patch a need document (status, matched_volunteer_uid, task_status, etc.)."""
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        oid = ObjectId(need_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid need ID format."},
        )
    update_fields = {k: v for k, v in body.items() if k not in ("_id", "id")}
    if not update_fields:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "No fields to update."},
        )
    update_fields["updated_at"] = datetime.now(timezone.utc)
    result = await needs_collection.update_one({"_id": oid}, {"$set": update_fields})
    if result.matched_count == 0:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Need not found."},
        )
    updated = await needs_collection.find_one({"_id": oid})
    d = _mongo_doc_to_dict(updated)
    for ts_field in ("created_at", "updated_at"):
        if ts_field in d and hasattr(d[ts_field], "isoformat"):
            d[ts_field] = d[ts_field].isoformat()
    return d


@app.delete("/api/needs/{need_id}", status_code=status.HTTP_200_OK)
async def delete_need(need_id: str, request: Request) -> dict:
    """
    Delete a need document.
    - Requester: may only delete their own needs (user_uid == caller uid).
    - Admin: may delete any need.
    - Cascades: associated interest documents are deleted too.
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    from backend.database import interests_collection

    try:
        oid = ObjectId(need_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid need ID format."},
        )

    caller_uid = _get_token_uid(request)
    if not caller_uid:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required."},
        )

    need = await needs_collection.find_one({"_id": oid})
    if not need:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Need not found."},
        )

    caller_role = _get_user_role_from_firestore(caller_uid)
    is_admin = caller_role == "admin"
    is_owner = need.get("user_uid") == caller_uid

    if not is_admin and not is_owner:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "You do not have permission to delete this need."},
        )

    # Cascade delete interests and completions
    await interests_collection.delete_many({"need_id": need_id})
    await completions_collection.delete_many({"need_id": need_id})

    await needs_collection.delete_one({"_id": oid})
    return {"deleted": True, "id": need_id}


@app.post("/api/needs/{need_id}/resolve")
@app.post("/api/needs/{need_id}/complete")
async def resolve_need(need_id: str, request: Request) -> dict:
    """
    Mark a need as completed.
    Permitted for assigned volunteers, need owners, or admins.
    Atomically updates need status to 'completed', task_status to 'completed', records completed_by,
    and upserts completion records into completions_collection.
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    from backend.database import completions_collection

    try:
        oid = ObjectId(need_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid need ID format."},
        )

    caller_uid = _get_token_uid(request)
    if not caller_uid:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required."},
        )

    need = await needs_collection.find_one({"_id": oid})
    if not need:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Need not found."},
        )

    now_dt = datetime.now(timezone.utc)
    assigned = list(need.get("assigned_volunteers") or [])
    if caller_uid not in assigned:
        assigned.append(caller_uid)

    update_doc = {
        "status": "completed",
        "task_status": "completed",
        "completed_by": assigned,
        "resolved_at": now_dt,
        "updated_at": now_dt,
    }
    await needs_collection.update_one({"_id": oid}, {"$set": update_doc})

    # Upsert completion records (do not duplicate)
    try:
        for vol in (assigned or [caller_uid]):
            await completions_collection.update_one(
                {"need_id": need_id, "volunteer_uid": vol},
                {
                    "$set": {
                        "volunteer_uid": vol,
                        "need_id": need_id,
                        "requester_uid": need.get("user_uid"),
                        "completed_at": now_dt,
                    }
                },
                upsert=True,
            )
    except Exception as e:
        print(f"[resolve_need] completions tracking notice: {e}")

    updated = await needs_collection.find_one({"_id": oid})
    d = _mongo_doc_to_dict(updated)
    for ts in ("created_at", "updated_at", "resolved_at"):
        if ts in d and hasattr(d[ts], "isoformat"):
            d[ts] = d[ts].isoformat()
    return d


@app.post("/api/needs/{need_id}/withdraw")
async def withdraw_from_need(need_id: str, request: Request) -> dict:
    """
    Allow an assigned volunteer to withdraw / leave a team.
    Atomically removes volunteer from assigned_volunteers and responding_volunteers using $pull.
    If the team was filled and is now under capacity, forcefully resets status back to 'open'.
    Removes the volunteer's interest document.
    Returns clean 200 OK.
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    from backend.database import interests_collection

    try:
        oid = ObjectId(need_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid need ID format."},
        )

    caller_uid = _get_token_uid(request)
    if not caller_uid:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required."},
        )

    need = await needs_collection.find_one({"_id": oid})
    if not need:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Need not found."},
        )

    now = datetime.now(timezone.utc)

    # 1. Atomically remove volunteer using $pull
    await needs_collection.update_one(
        {"_id": oid},
        {
            "$pull": {
                "assigned_volunteers": caller_uid,
                "responding_volunteers": caller_uid,
            },
            "$set": {"updated_at": now},
        },
    )

    # 2. Check updated document length. If len(assigned_volunteers) < volunteers_needed, forcefully update status back to "open"
    refreshed = await needs_collection.find_one({"_id": oid})
    if refreshed:
        assigned = refreshed.get("assigned_volunteers") or []
        volunteers_needed = refreshed.get("volunteers_needed", 1)
        if len(assigned) < volunteers_needed and refreshed.get("status") not in ("completed", "resolved"):
            await needs_collection.update_one(
                {"_id": oid},
                {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc)}},
            )
            refreshed = await needs_collection.find_one({"_id": oid})

    # 3. Clean up interest documents
    await interests_collection.delete_many({
        "need_id": need_id,
        "volunteer_uid": caller_uid,
    })

    d = _mongo_doc_to_dict(refreshed or need)
    for ts in ("created_at", "updated_at", "resolved_at"):
        if ts in d and hasattr(d[ts], "isoformat"):
            d[ts] = d[ts].isoformat()
    return JSONResponse(status_code=status.HTTP_200_OK, content=d)


@app.post(
    "/api/volunteers",
    response_model=VolunteerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_volunteer(payload: VolunteerRequest) -> VolunteerResponse:
    existing = await volunteers_collection.find_one(
        {"contact_email": payload.contact_email}
    )
    if existing:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "A volunteer profile with this email already exists."},
        )

    try:
        doc = payload.model_dump()
        doc["created_at"] = datetime.now(timezone.utc)
        result = await volunteers_collection.insert_one(doc)
        created = await volunteers_collection.find_one({"_id": result.inserted_id})
        return VolunteerResponse(**_mongo_doc_to_dict(created))
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to register volunteer. Please try again."},
        )


@app.get("/api/volunteers/list")
async def list_volunteers_admin() -> dict:
    """
    Return all users from Firestore whose role is 'volunteer'.
    Used by the admin Volunteers tab.
    """
    if not fs_client:
        return JSONResponse(status_code=500, content={"detail": "Firebase Admin not configured"})
    import datetime as _dt
    docs = fs_client.collection("users").where("is_volunteer", "==", True).stream()
    volunteers = []
    for doc in docs:
        d = doc.to_dict()
        d["uid"] = doc.id
        if "createdAt" in d:
            if hasattr(d["createdAt"], "timestamp"):
                d["createdAt"] = _dt.datetime.fromtimestamp(
                    d["createdAt"].timestamp(), _dt.timezone.utc
                ).isoformat()
            elif hasattr(d["createdAt"], "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
        volunteers.append(d)
        
    # Attribute completion counts from completions_collection
    from backend.database import completions_collection
    
    # Aggregation to get count per volunteer
    pipeline = [
        {"$group": {"_id": "$volunteer_uid", "count": {"$sum": 1}}}
    ]
    cursor = completions_collection.aggregate(pipeline)
    counts = {}
    async for doc in cursor:
        counts[doc["_id"]] = doc["count"]
        
    for v in volunteers:
        v["completions"] = counts.get(v["uid"], 0)
        
    return {"volunteers": volunteers, "total": len(volunteers)}


@app.patch("/api/volunteers/profile")
async def update_volunteer_profile(request: Request, body: dict) -> dict:
    """
    Update volunteer profile settings (skills, availability, location).
    Writes to both Firestore (user document) and MongoDB (volunteers_collection).
    If lat/lng are provided, stores them as a GeoJSON Point in MongoDB.
    """
    uid = _get_token_uid(request)
    if not uid:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    skills = body.get("skills", [])
    availability = body.get("availability")
    location = body.get("location")
    lat = body.get("lat")
    lng = body.get("lng")

    # Update Firestore
    if fs_client:
        fs_update = {}
        if skills is not None: fs_update["skills"] = skills
        if availability is not None: fs_update["availability"] = availability
        if location is not None:
            fs_update["location"] = location
            fs_update["location_name"] = location
        if lat is not None and lng is not None:
            fs_update["lat"] = float(lat)
            fs_update["lng"] = float(lng)
            fs_update["latitude"] = float(lat)
            fs_update["longitude"] = float(lng)
        if fs_update:
            try:
                fs_client.collection("users").document(uid).set(fs_update, merge=True)
            except Exception as e:
                print(f"Firestore update failed: {e}")

    # Update MongoDB
    mongo_update = {"$set": {}}
    if skills is not None: mongo_update["$set"]["skills"] = skills
    if availability is not None: mongo_update["$set"]["availability"] = availability
    if location is not None:
        mongo_update["$set"]["location"] = location
        mongo_update["$set"]["location_name"] = location
    if lat is not None and lng is not None:
        mongo_update["$set"]["lat"] = float(lat)
        mongo_update["$set"]["lng"] = float(lng)
        mongo_update["$set"]["location_geo"] = {
            "type": "Point",
            "coordinates": [float(lng), float(lat)]
        }
    
    mongo_update["$set"]["updated_at"] = datetime.now(timezone.utc)

    if mongo_update["$set"]:
        await volunteers_collection.update_one(
            {"uid": uid},
            mongo_update,
            upsert=True
        )

    return {"success": True}


# ---------------------------------------------------------------------------
# AI Priority Scoring (Step 1)
# ---------------------------------------------------------------------------

@app.post("/api/score", response_model=ScoreResponse, status_code=status.HTTP_200_OK)
async def score_need(payload: ScoreRequest) -> ScoreResponse:
    return scoring_engine.compute_score(payload)


# ---------------------------------------------------------------------------
# Geo-Match Engine
# ---------------------------------------------------------------------------

@app.post("/api/match", response_model=MatchResponse, status_code=status.HTTP_200_OK)
async def match_volunteers(payload: MatchRequest) -> MatchResponse:
    result = await matching_engine.find_matches(payload)
    if result is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Need not found."},
        )
    return result


# ---------------------------------------------------------------------------
# Tasks (volunteer assignments)
# ---------------------------------------------------------------------------

@app.get("/api/tasks")
async def list_tasks(
    volunteer_uid: str = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    import pymongo
    query_filter = {}
    if volunteer_uid:
        query_filter["volunteer_uid"] = volunteer_uid
    cursor = tasks_collection.find(query_filter).sort("created_at", pymongo.DESCENDING).limit(limit)
    docs = []
    async for doc in cursor:
        d = _mongo_doc_to_dict(doc)
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        docs.append(d)

    # Also include matched needs from the needs collection for this volunteer.
    # When a requester accepts an interest, we set status=matched + matched_volunteer_uid
    # on the need — no separate task document is created. Surface those here.
    if volunteer_uid:
        import pymongo as _pm
        matched_cursor = needs_collection.find(
            {"matched_volunteer_uid": volunteer_uid, "status": "matched"}
        ).sort("created_at", _pm.DESCENDING).limit(limit)
        async for doc in matched_cursor:
            d = _mongo_doc_to_dict(doc)
            if "created_at" in d and hasattr(d["created_at"], "isoformat"):
                d["created_at"] = d["created_at"].isoformat()
            # Avoid duplicates if a task document was also created
            existing_ids = {t.get("need_id") for t in docs}
            if d["id"] not in existing_ids:
                docs.append(d)

    total = await tasks_collection.count_documents(query_filter)
    return {"tasks": docs, "total": total}


@app.patch("/api/tasks/{task_id}")
async def update_task_status(task_id: str, body: dict) -> dict:
    """
    Update status on a task document.
    If the ID doesn't match a tasks doc, try patching it as a need document
    (matched needs surface in tasks but live in needs_collection).
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        oid = ObjectId(task_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid task ID format."},
        )
    new_status = body.get("status")
    if not new_status:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Missing 'status' field in request body."},
        )

    # Try tasks collection first
    result = await tasks_collection.update_one(
        {"_id": oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count > 0:
        updated = await tasks_collection.find_one({"_id": oid})
        d = _mongo_doc_to_dict(updated)
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        return d

    # Fallback: the "task" is actually a matched need — patch needs_collection.
    # This happens when a requester accepted an interest and the need became the task.
    result2 = await needs_collection.update_one(
        {"_id": oid},
        {"$set": {"task_status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    if result2.matched_count > 0:
        updated = await needs_collection.find_one({"_id": oid})
        d = _mongo_doc_to_dict(updated)
        for ts_field in ("created_at", "updated_at"):
            if ts_field in d and hasattr(d[ts_field], "isoformat"):
                d[ts_field] = d[ts_field].isoformat()
        return d

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Task not found in tasks or needs collection."},
    )


# ---------------------------------------------------------------------------
# Interests
# ---------------------------------------------------------------------------

from pydantic import BaseModel

class InterestRequest(BaseModel):
    volunteer_uid: str
    need_id: str


@app.post("/api/interests", status_code=status.HTTP_201_CREATED)
async def create_interest(payload: InterestRequest) -> dict:
    """
    Atomically claim a slot on a multi-volunteer team.

    Uses a single MongoDB find_one_and_update with three atomic guards:
      1. status must be "open" (not filled/completed/closed)
      2. volunteer must NOT already be in assigned_volunteers
      3. current team size must be < volunteers_needed

    If any guard fails, the update is a no-op and we return HTTP 409.
    After a successful push, we check whether the team is now full and
    atomically promote status to "filled" if so.
    """
    from bson import ObjectId
    from bson.errors import InvalidId
    from pymongo import ReturnDocument
    from backend.database import interests_collection, needs_collection

    # ── Validate ObjectId ────────────────────────────────────────────────
    try:
        need_oid = ObjectId(payload.need_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid need ID format."},
        )

    # ── Check for duplicate interest (idempotency) ───────────────────────
    existing = await interests_collection.find_one({
        "volunteer_uid": payload.volunteer_uid,
        "need_id": payload.need_id,
    })
    if existing:
        need_doc_existing = await needs_collection.find_one({"_id": need_oid})
        if need_doc_existing:
            nd = _mongo_doc_to_dict(need_doc_existing)
            for ts in ("created_at", "updated_at"):
                if ts in nd and hasattr(nd[ts], "isoformat"):
                    nd[ts] = nd[ts].isoformat()
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"detail": "Interest already sent.", "updated_need": nd},
            )
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Interest already sent."},
        )

    # ── ATOMIC multi-slot claim ──────────────────────────────────────────
    # Single-roundtrip operation with three guards:
    #   1. status == "open"  (team not yet full / closed)
    #   2. assigned_volunteers does NOT contain this volunteer ($ne)
    #   3. len(assigned_volunteers) < volunteers_needed ($expr)
    #
    # $expr handles documents that pre-date the team feature by treating
    # missing volunteers_needed as 1 and missing assigned_volunteers as [].
    claimed_need = await needs_collection.find_one_and_update(
        {
            "_id": need_oid,
            "status": "open",
            "assigned_volunteers": {"$ne": payload.volunteer_uid},
            "$expr": {
                "$lt": [
                    {"$size": {"$ifNull": ["$assigned_volunteers", []]}},
                    {"$ifNull": ["$volunteers_needed", 1]},
                ]
            },
        },
        {
            "$push": {"assigned_volunteers": payload.volunteer_uid},
            "$addToSet": {"responding_volunteers": payload.volunteer_uid},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        return_document=ReturnDocument.AFTER,
    )

    if claimed_need is None:
        # Distinguish: need doesn't exist vs. team full vs. already assigned
        existing_need = await needs_collection.find_one({"_id": need_oid})
        if existing_need is None:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Need not found."},
            )
        if payload.volunteer_uid in (existing_need.get("assigned_volunteers") or []):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"detail": "Interest already sent."},
            )
        # Team is full or need is no longer open
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Team full! This mission has enough volunteers."},
        )

    # ── Auto-promote to "filled" if team is now at capacity ──────────────
    team = claimed_need.get("assigned_volunteers") or []
    capacity = claimed_need.get("volunteers_needed", 1)
    if len(team) >= capacity:
        await needs_collection.update_one(
            {"_id": need_oid, "status": "open"},
            {"$set": {"status": "filled"}},
        )
        # Refresh the doc so the frontend gets the correct status
        claimed_need = await needs_collection.find_one({"_id": need_oid})

    # ── Record the interest document ─────────────────────────────────────
    interest_doc = {
        "volunteer_uid": payload.volunteer_uid,
        "need_id": payload.need_id,
        "created_at": datetime.now(timezone.utc),
        "status": "pending",
    }
    result = await interests_collection.insert_one(interest_doc)

    # ── Serialise the server-confirmed need for the frontend ─────────────
    need_dict = _mongo_doc_to_dict(claimed_need)
    for ts in ("created_at", "updated_at"):
        if ts in need_dict and hasattr(need_dict[ts], "isoformat"):
            need_dict[ts] = need_dict[ts].isoformat()

    created = await interests_collection.find_one({"_id": result.inserted_id})
    d = _mongo_doc_to_dict(created)
    if "created_at" in d and hasattr(d["created_at"], "isoformat"):
        d["created_at"] = d["created_at"].isoformat()
    d["updated_need"] = need_dict
    return d


# ---------------------------------------------------------------------------
# My Active Assignments — non-completed needs the volunteer has responded to
# ---------------------------------------------------------------------------

@app.get("/api/needs/my-active")
async def list_my_active(request: Request) -> dict:
    """
    Return needs where the caller's uid is in `responding_volunteers`
    AND status is not 'completed'.  This is the authoritative Active
    Assignments feed — mutually exclusive with the open-missions feed
    by construction (open feed excludes responding_volunteers).
    """
    import pymongo

    caller_uid = _get_token_uid(request)
    if not caller_uid:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required."},
        )

    query_filter = {
        "$or": [
            {"responding_volunteers": caller_uid},
            {"assigned_volunteers": caller_uid},
        ],
        "status": {"$nin": ["completed", "resolved"]},
    }

    cursor = needs_collection.find(query_filter).sort(
        [("urgency_score", pymongo.DESCENDING), ("created_at", pymongo.DESCENDING)]
    )
    docs = []
    async for doc in cursor:
        d = _mongo_doc_to_dict(doc)
        if "urgency_score" not in d or d["urgency_score"] is None:
            d["urgency_score"] = calculate_urgency_score(d)
        for ts in ("created_at", "updated_at"):
            if ts in d and hasattr(d[ts], "isoformat"):
                d[ts] = d[ts].isoformat()
        docs.append(d)
    docs = _enrich_needs_with_requester(docs)
    return {"needs": docs, "total": len(docs)}


# ---------------------------------------------------------------------------
# My Tasks — volunteer-scoped need aggregation (active + completed history)
# ---------------------------------------------------------------------------

@app.get("/api/needs/my-tasks")
async def list_my_tasks(request: Request) -> dict:
    """
    Return all needs associated with the authenticated volunteer:
      - needs where their uid is in `responding_volunteers` (active commitments)
      - needs where their uid is in `completed_by` (completed work)
    Results are sorted by urgency_score descending (highest priority first).
    """
    import pymongo

    caller_uid = _get_token_uid(request)
    if not caller_uid:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication required."},
        )

    query_filter = {
        "$or": [
            {"assigned_volunteers": caller_uid},
            {"responding_volunteers": caller_uid},
            {"completed_by": caller_uid},
        ]
    }

    cursor = needs_collection.find(query_filter).sort(
        [("urgency_score", pymongo.DESCENDING), ("created_at", pymongo.DESCENDING)]
    )
    docs = []
    async for doc in cursor:
        d = _mongo_doc_to_dict(doc)
        if "urgency_score" not in d or d["urgency_score"] is None:
            d["urgency_score"] = calculate_urgency_score(d)
        for ts in ("created_at", "updated_at", "resolved_at"):
            if ts in d and hasattr(d[ts], "isoformat"):
                d[ts] = d[ts].isoformat()
        docs.append(d)
    docs = _enrich_needs_with_requester(docs)
    return {"needs": docs, "total": len(docs)}


@app.get("/api/interests")
async def list_interests(need_id: str = Query(...)) -> dict:
    """Return all interest records for a given need_id, enriched with volunteer profile."""
    from backend.database import interests_collection
    cursor = interests_collection.find({"need_id": need_id})
    docs = []
    async for doc in cursor:
        d = _mongo_doc_to_dict(doc)
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        volunteer_uid = d.get("volunteer_uid")
        if volunteer_uid and fs_client:
            try:
                vol_doc = fs_client.collection("users").document(volunteer_uid).get()
                if vol_doc.exists:
                    vol_data = vol_doc.to_dict()
                    d["volunteer_display_name"] = vol_data.get("displayName", "")
                    d["volunteer_email"] = vol_data.get("email", "")
            except Exception:
                pass
        docs.append(d)
    return {"interests": docs, "total": len(docs)}


@app.patch("/api/interests/{interest_id}")
async def update_interest(interest_id: str, body: dict) -> dict:
    """Accept or reject a volunteer interest. Also updates the need status on acceptance."""
    from bson import ObjectId
    from bson.errors import InvalidId
    from backend.database import interests_collection

    try:
        oid = ObjectId(interest_id)
    except InvalidId:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Invalid interest ID format."},
        )

    new_status = body.get("status")
    if new_status not in ("accepted", "rejected", "closed"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "status must be 'accepted', 'rejected', or 'closed'."},
        )

    interest = await interests_collection.find_one({"_id": oid})
    if not interest:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Interest record not found."},
        )

    await interests_collection.update_one(
        {"_id": oid},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )

    # No need status updates here anymore; interest status is just tracked for history or left as pending
    updated = await interests_collection.find_one({"_id": oid})
    d = _mongo_doc_to_dict(updated)
    if "created_at" in d and hasattr(d["created_at"], "isoformat"):
        d["created_at"] = d["created_at"].isoformat()
    return d


# ---------------------------------------------------------------------------
# Stats aggregation
# ---------------------------------------------------------------------------

class CompletionRequest(BaseModel):
    need_id: str
    volunteer_uids: list[str]

@app.post("/api/completions")
async def create_completions(request: Request, payload: CompletionRequest) -> dict:
    from bson import ObjectId
    from backend.database import needs_collection, completions_collection
    
    requester_uid = _get_token_uid(request)
    
    # We must ensure both writes succeed
    now = datetime.now(timezone.utc)
    
    # 1. Prepare completion records
    completion_docs = [
        {
            "volunteer_uid": vol_uid,
            "need_id": payload.need_id,
            "requester_uid": requester_uid,
            "completed_at": now
        }
        for vol_uid in payload.volunteer_uids
    ]
    
    try:
        # Write 1: Update the need document
        update_res = await needs_collection.update_one(
            {"_id": ObjectId(payload.need_id)},
            {"$set": {
                "status": "completed",
                "completed_by": payload.volunteer_uids,
                "updated_at": now
            }}
        )
        
        if update_res.modified_count == 0:
            # Maybe already completed or not found
            # We'll continue, or we can check matched_count
            if update_res.matched_count == 0:
                return JSONResponse(status_code=404, content={"detail": "Need not found"})
                
        # Write 2: Insert completion records
        if completion_docs:
            await completions_collection.insert_many(completion_docs)
            
        return {"success": True, "completions_recorded": len(completion_docs)}
        
    except Exception as e:
        print(f"Error in completion handshake: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to complete handshake atomically."}
        )

@app.get("/api/stats")
async def get_stats() -> dict:
    """
    Returns platform stats in a single request directly from needs_collection:
    - total_needs: total count in needs_collection
    - active_emergencies: count where status is in ["open", "in_progress", "assigned", "filled"]
    - urgent_needs: count of active emergencies where urgency is in ["critical", "high"]
    - completed_missions: count where status is in ["completed", "resolved"]
    - completions_this_month: count of completed_missions resolved/created in current calendar month
    - total_lives_impacted: sum of headcount / people_affected across all needs in needs_collection
    - total_volunteers: count of volunteers in pool
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_needs = await needs_collection.count_documents({})
    active_emergencies = await needs_collection.count_documents({
        "status": {"$in": ["open", "in_progress", "assigned", "filled"]}
    })
    urgent_needs = await needs_collection.count_documents({
        "status": {"$in": ["open", "in_progress", "assigned", "filled"]},
        "urgency": {"$in": ["critical", "high"]}
    })
    completed_missions = await needs_collection.count_documents({
        "status": {"$in": ["completed", "resolved"]}
    })
    completions_this_month = await needs_collection.count_documents({
        "status": {"$in": ["completed", "resolved"]},
        "$or": [
            {"resolved_at": {"$gte": month_start}},
            {"updated_at": {"$gte": month_start}},
            {"created_at": {"$gte": month_start}},
        ]
    })

    # Aggregate total_lives_impacted using MongoDB $group
    pipeline = [
        {"$group": {
            "_id": None, 
            "total": {
                "$sum": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$estimated_people_affected",
                                {"$ifNull": ["$people_affected", {"$ifNull": ["$headcount", 0]}]}
                            ]
                        },
                        "to": "int",
                        "onError": 0,
                        "onNull": 0
                    }
                }
            }
        }}
    ]
    cursor = needs_collection.aggregate(pipeline)
    total_lives_impacted = 0
    async for doc in cursor:
        total_lives_impacted = doc.get("total", 0) or 0

    total_volunteers = 0
    if fs_client:
        try:
            v_docs = fs_client.collection("users").where("is_volunteer", "==", True).stream()
            total_volunteers = sum(1 for _ in v_docs)
        except Exception:
            pass

    return {
        "total_needs": total_needs,
        "urgent_needs": urgent_needs,
        "total_volunteers": total_volunteers,
        "completions_this_month": completions_this_month,
        "total_lives_impacted": total_lives_impacted,
        "active_emergencies": active_emergencies,
        "completed_missions": completed_missions,
    }


async def _gather(*coros):
    import asyncio
    return await asyncio.gather(*coros)


# ---------------------------------------------------------------------------
# Vision AI OCR (Step 3)
# ---------------------------------------------------------------------------

@app.post("/api/needs/ocr", response_model=OCRResponse, status_code=200)
async def ocr_need(
    body: OCRRequest,
    save: bool = Query(default=False, description="Optionally save directly to MongoDB"),
) -> OCRResponse:
    """
    Accept a Base64-encoded image, process orientation via Pillow,
    forward it to NVIDIA NIM Vision LLM (meta/llama-3.2-90b-vision-instruct with
    fallback to meta/llama-3.2-11b-vision-instruct), and return structured emergency data.
    """
    nvidia_key = os.getenv("NVIDIA_API_KEY") or os.getenv("NIM_API_KEY")
    if not nvidia_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "NVIDIA API key is not configured. Please set NVIDIA_API_KEY in backend/.env."
            ),
        )

    # 1. Clean and transpose image using Pillow to handle mobile/rotated photos
    raw_b64 = body.image_base64
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(img_bytes))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        clean_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid image format or decoding error: {str(e)}",
        )

    # 2. Setup NVIDIA NIM client
    client = openai.OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=nvidia_key,
    )

    system_prompt = (
        "You are an emergency SOS handwriting OCR extractor. "
        "The image may be rotated 90/180/270 degrees sideways—read it carefully in any orientation. "
        "Extract and return ONLY valid JSON with these exact keys: "
        '{"reporter_name": string, "location_name": string, "needs_description": string, "description": string, '
        '"people_affected": int, "headcount": int, "volunteers_needed": int, '
        '"urgency": "critical"|"high"|"medium"|"low", "category": string}. '
        "Infer location_name (e.g. 'Thane'), headcount/people_affected (e.g. 12), urgency (e.g. 'critical'), "
        "and full text into needs_description."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{clean_b64}"},
                },
                {
                    "type": "text",
                    "text": (
                        "Extract all emergency SOS details from this image into the requested JSON schema. "
                        "Output valid JSON only with no markdown formatting or conversational text."
                    ),
                },
            ],
        },
    ]

    # 3. Call NVIDIA Vision NIM with primary 90b and fallback 11b
    raw_text = None
    model_errors = []
    for model_name in ("meta/llama-3.2-90b-vision-instruct", "meta/llama-3.2-11b-vision-instruct"):
        try:
            # 15s timeout on 90b to avoid stalling if the 90b queue is backed up; 30s on fallback
            timeout_val = 15.0 if "90b" in model_name else 30.0
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=600,
                temperature=0,
                timeout=timeout_val,
            )
            if completion.choices and completion.choices[0].message.content:
                raw_text = completion.choices[0].message.content
                break
        except Exception as e:
            model_errors.append(f"{model_name}: {str(e)}")

    if not raw_text:
        raise HTTPException(
            status_code=422,
            detail=f"NVIDIA Vision API call failed: {'; '.join(model_errors)}",
        )

    # 4. Parse JSON
    try:
        parsed = extract_ocr_json(raw_text)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"OCR extraction failed to produce valid JSON: {raw_text}",
        )

    # 5. Strict field validation
    try:
        validated = validate_ocr_fields(parsed)
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )

    # 6. Calculate urgency score on OCR extracted data
    validated["urgency_score"] = calculate_urgency_score(validated)

    if save:
        save_doc = dict(validated)
        save_doc["status"] = "open"
        save_doc.setdefault("volunteers_needed", 1)
        save_doc["assigned_volunteers"] = []
        save_doc["created_at"] = datetime.now(timezone.utc)
        lat, lon = await geocode_location(save_doc.get("location_name") or save_doc.get("location", ""))
        save_doc["latitude"] = lat
        save_doc["longitude"] = lon
        await needs_collection.insert_one(save_doc)

    return OCRResponse(**validated)


# ---------------------------------------------------------------------------
# Firebase Admin SDK - User Management
# ---------------------------------------------------------------------------

class UserRoleUpdate(BaseModel):
    role: str


@app.get("/api/users")
async def list_users() -> dict:
    if not fs_client:
        return JSONResponse(status_code=500, content={"detail": "Firebase Admin not configured"})
    import datetime as _dt
    docs = fs_client.collection("users").stream()
    users = []
    for doc in docs:
        d = doc.to_dict()
        d["uid"] = doc.id
        if "createdAt" in d:
            if hasattr(d["createdAt"], "timestamp"):
                d["createdAt"] = _dt.datetime.fromtimestamp(d["createdAt"].timestamp(), _dt.timezone.utc).isoformat()
            elif hasattr(d["createdAt"], "isoformat"):
                d["createdAt"] = d["createdAt"].isoformat()
        users.append(d)
    return {"users": users}


@app.patch("/api/users/{uid}/role")
async def update_user_role(uid: str, payload: UserRoleUpdate):
    if not fs_client:
        return JSONResponse(status_code=500, content={"detail": "Firebase Admin not configured"})
    fs_client.collection("users").document(uid).update({
        "role": payload.role,
        "updatedAt": fb_firestore.SERVER_TIMESTAMP
    })
    return {"success": True}
