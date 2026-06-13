"""
IDme — OAuth Callback Routes

Handles the redirect back from OAuth providers after user authorization.
Each callback: validates state → exchanges code → fetches user → saves verification.

Endpoints:
- GET /oauth/github/callback
- GET /oauth/linkedin/callback
- GET /oauth/facebook/callback
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import User, Verification
from src.oauth import GitHubOAuth, LinkedInOAuth, FacebookOAuth
from src.verification import encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["oauth"])


async def _save_verification(
    db: AsyncSession,
    user: User,
    platform: str,
    user_info: dict,
    access_token: str,
) -> None:
    """
    Create or update a verification record for a platform.
    Shared logic across all OAuth callbacks.
    """
    existing = await db.execute(
        select(Verification).where(
            Verification.user_id == user.id,
            Verification.platform == platform,
        )
    )
    verification = existing.scalar_one_or_none()

    encrypted = encrypt_token(access_token)

    if verification:
        verification.platform_user_id = user_info["platform_user_id"]
        verification.platform_username = user_info["platform_username"]
        verification.access_token_enc = encrypted
        verification.status = "verified"
        verification.verified_at = datetime.now(timezone.utc)
        verification.metadata_json = user_info["metadata"]
    else:
        verification = Verification(
            user_id=user.id,
            platform=platform,
            platform_user_id=user_info["platform_user_id"],
            platform_username=user_info["platform_username"],
            access_token_enc=encrypted,
            status="verified",
            verified_at=datetime.now(timezone.utc),
            metadata_json=user_info["metadata"],
        )
        db.add(verification)

    # Set display name from first verified platform
    if not user.display_name and user_info.get("display_name"):
        user.display_name = user_info["display_name"]

    # Mark onboarding complete on any successful verification
    user.onboarding_complete = True

    await db.flush()


# ═══════════════════════════════════════════════════════════
# GitHub
# ═══════════════════════════════════════════════════════════

@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle GitHub OAuth callback."""
    github = GitHubOAuth()

    session_token = await github.validate_state(state)
    if not session_token:
        return RedirectResponse(url="/create?error=invalid_state")

    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/create?error=session_not_found")

    access_token = await github.exchange_code(code)
    if not access_token:
        return RedirectResponse(
            url=f"/create?error=github_auth_failed&session={session_token}"
        )

    user_info = await github.get_user(access_token)
    if not user_info:
        return RedirectResponse(
            url=f"/create?error=github_api_failed&session={session_token}"
        )

    await _save_verification(db, user, "github", user_info, access_token)

    logger.info(
        f"IDM-OAUTH-100 github_callback: verified user={user.slug}, "
        f"github_user={user_info['platform_username']}"
    )

    return RedirectResponse(
        url=f"/create?github=success&session={session_token}"
    )


# ═══════════════════════════════════════════════════════════
# LinkedIn
# ═══════════════════════════════════════════════════════════

@router.get("/linkedin/callback")
async def linkedin_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
    error_description: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle LinkedIn OAuth callback."""
    if error:
        logger.warning(
            f"IDM-OAUTH-110 linkedin_callback: user denied, error={error}, "
            f"desc={error_description}"
        )
        return RedirectResponse(url="/create?error=linkedin_denied")

    linkedin = LinkedInOAuth()

    session_token = await linkedin.validate_state(state)
    if not session_token:
        return RedirectResponse(url="/create?error=invalid_state")

    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/create?error=session_not_found")

    access_token = await linkedin.exchange_code(code)
    if not access_token:
        return RedirectResponse(
            url=f"/create?error=linkedin_auth_failed&session={session_token}"
        )

    user_info = await linkedin.get_user(access_token)
    if not user_info:
        return RedirectResponse(
            url=f"/create?error=linkedin_api_failed&session={session_token}"
        )

    await _save_verification(db, user, "linkedin", user_info, access_token)

    logger.info(
        f"IDM-OAUTH-111 linkedin_callback: verified user={user.slug}, "
        f"linkedin_user={user_info['platform_username']}"
    )

    return RedirectResponse(
        url=f"/create?linkedin=success&session={session_token}"
    )


# ═══════════════════════════════════════════════════════════
# Facebook
# ═══════════════════════════════════════════════════════════

@router.get("/facebook/callback")
async def facebook_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
    error_reason: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle Facebook OAuth callback."""
    if error:
        logger.warning(
            f"IDM-OAUTH-120 facebook_callback: user denied, error={error}, "
            f"reason={error_reason}"
        )
        return RedirectResponse(url="/create?error=facebook_denied")

    facebook = FacebookOAuth()

    session_token = await facebook.validate_state(state)
    if not session_token:
        return RedirectResponse(url="/create?error=invalid_state")

    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        return RedirectResponse(url="/create?error=session_not_found")

    access_token = await facebook.exchange_code(code)
    if not access_token:
        return RedirectResponse(
            url=f"/create?error=facebook_auth_failed&session={session_token}"
        )

    user_info = await facebook.get_user(access_token)
    if not user_info:
        return RedirectResponse(
            url=f"/create?error=facebook_api_failed&session={session_token}"
        )

    await _save_verification(db, user, "facebook", user_info, access_token)

    logger.info(
        f"IDM-OAUTH-121 facebook_callback: verified user={user.slug}, "
        f"facebook_user={user_info['platform_username']}"
    )

    return RedirectResponse(
        url=f"/create?facebook=success&session={session_token}"
    )
