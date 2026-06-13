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


@router.get("/demo", response_class=HTMLResponse)
async def view_demo_profile(request: Request):
    """Render a demo public profile page with mocked verification data."""
    from datetime import datetime

    class DummyUser:
        slug = "demo-user"
        display_name = "Jane Doe"
        created_at = datetime.now()

    user = DummyUser()

    class DummyTrustBreakdown:
        total_score = 92
        platforms_verified = 3
        github_verified = True
        linkedin_verified = True
        whatsapp_verified = True
        facebook_verified = False

    trust_breakdown = DummyTrustBreakdown()

    verifications = {
        "github": {
            "status": "verified",
            "username": "janedoe-dev",
            "verified_at": datetime.now().isoformat(),
            "metadata": {
                "public_repos": 42,
                "followers": 185,
                "company": "Decentralized Corp",
                "location": "Remote",
                "bio": "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems.",
                "html_url": "https://github.com",
            }
        },
        "linkedin": {
            "status": "verified",
            "username": "jane-doe",
            "verified_at": datetime.now().isoformat(),
            "metadata": {
                "given_name": "Jane",
                "family_name": "Doe",
                "email": "jane.doe@example.com",
                "locale": "en_US",
            }
        },
        "whatsapp": {
            "status": "verified",
            "username": "+1234567890",
            "verified_at": datetime.now().isoformat(),
            "metadata": {
                "phone_hash": "a8f3b2d9e0c1f2a3",
            }
        }
    }

    import json
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Jane Doe",
        "alternateName": "demo-user",
        "url": f"{request.app.state.public_url}/demo",
        "sameAs": ["https://github.com"],
        "description": "Senior Backend & Infrastructure Engineer. Building open-source decentralized systems."
    }

    og_meta = {
        "og:title": "Jane Doe — Verified IDme Profile",
        "og:description": "Verified IDme profile with a Trust Score of 92.",
        "og:url": f"{request.app.state.public_url}/demo",
        "og:type": "profile",
        "og:site_name": "IDme",
        "twitter:card": "summary_large_image",
        "twitter:title": "Jane Doe — Verified IDme Profile",
        "twitter:description": "Verified IDme profile with a Trust Score of 92."
    }

    custom_avatar = "/static/images/demo_headshot.png"

    return request.app.state.templates.TemplateResponse(
        request,
        "profile.html",
        {
            "request": request,
            "user": user,
            "verifications": verifications,
            "trust_score": 92,
            "trust_breakdown": trust_breakdown,
            "og_meta": og_meta,
            "json_ld": json.dumps(json_ld),
            "custom_avatar": custom_avatar,
            "profile_url": f"{request.app.state.public_url}/demo",
        },
    )


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
            request,
            "not_found.html",
            {"request": request, "slug": slug},
            status_code=404,
        )

    if not user.onboarding_complete:
        return request.app.state.templates.TemplateResponse(
            request,
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

    # Build JSON-LD structured data for search crawlers & AI agents
    import json
    same_as = []
    if "github" in verifications and verifications["github"]["metadata"].get("html_url"):
        same_as.append(verifications["github"]["metadata"]["html_url"])
    if "facebook" in verifications and verifications["facebook"]["metadata"].get("profile_url"):
        same_as.append(verifications["facebook"]["metadata"]["profile_url"])

    json_ld = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": user.display_name or user.slug,
        "alternateName": user.slug,
        "url": f"{request.app.state.public_url}/{user.slug}",
    }
    if same_as:
        json_ld["sameAs"] = same_as

    bio = ""
    if "github" in verifications and verifications["github"]["metadata"].get("bio"):
        bio = verifications["github"]["metadata"]["bio"]
    if bio:
        json_ld["description"] = bio

    json_ld_str = json.dumps(json_ld)

    # Check if a custom uploaded headshot exists
    import os
    custom_avatar = None
    for ext in ["png", "jpg", "jpeg", "webp", "gif"]:
        path = f"static/uploads/{user.slug}.{ext}"
        if os.path.exists(path):
            custom_avatar = f"/static/uploads/{user.slug}.{ext}"
            break

    return request.app.state.templates.TemplateResponse(
        request,
        "profile.html",
        {
            "request": request,
            "user": user,
            "verifications": verifications,
            "trust_score": trust.total_score,
            "trust_breakdown": trust,
            "og_meta": og_meta,
            "json_ld": json_ld_str,
            "custom_avatar": custom_avatar,
            "profile_url": f"{request.app.state.public_url}/{user.slug}",
        },
    )


def _generate_ai_summary(user, trust, verifications: dict) -> str:
    """Compile a synthesized, LLM-optimized profile summary for CVs/portfolios."""
    summary_parts = [
        f"IDme Profile Summary for {user.display_name or user.slug} (@{user.slug})",
        f"Overall Identity Trust Score: {trust.total_score}/100",
        f"Account Created: {user.created_at.strftime('%Y-%m-%d') if user.created_at else 'N/A'}",
        "\nVerified Platforms & Intelligence Gathered:"
    ]

    for platform, data in verifications.items():
        meta = data.get("metadata", {})
        username = data.get("username")
        verified_at = data.get("verified_at")

        part = f"- {platform.upper()}: username='{username}' (Verified: {verified_at})"
        if platform == "github":
            part += f"\n  * Repositories: {meta.get('public_repos', 0)}"
            part += f"\n  * Followers: {meta.get('followers', 0)}"
            if meta.get("company"):
                part += f"\n  * Company: {meta.get('company')}"
            if meta.get("location"):
                part += f"\n  * Location: {meta.get('location')}"
            if meta.get("bio"):
                part += f"\n  * Bio: {meta.get('bio')}"
        elif platform == "linkedin":
            name = f"{meta.get('given_name', '')} {meta.get('family_name', '')}".strip()
            if name:
                part += f"\n  * Verified Name: {name}"
            if meta.get("email"):
                part += f"\n  * Email: {meta.get('email')}"
            if meta.get("locale"):
                part += f"\n  * Locale: {meta.get('locale')}"
        elif platform == "facebook":
            if meta.get("profile_url"):
                part += f"\n  * Profile: {meta.get('profile_url')}"
        elif platform == "whatsapp":
            part += "\n  * Phone number verified owner"

        summary_parts.append(part)

    return "\n".join(summary_parts)


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
    verifications_meta_dict = {}
    for v in user.verifications:
        if v.status == "verified":
            verifications[v.platform] = VerificationResponse(
                platform=v.platform,
                status=v.status,
                username=v.platform_username,
                verified_at=v.verified_at,
                metadata=v.metadata_json or {},
            )
            verifications_meta_dict[v.platform] = {
                "username": v.platform_username,
                "verified_at": v.verified_at.isoformat() if v.verified_at else None,
                "metadata": v.metadata_json or {},
            }

    ai_summary = _generate_ai_summary(user, trust, verifications_meta_dict)

    return IDmeProfileResponse(
        slug=user.slug,
        display_name=user.display_name,
        trust_score=trust.total_score,
        verifications=verifications,
        created_at=user.created_at,
        profile_url=f"https://idme.io/{user.slug}",
        ai_summary=ai_summary,
    )


@router.get("/{slug}/ai")
async def view_profile_ai(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Dedicated AI-agent endpoint. Returns consolidated multiaccess intelligence
    tailored specifically for LLMs to generate a CV, portfolio, or profile summary.
    """
    slug = slug.lower()

    result = await db.execute(select(User).where(User.slug == slug))
    user = result.scalar_one_or_none()

    if not user or not user.onboarding_complete:
        raise HTTPException(status_code=404, detail="Profile not found")

    trust = compute_trust_score(user.verifications)

    # Gather clean verified details
    verifications_meta = {}
    for v in user.verifications:
        if v.status == "verified":
            verifications_meta[v.platform] = {
                "username": v.platform_username,
                "verified_at": v.verified_at.isoformat() if v.verified_at else None,
                "metadata": v.metadata_json or {},
            }

    ai_summary = _generate_ai_summary(user, trust, verifications_meta)

    llm_prompt_context = (
        f"You are an expert career advisor and resume writer. Below is the verified identity, "
        f"social proof, and activity data gathered via IDme for {user.display_name or user.slug}.\n\n"
        f"--- START VERIFIED IDENTITY PROFILE ---\n"
        f"{ai_summary}\n"
        f"--- END VERIFIED IDENTITY PROFILE ---\n\n"
        f"Tasks for the AI Agent:\n"
        f"1. Generate a tailored and optimized professional CV / Resume for this user based on their verified platform presence.\n"
        f"2. Suggest portfolio layout, projects to highlight (using public repo metrics), and professional summary hooks.\n"
        f"3. Do not invent details not present in the verified metadata; highlight only factual, cross-verified achievements."
    )

    return {
        "slug": user.slug,
        "display_name": user.display_name,
        "trust_score": trust.total_score,
        "raw_verifications": verifications_meta,
        "ai_summary": ai_summary,
        "llm_prompt_context": llm_prompt_context,
    }


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
