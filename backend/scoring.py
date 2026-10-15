"""
SmartRelief AI Priority Scoring Engine.
Pure Python — no external ML libraries.
"""

from __future__ import annotations

import re
from typing import Literal

try:
    from schemas import ScoreRequest, ScoreResponse
except ImportError:
    from backend.schemas import ScoreRequest, ScoreResponse

# ---------------------------------------------------------------------------
# Keyword registry
# ---------------------------------------------------------------------------

TIER_1 = {
    "fire": 40, "earthquake": 40, "flood": 40, "collapse": 40,
    "explosion": 40, "tsunami": 40, "chemical": 40, "nuclear": 40,
    "outbreak": 40, "epidemic": 40, "destroyed": 40, "devastated": 40,
    "flooded": 40, "flooding": 40,
}

TIER_2 = {
    "dead": 25, "death": 25, "critical": 25, "unconscious": 25,
    "bleeding": 25, "trapped": 25, "missing": 25, "drowning": 25,
    "evacuation": 25, "sepsis": 25, "cholera": 25, "starvation": 25,
    "homeless": 25, "homelessness": 25, "ruined": 25,
}

TIER_3 = {
    "injured": 15, "urgent": 15, "emergency": 15, "hospital": 15,
    "medical": 15, "displaced": 15, "shelter": 15, "contaminated": 15,
    "armed": 15, "violence": 15, "children": 15, "infant": 15,
}

TIER_4 = {
    "water": 8, "food": 8, "hungry": 8, "sick": 8, "fever": 8,
    "wound": 8, "elderly": 8, "pregnant": 8, "disabled": 8, "medication": 8,
}

TIER_5 = {
    "cold": 3, "blanket": 3, "clothes": 3, "support": 3, "help": 3,
    "assistance": 3, "supplies": 3, "transport": 3,
}

KEYWORD_WEIGHTS: dict[str, int] = {
    **TIER_1, **TIER_2, **TIER_3, **TIER_4, **TIER_5,
}

NEGATION_WORDS = {"no", "not", "without", "none"}

UrgencyLiteral = Literal["low", "medium", "high", "critical"]

URGENCY_THRESHOLDS: list[tuple[int, UrgencyLiteral]] = [
    (80, "critical"),
    (60, "high"),
    (35, "medium"),
    (0,  "low"),
]


# ---------------------------------------------------------------------------
# Tokeniser helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """Lowercase and split on non-alpha boundaries."""
    return re.findall(r"[a-z]+", text.lower())


def _is_negated(tokens: list[str], keyword_idx: int) -> bool:
    """Return True if any of the 3 tokens before keyword_idx is a negation word."""
    start = max(0, keyword_idx - 3)
    window = tokens[start:keyword_idx]
    return any(w in NEGATION_WORDS for w in window)


# ---------------------------------------------------------------------------
# Core scoring function
# ---------------------------------------------------------------------------

def compute_score(request: ScoreRequest) -> ScoreResponse:
    tokens = _tokenize(request.description)

    raw_score = 0
    keyword_hits: list[str] = []

    for idx, token in enumerate(tokens):
        if token in KEYWORD_WEIGHTS and token not in keyword_hits:
            if not _is_negated(tokens, idx):
                raw_score += KEYWORD_WEIGHTS[token]
                keyword_hits.append(token)

    # People-affected contribution
    people_contribution = min(20, request.people_affected // 50)
    raw_score += people_contribution

    # Recalibrate normalization: multiplier 2.1 ensures 'flooded' (40) scores >80
    normalized_score = min(100, int(raw_score * 2.1))

    # Map to urgency tier
    computed_urgency: UrgencyLiteral = "low"
    for threshold, label in URGENCY_THRESHOLDS:
        if normalized_score >= threshold:
            computed_urgency = label
            break

    override_flag = computed_urgency != request.claimed_urgency

    override_reason: str | None = None
    if override_flag:
        if keyword_hits:
            kw_list = ", ".join(keyword_hits[:5])
            override_reason = (
                f"Keywords detected: {kw_list}. "
                f"Score {normalized_score} maps to '{computed_urgency}', "
                f"which differs from claimed '{request.claimed_urgency}'."
            )
        else:
            override_reason = (
                f"Score {normalized_score} (based on {request.people_affected} people affected) "
                f"maps to '{computed_urgency}', which differs from claimed '{request.claimed_urgency}'."
            )

    return ScoreResponse(
        raw_score=raw_score,
        normalized_score=normalized_score,
        computed_urgency=computed_urgency,
        claimed_urgency=request.claimed_urgency,
        override_flag=override_flag,
        override_reason=override_reason,
        keyword_hits=keyword_hits,
    )


# ---------------------------------------------------------------------------
# Smart Urgency Scoring Engine (Feature 3)
# ---------------------------------------------------------------------------

CRITICAL_URGENCY_TERMS = (
    "medical", "injury", "trapped", "fire", "rescue", "infant", "elderly"
)


def calculate_urgency_score(need_data: dict) -> int:
    """
    Pure mathematical urgency score calculation:
    - Base severity: critical=100, high=70, medium=40, low=10 (default=40 if missing)
    - Keyword/tag bonus: +25 per matched critical term (capped at +75)
    - Headcount scaling: (headcount/people_affected or volunteers_needed) * 5 (capped at +100)
    Returns the total integer urgency score.
    """
    if hasattr(need_data, "model_dump"):
        data = need_data.model_dump()
    elif isinstance(need_data, dict):
        data = need_data
    else:
        data = dict(need_data)

    # 1. Base severity points
    urgency_raw = (
        data.get("urgency")
        or data.get("computed_urgency")
        or data.get("severity")
        or ""
    )
    urgency_key = str(urgency_raw).strip().lower()
    base_scores = {
        "critical": 100,
        "high": 70,
        "medium": 40,
        "low": 10,
    }
    base_points = base_scores.get(urgency_key, 40)

    # 2. High-risk keyword / tag bonus
    text_chunks = []
    for field in ("category", "tags", "description", "needs_description"):
        val = data.get(field)
        if isinstance(val, (list, tuple, set)):
            text_chunks.extend(str(item) for item in val)
        elif val is not None:
            text_chunks.append(str(val))
    combined_text = " ".join(text_chunks).lower()

    matched_keywords_count = 0
    for term in CRITICAL_URGENCY_TERMS:
        if term in combined_text or (term == "injury" and "injur" in combined_text):
            matched_keywords_count += 1

    keyword_bonus = min(75, matched_keywords_count * 25)

    # 3. Headcount scaling
    headcount = None
    for field in ("headcount", "people_affected", "estimated_people_affected"):
        val = data.get(field)
        if val is not None:
            try:
                parsed_val = int(val)
                if parsed_val > 0:
                    headcount = parsed_val
                    break
            except (ValueError, TypeError):
                pass

    if headcount is None:
        vn = data.get("volunteers_needed")
        if vn is not None:
            try:
                headcount = max(0, int(vn))
            except (ValueError, TypeError):
                headcount = 0
        else:
            headcount = 0

    headcount_bonus = min(100, max(0, headcount * 5))

    return int(base_points + keyword_bonus + headcount_bonus)

