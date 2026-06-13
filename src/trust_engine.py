"""
IDme — Trust Score Engine

Computes a 0-100 trust score from cross-platform verification signals.

Scoring weights:
- Platform coverage: 30% — more platforms = harder to fake
- Account age: 20% — older accounts are more trustworthy
- Social signals: 15% — followers/connections indicate real presence
- Content signals: 10% — repos/posts prove activity
- Verification freshness: 15% — recently verified = actively maintained
- Name consistency: 10% — same name across platforms = likely real

The trust score is displayed as an animated radial gauge on profile pages
and is available via the JSON API for programmatic consumption.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PlatformSignals:
    """Extracted trust signals from a single platform verification."""
    platform: str
    is_verified: bool = False
    account_age_days: int = 0
    followers: int = 0
    content_count: int = 0  # repos, posts, etc.
    verified_at: Optional[datetime] = None
    display_name: str = ""


@dataclass
class TrustBreakdown:
    """Detailed breakdown of trust score components for UI display."""
    total_score: int = 0
    coverage_score: float = 0.0
    age_score: float = 0.0
    social_score: float = 0.0
    content_score: float = 0.0
    freshness_score: float = 0.0
    consistency_score: float = 0.0
    platforms_verified: int = 0
    platforms_total: int = 4  # github, linkedin, facebook, whatsapp
    signals: Dict[str, Dict[str, Any]] = field(default_factory=dict)


def _extract_signals(platform: str, status: str, metadata: Dict[str, Any],
                     verified_at: Optional[datetime]) -> PlatformSignals:
    """Extract trust signals from a verification record's metadata."""
    signals = PlatformSignals(
        platform=platform,
        is_verified=(status == "verified"),
        verified_at=verified_at,
    )

    if not signals.is_verified:
        return signals

    # Account age (from GitHub created_at or platform-specific fields)
    created_str = metadata.get("created_at")
    if created_str:
        try:
            created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            signals.account_age_days = (datetime.now(timezone.utc) - created).days
        except (ValueError, TypeError):
            pass

    # Follower / connection counts
    signals.followers = int(metadata.get("followers", 0) or 0)

    # Content counts (repos for GitHub, etc.)
    signals.content_count = int(metadata.get("public_repos", 0) or 0)

    # Display name
    signals.display_name = metadata.get("display_name", "") or ""
    if not signals.display_name:
        signals.display_name = metadata.get("name", "") or ""
        if not signals.display_name:
            signals.display_name = metadata.get("given_name", "") or ""

    return signals


def compute_trust_score(verifications: list) -> TrustBreakdown:
    """
    Compute trust score from a list of Verification ORM objects.

    Returns a TrustBreakdown with the total score (0-100) and per-component
    scores for UI display.
    """
    breakdown = TrustBreakdown()
    platform_signals: List[PlatformSignals] = []

    for v in verifications:
        signals = _extract_signals(
            platform=v.platform,
            status=v.status,
            metadata=v.metadata_json or {},
            verified_at=v.verified_at,
        )
        platform_signals.append(signals)

        if signals.is_verified:
            breakdown.platforms_verified += 1
            breakdown.signals[v.platform] = {
                "account_age_days": signals.account_age_days,
                "followers": signals.followers,
                "content_count": signals.content_count,
            }

    if breakdown.platforms_verified == 0:
        return breakdown

    # ── 1. Coverage (30%) ────────────────────────────────
    # Scale: 1 platform = 40%, 2 = 70%, 3 = 90%, 4 = 100%
    coverage_map = {1: 40, 2: 70, 3: 90, 4: 100}
    coverage_pct = coverage_map.get(
        breakdown.platforms_verified,
        min(100, breakdown.platforms_verified * 25),
    )
    breakdown.coverage_score = coverage_pct * 0.30

    # ── 2. Account Age (20%) ─────────────────────────────
    # Best account age across platforms. Max score at 730 days (2 years).
    max_age = max(s.account_age_days for s in platform_signals if s.is_verified)
    age_pct = min(100, (max_age / 730) * 100)
    breakdown.age_score = age_pct * 0.20

    # ── 3. Social Signals (15%) ──────────────────────────
    # Total followers across platforms. Log scale, max at 10000.
    total_followers = sum(s.followers for s in platform_signals if s.is_verified)
    if total_followers > 0:
        import math
        social_pct = min(100, (math.log10(total_followers + 1) / math.log10(10001)) * 100)
    else:
        social_pct = 0
    breakdown.social_score = social_pct * 0.15

    # ── 4. Content Signals (10%) ─────────────────────────
    # Total content items. Log scale, max at 500.
    total_content = sum(s.content_count for s in platform_signals if s.is_verified)
    if total_content > 0:
        import math
        content_pct = min(100, (math.log10(total_content + 1) / math.log10(501)) * 100)
    else:
        content_pct = 0
    breakdown.content_score = content_pct * 0.10

    # ── 5. Verification Freshness (15%) ──────────────────
    # Most recent verification. Max score if within 7 days, drops linearly to 0 at 90 days.
    now = datetime.now(timezone.utc)
    most_recent = max(
        (s.verified_at for s in platform_signals if s.is_verified and s.verified_at),
        default=None,
    )
    if most_recent:
        # Ensure timezone-aware comparison
        if most_recent.tzinfo is None:
            most_recent = most_recent.replace(tzinfo=timezone.utc)
        days_since = (now - most_recent).days
        if days_since <= 7:
            freshness_pct = 100
        elif days_since >= 90:
            freshness_pct = 0
        else:
            freshness_pct = max(0, 100 - ((days_since - 7) / 83) * 100)
    else:
        freshness_pct = 0
    breakdown.freshness_score = freshness_pct * 0.15

    # ── 6. Name Consistency (10%) ────────────────────────
    # Check if display names across platforms are similar.
    names = [
        s.display_name.strip().lower()
        for s in platform_signals
        if s.is_verified and s.display_name.strip()
    ]
    if len(names) >= 2:
        # Simple check: count how many names match the most common name
        from collections import Counter
        name_counts = Counter(names)
        most_common_count = name_counts.most_common(1)[0][1]
        consistency_pct = (most_common_count / len(names)) * 100
    elif len(names) == 1:
        consistency_pct = 50  # Can't verify consistency with one name
    else:
        consistency_pct = 0
    breakdown.consistency_score = consistency_pct * 0.10

    # ── Total ────────────────────────────────────────────
    raw_total = (
        breakdown.coverage_score
        + breakdown.age_score
        + breakdown.social_score
        + breakdown.content_score
        + breakdown.freshness_score
        + breakdown.consistency_score
    )
    breakdown.total_score = min(100, max(0, round(raw_total)))

    return breakdown
