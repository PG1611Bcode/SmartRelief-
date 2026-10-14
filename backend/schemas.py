from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Need schemas
# ---------------------------------------------------------------------------

class NeedRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reporter_name: str = Field(default="", max_length=50)
    location: str = Field(..., min_length=3, max_length=200)
    urgency: Optional[Literal["low", "medium", "high", "critical"]] = None
    needs_description: str = Field(..., min_length=10, max_length=1000)
    contact_email: Optional[EmailStr] = None
    estimated_people_affected: Optional[int] = Field(
        default=None, ge=1, le=1_000_000
    )
    # AI scoring fields — set by frontend pipeline before submission
    ai_score: Optional[int] = Field(default=None, ge=0, le=100)
    urgency_score: Optional[int] = Field(default=None, description="Automated mathematical urgency score")
    computed_urgency: Optional[Literal["low", "medium", "high", "critical"]] = None
    urgency_override: bool = False
    keyword_hits: List[str] = Field(default_factory=list)
    # Team capacity — how many volunteers does this need require?
    volunteers_needed: int = Field(default=1, ge=1, le=100)
    # status is NOT accepted from the client — set to "open" by the handler on insert
    # Submitter identity — persisted so volunteers don't see their own submissions
    user_uid: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90 <= v <= 90):
            raise ValueError(f"Latitude must be in [-90, 90]. Got {v}.")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180 <= v <= 180):
            raise ValueError(f"Longitude must be in [-180, 180]. Got {v}.")
        return v


class NeedResponse(NeedRequest):
    id: str
    created_at: datetime
    # status is set by the handler on insert and returned in responses
    status: Literal["open", "in_progress", "filled", "resolved", "closed"] = "open"
    distance_km: Optional[float] = None
    matched_skills: List[str] = Field(default_factory=list)
    match_score: Optional[int] = None
    is_recommended: Optional[bool] = None
    match_metrics: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Volunteer schemas
# ---------------------------------------------------------------------------

class GeoPoint(BaseModel):
    """GeoJSON Point with coordinate validation."""
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(..., min_length=2, max_length=2)

    @field_validator("coordinates")
    @classmethod
    def validate_coords(cls, v: List[float]) -> List[float]:
        lon, lat = v[0], v[1]
        if not (-180 <= lon <= 180):
            raise ValueError(f"Longitude must be in [-180, 180]. Got {lon}.")
        if not (-90 <= lat <= 90):
            raise ValueError(f"Latitude must be in [-90, 90]. Got {lat}.")
        return v


class VolunteerRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(..., min_length=2, max_length=80)
    location: str = Field(..., min_length=3, max_length=200)
    skills: List[str] = Field(..., min_length=1)
    availability: Literal["immediate", "within_24h", "within_week", "flexible"]
    contact_email: EmailStr
    phone: Optional[str] = Field(
        default=None, pattern=r"^\+?[0-9\s\-]{7,20}$"
    )
    role_preference: Literal["volunteer", "coordinator", "specialist"] = "volunteer"
    coordinates: Optional[GeoPoint] = None

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, v: List[str]) -> List[str]:
        if len(v) < 1:
            raise ValueError("At least one skill is required.")
        for skill in v:
            if len(skill.strip()) > 50:
                raise ValueError(f"Each skill must be at most 50 characters. Got: '{skill}'")
        return [s.strip() for s in v]


class VolunteerResponse(VolunteerRequest):
    id: str
    created_at: datetime


# ---------------------------------------------------------------------------
# AI Priority Scoring schemas (Step 1)
# ---------------------------------------------------------------------------

class ScoreRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    description: str = Field(..., min_length=10, max_length=1000)
    claimed_urgency: Literal["low", "medium", "high", "critical"]
    people_affected: int = Field(default=1, ge=1, le=1_000_000)


class ScoreResponse(BaseModel):
    raw_score: int
    normalized_score: int
    computed_urgency: Literal["low", "medium", "high", "critical"]
    claimed_urgency: str
    override_flag: bool
    override_reason: Optional[str] = None
    keyword_hits: List[str]


# ---------------------------------------------------------------------------
# Geo-Match schemas (Step 2)
# ---------------------------------------------------------------------------

class MatchRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    need_id: str
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)
    max_distance_km: float = Field(default=50.0, ge=1, le=500)
    top_n: int = Field(default=3, ge=1, le=10)


class VolunteerMatch(BaseModel):
    volunteer_id: str
    full_name: str
    location: str
    availability: str
    distance_km: Optional[float] = None
    distance_score: float
    contact_email: str
    relaxed_match: bool = False


class MatchResponse(BaseModel):
    need_id: str
    total_candidates_evaluated: int
    matches: List[VolunteerMatch]
    match_quality: Literal["excellent", "good", "partial", "none"]


# ---------------------------------------------------------------------------
# Vision AI OCR schemas (Step 3)
# ---------------------------------------------------------------------------

class OCRRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)


class OCRResponse(BaseModel):
    reporter_name: str = ""
    location_name: str = ""
    location: str = ""
    needs_description: str = ""
    description: str = ""
    people_affected: int = 0
    headcount: int = 0
    estimated_people_affected: int = 0
    volunteers_needed: int = 1
    urgency: str = "medium"
    category: str = "Rescue"
    urgency_score: Optional[int] = 0

