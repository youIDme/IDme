"""
IDme — Profile Routes

Endpoints:
- GET /{slug} — Render public profile page (HTML)
- GET /{slug}/json — Machine-readable profile data (JSON)
- GET /{slug}/badge.js — Embeddable trust badge script
- GET /{slug}/qr — QR code PNG image
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import User, ProfileVisit
from src.rendering import generate_badge_js, generate_qr_code, get_og_meta
from src.schemas import IDmeProfileResponse, VerificationResponse
from src.trust_engine import compute_trust_score

logger = logging.getLogger(__name__)

router = APIRouter(tags=["profile"])


async def _record_visit(user_id, request: Request, db: AsyncSession):
    """Fire-and-forget visit recording to avoid blocking profile render."""
    try:
        async with db.begin_nested():
            visit = ProfileVisit(
                user_id=user_id,
                visitor_ip=request.client.host if request.client else None,
                visitor_user_agent=request.headers.get("User-Agent", "")[:512],
                referrer=request.headers.get("Referer", "")[:512],
            )
            db.add(visit)
    except Exception as e:
        # Visit tracking failure must never break profile rendering
        logger.warning(f"IDM-PROFILE-001 _record_visit: failed: {type(e).__name__}")


@router.get("/{slug}", response_class=HTMLResponse)
async def view_profile(
    request: Request,
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Render public IDme profile page."""
    slug = slug.lower()

    result = await db.execute(select(User).where(User.slug == slug))
    user = result.scalar_one_or_none()

    if not user:
        return request.app.state.templates.TemplateResponse(
            "not_found.html",
            {"request": request, "slug": slug},
            status_code=404,
        )

    if not user.onboarding_complete:
        return request.app.state.templates.TemplateResponse(
            "not_found.html",
            {"request": request, "slug": slug},
            status_code=404,
        )

    # Record visit in background (non-blocking)
    asyncio.create_task(_record_visit(user.id, request, db))

    # Compute trust score
    trust = compute_trust_score(user.verifications)

    # Build verification data for template
    verifications = {}
    for v in user.verifications:
        if v.status == "verified":
            verifications[v.platform] = {
                "status": v.status,
                "username": v.platform_username,
                "verified_at": v.verified_at.isoformat() if v.verified_at else None,
                "metadata": v.metadata_json or {},
            }

    # OG meta tags
    og_meta = get_og_meta(
        slug=user.slug,
        display_name=user.display_name or user.slug,
        trust_score=trust.total_score,
        platforms_count=trust.platforms_verified,
    )

    return request.app.state.templates.TemplateResponse(
        "profile.html",
        {
            "request": request,
            "user": user,
            "verifications": verifications,
            "trust_score": trust.total_score,
            "trust_breakdown": trust,
            "og_meta": og_meta,
            "profile_url": f"{request.app.state.public_url}/{user.slug}",
        },
    )


@router.get("/{slug}/json")
async def view_profile_json(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """JSON endpoint for machine-readable profile data."""
    slug = slug.lower()

    result = await db.execute(select(User).where(User.slug == slug))
    user = result.scalar_one_or_none()

    if not user or not user.onboarding_complete:
        raise HTTPException(status_code=404, detail="Profile not found")

    trust = compute_trust_score(user.verifications)

    verifications = {}
    for v in user.verifications:
        if v.status == "verified":
            verifications[v.platform] = VerificationResponse(
                platform=v.platform,
                status=v.status,
                username=v.platform_username,
                verified_at=v.verified_at,
            )

    return IDmeProfileResponse(
        slug=user.slug,
        display_name=user.display_name,
        trust_score=trust.total_score,
        verifications=verifications,
        created_at=user.created_at,
        profile_url=f"https://idme.io/{user.slug}",
    )


@router.get("/{slug}/badge.js")
async def profile_badge(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Embeddable JavaScript badge for external sites."""
    slug = slug.lower()

    result = await db.execute(select(User).where(User.slug == slug))
    user = result.scalar_one_or_none()

    if not user or not user.onboarding_complete:
        return Response(
            content="/* IDme: profile not found */",
            media_type="application/javascript",
        )

    trust = compute_trust_score(user.verifications)
    js_code = generate_badge_js(user.slug, trust.total_score)

    return Response(
        content=js_code,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300"},  # 5-minute cache
    )


@router.get("/{slug}/qr")
async def profile_qr_code(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate QR code PNG for profile URL."""
    slug = slug.lower()

    result = await db.execute(select(User).where(User.slug == slug))
    user = result.scalar_one_or_none()

    if not user or not user.onboarding_complete:
        raise HTTPException(status_code=404, detail="Profile not found")

    qr_bytes = generate_qr_code(user.slug)

    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},  # 24-hour cache
    )
