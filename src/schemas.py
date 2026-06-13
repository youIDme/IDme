"""
IDme — Pydantic Schemas

Request/response models for API endpoints.
Includes slug validation with reserved word protection.
"""

import re
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator


# Slugs that would conflict with application routes or look official
RESERVED_SLUGS = {
    "admin", "api", "app", "blog", "cdn", "create", "dashboard",
    "docs", "health", "help", "idme", "login", "logout", "mail",
    "oauth", "profile", "root", "settings", "signup", "static",
    "status", "support", "test", "www", "verify", "about", "terms",
    "privacy", "contact", "faq", "pricing", "team", "jobs",
    "security", "legal", "embed", "badge", "qr", "json",
}


class CreateIDmeRequest(BaseModel):
    """Request body for POST /api/create"""

    slug: str = Field(..., min_length=1, max_length=100)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$", v):
            raise ValueError(
                "Username must start with a letter or number and "
                "can only contain letters, numbers, hyphens, and underscores"
            )
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if v.lower() in RESERVED_SLUGS:
            raise ValueError("This username is reserved")
        return v.lower()


class SlugCheckRequest(BaseModel):
    """Request body for POST /api/check-slug"""

    slug: str = Field(..., min_length=1, max_length=100)


class WhatsAppVerifyRequest(BaseModel):
    """Request body for POST /api/whatsapp/verify"""

    phone: str = Field(..., min_length=7, max_length=20)
    session_token: str = Field(..., min_length=1)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        if not re.match(r"^\+?[1-9]\d{6,14}$", cleaned):
            raise ValueError("Invalid phone number format")
        return cleaned


class VerificationResponse(BaseModel):
    """Single platform verification in API responses"""

    platform: str
    status: str
    username: Optional[str] = None
    verified_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


class IDmeProfileResponse(BaseModel):
    """Full profile response for /{slug}/json"""

    slug: str
    display_name: Optional[str]
    trust_score: int
    verifications: Dict[str, VerificationResponse]
    created_at: datetime
    profile_url: str
    ai_summary: Optional[str] = None


class SessionStatusResponse(BaseModel):
    """Response for GET /api/session/{token}"""

    slug: str
    onboarding_complete: bool
    profile_url: str
    verifications: list
