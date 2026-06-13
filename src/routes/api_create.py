"""
IDme — API Routes for Identity Creation

Endpoints:
- POST /api/create — Create identity, return session + OAuth URLs
- POST /api/check-slug — Check slug availability (real-time)
- GET  /api/session/{token} — Check verification status
- POST /api/complete/{token} — Finalize onboarding
- POST /api/whatsapp/verify — Initiate WhatsApp verification
- POST /api/whatsapp/confirm/{code} — Confirm WhatsApp verification
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models import User, Verification
from src.oauth import GitHubOAuth, LinkedInOAuth, FacebookOAuth, WhatsAppVerifier
from src.schemas import CreateIDmeRequest, SlugCheckRequest, WhatsAppVerifyRequest
from src.verification import encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["api"])


@router.post("/create")
async def create_idme(
    payload: CreateIDmeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new IDme identity.
    Returns session token and OAuth authorization URLs for all platforms.
    """
    # Check slug availability
    result = await db.execute(select(User).where(User.slug == payload.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken")

    # Generate cryptographic session token
    session_token = secrets.token_urlsafe(48)

    # SIDE EFFECT: Database insert. Why necessary and unavoidable: creates the identity
    # record that OAuth callbacks will attach verifications to.
    user = User(
        slug=payload.slug,
        session_token=session_token,
    )
    db.add(user)
    await db.flush()

    # Generate OAuth authorization URLs
    oauth_urls = {}

    if settings.GITHUB_CLIENT_ID:
        github = GitHubOAuth()
        github_state = await github.create_state(session_token)
        oauth_urls["github"] = github.get_authorize_url(github_state)

    if settings.LINKEDIN_CLIENT_ID:
        linkedin = LinkedInOAuth()
        linkedin_state = await linkedin.create_state(session_token)
        oauth_urls["linkedin"] = linkedin.get_authorize_url(linkedin_state)

    if settings.FACEBOOK_CLIENT_ID:
        facebook = FacebookOAuth()
        facebook_state = await facebook.create_state(session_token)
        oauth_urls["facebook"] = facebook.get_authorize_url(facebook_state)

    return {
        "success": True,
        "session_token": session_token,
        "slug": payload.slug,
        "oauth_urls": oauth_urls,
        "whatsapp_available": True,
        "next": "Connect your platforms to verify your identity.",
    }


@router.post("/check-slug")
async def check_slug(
    payload: SlugCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check if a username/slug is available. Used for real-time feedback."""
    try:
        # Re-use the same validation as CreateIDmeRequest
        validated = CreateIDmeRequest(slug=payload.slug)
        slug = validated.slug
    except ValueError as e:
        return {"available": False, "reason": str(e)}

    result = await db.execute(select(User).where(User.slug == slug))
    taken = result.scalar_one_or_none() is not None

    return {
        "available": not taken,
        "slug": slug,
        "reason": "Username already taken" if taken else None,
    }


@router.get("/session/{session_token}")
async def get_session_status(
    session_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Check verification status for a session. Used by create page polling."""
    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Session not found")

    verifications = []
    for v in user.verifications:
        verifications.append({
            "platform": v.platform,
            "status": v.status,
            "username": v.platform_username,
            "verified_at": v.verified_at.isoformat() if v.verified_at else None,
            "metadata": v.metadata_json,
        })

    # Generate fresh OAuth authorization URLs
    oauth_urls = {}

    if settings.GITHUB_CLIENT_ID:
        github = GitHubOAuth()
        github_state = await github.create_state(session_token)
        oauth_urls["github"] = github.get_authorize_url(github_state)

    if settings.LINKEDIN_CLIENT_ID:
        linkedin = LinkedInOAuth()
        linkedin_state = await linkedin.create_state(session_token)
        oauth_urls["linkedin"] = linkedin.get_authorize_url(linkedin_state)

    if settings.FACEBOOK_CLIENT_ID:
        facebook = FacebookOAuth()
        facebook_state = await facebook.create_state(session_token)
        oauth_urls["facebook"] = facebook.get_authorize_url(facebook_state)

    return {
        "slug": user.slug,
        "display_name": user.display_name,
        "onboarding_complete": user.onboarding_complete,
        "profile_url": f"/{user.slug}",
        "verifications": verifications,
        "oauth_urls": oauth_urls,
    }



@router.post("/complete/{session_token}")
async def complete_onboarding(
    session_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Finalize onboarding. Requires at least one verified platform."""
    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Session not found")

    verified_count = sum(1 for v in user.verifications if v.status == "verified")
    if verified_count == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one platform must be verified before completing",
        )

    user.onboarding_complete = True
    await db.flush()

    return {
        "success": True,
        "slug": user.slug,
        "profile_url": f"/{user.slug}",
        "verified_platforms": verified_count,
    }


@router.post("/whatsapp/verify")
async def initiate_whatsapp_verification(
    payload: WhatsAppVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate WhatsApp click-to-chat verification link."""
    # Validate session
    result = await db.execute(
        select(User).where(User.session_token == payload.session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Session not found")

    verifier = WhatsAppVerifier()
    verification_data = await verifier.generate_verification(
        payload.phone, payload.session_token
    )

    return {
        "success": True,
        "verification_link": verification_data["verification_link"],
        "code": verification_data["code"],
    }


@router.post("/whatsapp/confirm/{code}")
async def confirm_whatsapp_verification(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm that user sent the WhatsApp verification message.
    If Twilio is configured, we strictly require the webhook to have completed it.
    If not, we allow the fallback confirmation.
    """
    from src.redis_client import redis_client
    slug = await redis_client.get(f"whatsapp_verified:{code}")

    if slug:
        await redis_client.delete(f"whatsapp_verified:{code}")
        return {
            "success": True,
            "verified": True,
            "profile_url": f"/{slug}",
        }

    # If Twilio credentials are set, we strictly require the webhook!
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(
            status_code=400,
            detail="Verification message not received yet. Please send the message on WhatsApp and try again.",
        )

    # Fallback (non-Twilio mode) - click-to-chat trust on first use
    verifier = WhatsAppVerifier()
    confirmation = await verifier.confirm_verification(code)

    if not confirmation:
        raise HTTPException(
            status_code=400,
            detail="Verification code not found or expired",
        )

    # Find user
    result = await db.execute(
        select(User).where(User.session_token == confirmation["session_token"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check for existing WhatsApp verification
    existing = await db.execute(
        select(Verification).where(
            Verification.user_id == user.id,
            Verification.platform == "whatsapp",
        )
    )
    verification = existing.scalar_one_or_none()

    phone = confirmation["phone"]
    phone_hash = hashlib.sha256(phone.encode()).hexdigest()[:16]

    if verification:
        verification.platform_user_id = phone
        verification.platform_username = phone
        verification.status = "verified"
        verification.verified_at = datetime.now(timezone.utc)
        verification.metadata_json = {"phone_hash": phone_hash, "verified_via": "fallback"}
    else:
        verification = Verification(
            user_id=user.id,
            platform="whatsapp",
            platform_user_id=phone,
            platform_username=phone,
            status="verified",
            verified_at=datetime.now(timezone.utc),
            metadata_json={"phone_hash": phone_hash, "verified_via": "fallback"},
        )
        db.add(verification)

    user.onboarding_complete = True
    await db.flush()

    return {
        "success": True,
        "verified": True,
        "profile_url": f"/{user.slug}",
    }


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio WhatsApp Webhook.
    Called by Twilio when a user sends a message to our Twilio WhatsApp number.
    """
    import re
    import json

    logger.info(f"Received WhatsApp webhook from {From}: {Body}")

    # Extract code: IDme-verify-xxxx
    match = re.search(r"IDme-verify-([a-f0-9]+)", Body, re.IGNORECASE)
    if not match:
        logger.warning(f"No verification code found in message: {Body}")
        return {"status": "ignored"}

    code = match.group(1).lower()

    # Fetch verification data from Redis
    from src.redis_client import redis_client
    key = f"whatsapp_verify:{code}"
    data = await redis_client.get(key)
    if not data:
        logger.warning(f"Verification code {code} not found or expired in Redis")
        return {"status": "expired"}

    parsed = json.loads(data)
    session_token = parsed["session_token"]

    # Clean the sender's phone number
    sender_phone = From.replace("whatsapp:", "").strip()

    # Find user by session token
    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.error(f"User not found for session token in verification code {code}")
        return {"status": "user_not_found"}

    # Check/create verification
    existing = await db.execute(
        select(Verification).where(
            Verification.user_id == user.id,
            Verification.platform == "whatsapp",
        )
    )
    verification = existing.scalar_one_or_none()

    phone_hash = hashlib.sha256(sender_phone.encode()).hexdigest()[:16]

    if verification:
        verification.platform_user_id = sender_phone
        verification.platform_username = sender_phone
        verification.status = "verified"
        verification.verified_at = datetime.now(timezone.utc)
        verification.metadata_json = {"phone_hash": phone_hash, "verified_via": "webhook"}
    else:
        verification = Verification(
            user_id=user.id,
            platform="whatsapp",
            platform_user_id=sender_phone,
            platform_username=sender_phone,
            status="verified",
            verified_at=datetime.now(timezone.utc),
            metadata_json={"phone_hash": phone_hash, "verified_via": "webhook"},
        )
        db.add(verification)

    # Mark onboarding complete
    user.onboarding_complete = True
    await db.flush()

    # Store in Redis that webhook verification succeeded and map it to user's slug
    await redis_client.setex(f"whatsapp_verified:{code}", 600, user.slug)
    # Clean up the pending verification key
    await redis_client.delete(key)

    logger.info(f"WhatsApp verification successful for user {user.slug} from phone {sender_phone}")
    return {"status": "verified"}


@router.post("/upload-headshot/{session_token}")
async def upload_headshot(
    session_token: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a custom professional headshot image for the profile."""
    result = await db.execute(
        select(User).where(User.session_token == session_token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Session not found")

    import os
    os.makedirs("static/uploads", exist_ok=True)

    filename = file.filename or "headshot.png"
    ext = filename.split(".")[-1].lower()
    if ext not in ["png", "jpg", "jpeg", "webp", "gif"]:
        raise HTTPException(status_code=400, detail="Invalid image file format")

    # Clean up previous uploads with different extensions to avoid duplicates
    for existing_ext in ["png", "jpg", "jpeg", "webp", "gif"]:
        try:
            os.remove(f"static/uploads/{user.slug}.{existing_ext}")
        except FileNotFoundError:
            pass

    file_path = f"static/uploads/{user.slug}.{ext}"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "success": True,
        "avatar_url": f"/static/uploads/{user.slug}.{ext}",
    }
