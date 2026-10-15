"""
SmartRelief Geo-Match Engine.
Combines MongoDB $near geospatial query with skill-overlap and
Haversine distance scoring.
"""

from __future__ import annotations

import math
from bson import ObjectId
from bson.errors import InvalidId

try:
    from database import needs_collection, volunteers_collection
    from schemas import MatchRequest, MatchResponse, VolunteerMatch
except ImportError:
    from backend.database import needs_collection, volunteers_collection
    from backend.schemas import MatchRequest, MatchResponse, VolunteerMatch


# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate Haversine distance in kilometers between two GPS coordinates.
    Returns distance in kilometers rounded to 1 decimal place.
    """
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * (math.sin(d_lon / 2.0) ** 2)
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    return haversine_distance(lat1, lon1, lat2, lon2)


SKILL_SEMANTIC_KEYWORDS: dict[str, list[str]] = {
    "medical": [
        "medical", "doctor", "health", "hospital", "injured", "injury", "nurse",
        "paramedic", "patient", "blood", "trauma", "clinic", "ambulance", "medic",
        "medication", "medicine", "physician", "wound", "fracture",
    ],
    "first aid": [
        "first aid", "bandage", "cpr", "dressing", "tourniquet", "vital", "triage",
        "wound", "injured", "injury", "bleeding", "burn", "burns", "stretcher",
    ],
    "search & rescue": [
        "rescue", "trapped", "search", "collapsed", "evacuate", "evacuation",
        "rubble", "debris", "stranded", "missing", "buried", "lifeline", "peril",
    ],
    "firefighting": [
        "fire", "smoke", "burn", "burning", "blaze", "firefighter", "extinguisher",
        "flame", "flames", "wildfire", "inferno", "combustion",
    ],
    "supply delivery": [
        "supply", "supplies", "food", "ration", "water", "delivery", "distribute",
        "blanket", "groceries", "kits", "materials", "meals", "provisions", "relief",
    ],
    "swimming / flood": [
        "flood", "water", "drown", "drowning", "swim", "swimming", "boat",
        "submerged", "monsoon", "river", "overflow", "inundated", "fluvial",
    ],
    "transport": [
        "transport", "vehicle", "driver", "drive", "car", "van", "truck",
        "evacuate", "ambulance", "logistics", "shuttle", "ferry", "dispatch",
    ],
}


def compute_match_metrics(
    need: dict,
    volunteer_lat: float | None,
    volunteer_lng: float | None,
    volunteer_skills: list[str] | None,
) -> dict:
    """
    Compute distance and skill overlap metrics between a need and a volunteer.
    - distance_km: Haversine distance in km (or None)
    - matched_skills: list of volunteer skills matching need category, tags, or description
    - match_score: Proximity (<2km=50, <5km=40, <10km=25, <25km=10, else 0) + Skill overlap (+25 per match, max 50)
    - is_recommended: match_score >= 40
    """
    if hasattr(need, "model_dump"):
        need_dict = need.model_dump()
    elif isinstance(need, dict):
        need_dict = need
    else:
        need_dict = dict(need)

    need_lat = need_dict.get("latitude")
    need_lng = need_dict.get("longitude")
    if need_lat is None or need_lng is None:
        coords = need_dict.get("coordinates")
        if isinstance(coords, dict) and "coordinates" in coords:
            geo_coords = coords["coordinates"]
            if len(geo_coords) >= 2:
                need_lng, need_lat = geo_coords[0], geo_coords[1]

    distance_km: float | None = None
    if (
        volunteer_lat is not None
        and volunteer_lng is not None
        and need_lat is not None
        and need_lng is not None
    ):
        try:
            distance_km = haversine_distance(
                float(volunteer_lat),
                float(volunteer_lng),
                float(need_lat),
                float(need_lng),
            )
        except (ValueError, TypeError):
            distance_km = None

    # Skill overlap with semantic sensitivity
    skills = [str(s).strip() for s in (volunteer_skills or []) if str(s).strip()]
    text_chunks: list[str] = []
    for key in ("category", "tags", "description", "needs_description"):
        val = need_dict.get(key)
        if isinstance(val, (list, tuple, set)):
            text_chunks.extend(str(item) for item in val)
        elif val is not None:
            text_chunks.append(str(val))
    combined_text = " ".join(text_chunks).lower()

    matched_skills: list[str] = []
    for skill in skills:
        skill_clean = skill.lower().strip()
        if not skill_clean:
            continue

        # 1. Direct substring match
        matched = skill_clean in combined_text

        # 2. Semantic keyword / category match
        if not matched:
            for skill_key, keywords in SKILL_SEMANTIC_KEYWORDS.items():
                if skill_key in skill_clean or skill_clean in skill_key:
                    if any(kw in combined_text for kw in keywords):
                        matched = True
                        break

        if matched and skill not in matched_skills:
            matched_skills.append(skill)

    # Compute match_score (0-100)
    proximity_score = 0
    if distance_km is not None:
        if distance_km < 2.0:
            proximity_score = 50
        elif distance_km < 5.0:
            proximity_score = 40
        elif distance_km < 10.0:
            proximity_score = 25
        elif distance_km < 25.0:
            proximity_score = 10
        else:
            proximity_score = 0

    skill_score = min(50, len(matched_skills) * 25)
    match_score = min(100, proximity_score + skill_score)
    is_recommended = match_score >= 40

    return {
        "distance_km": distance_km,
        "matched_skills": matched_skills,
        "match_score": match_score,
        "is_recommended": is_recommended,
    }



# ---------------------------------------------------------------------------
# Match quality label
# ---------------------------------------------------------------------------

def _match_quality(top_score: float) -> str:
    if top_score >= 80:
        return "excellent"
    if top_score >= 60:
        return "good"
    if top_score >= 30:
        return "partial"
    return "none"


# ---------------------------------------------------------------------------
# Build VolunteerMatch from a raw doc
# ---------------------------------------------------------------------------

def _build_match(
    doc: dict,
    need_lon: float,
    need_lat: float,
    max_distance_km: float,
    relaxed: bool,
) -> VolunteerMatch:
    coords = doc.get("coordinates")
    distance_km: float | None = None
    distance_score = 0.0

    if coords and coords.get("coordinates"):
        vol_lon, vol_lat = coords["coordinates"]
        distance_km = round(_haversine_km(need_lon, need_lat, vol_lon, vol_lat), 2)
        distance_score = round(max(0.0, 100.0 - (distance_km / max_distance_km * 100.0)), 2)

    return VolunteerMatch(
        volunteer_id=str(doc["_id"]),
        full_name=doc.get("full_name", ""),
        location=doc.get("location", ""),
        availability=doc.get("availability", ""),
        distance_km=distance_km,
        distance_score=distance_score,
        contact_email=doc.get("contact_email", ""),
        relaxed_match=relaxed,
    )


# ---------------------------------------------------------------------------
# Main match function
# ---------------------------------------------------------------------------

async def find_matches(request: MatchRequest) -> MatchResponse:
    # Validate need_id
    try:
        oid = ObjectId(request.need_id)
    except (InvalidId, Exception):
        return None  # caller handles 404

    need_doc = await needs_collection.find_one({"_id": oid})
    if need_doc is None:
        return None  # caller returns 404

    max_meters = request.max_distance_km * 1000.0
    availability_primary = ["immediate", "within_24h"]
    availability_relaxed = ["immediate", "within_24h", "within_week"]

    geo_query = {
        "coordinates": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [request.longitude, request.latitude],
                },
                "$maxDistance": max_meters,
            }
        }
    }

    total_evaluated = 0
    matches: list[VolunteerMatch] = []

    # ── Phase 1: primary geo + strict availability ──────────────────────────
    primary_filter = {**geo_query, "availability": {"$in": availability_primary}}
    cursor = volunteers_collection.find(primary_filter).limit(50)
    primary_docs = await cursor.to_list(length=50)
    total_evaluated += len(primary_docs)

    primary_matches = [
        _build_match(d, request.longitude, request.latitude,
                     request.max_distance_km, False)
        for d in primary_docs
    ]
    primary_matches.sort(key=lambda m: m.distance_score, reverse=True)

    if len(primary_matches) >= request.top_n:
        matches = primary_matches[: request.top_n]
    else:
        matches = primary_matches[:]

        # ── Phase 2: relax availability to within_week ──────────────────────
        seen_ids = {m.volunteer_id for m in matches}
        relaxed_filter = {**geo_query, "availability": {"$in": availability_relaxed}}
        cursor2 = volunteers_collection.find(relaxed_filter).limit(50)
        relaxed_docs = await cursor2.to_list(length=50)
        total_evaluated += len(relaxed_docs)

        for d in relaxed_docs:
            if str(d["_id"]) in seen_ids:
                continue
            vm = _build_match(
                d, request.longitude, request.latitude,
                request.max_distance_km, True,
            )
            matches.append(vm)
            seen_ids.add(vm.volunteer_id)

        matches.sort(key=lambda m: m.distance_score, reverse=True)
        matches = matches[: request.top_n]

    top_score = matches[0].distance_score if matches else 0.0

    return MatchResponse(
        need_id=request.need_id,
        total_candidates_evaluated=total_evaluated,
        matches=matches[: request.top_n],
        match_quality=_match_quality(top_score),
    )
