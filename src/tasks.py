"""
IDme — Background Tasks

Periodic jobs:
- Slug cleanup: Release unclaimed slugs after SLUG_EXPIRY_HOURS
- Re-verification: Check if OAuth tokens are still valid (future)
- Analytics: Aggregate visit counts (future)

These run via asyncio tasks started during app lifespan.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete

from src.config import settings
from src.database import async_session_factory
from src.models import User

logger = logging.getLogger(__name__)


async def cleanup_unclaimed_slugs():
    """
    Release slugs from users who started onboarding but never completed it.

    Runs every hour. Deletes User records where:
    - onboarding_complete is False
    - created_at is older than SLUG_EXPIRY_HOURS

    This prevents username squatting from abandoned sessions.
    """
    while True:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(
                hours=settings.SLUG_EXPIRY_HOURS
            )

            async with async_session_factory() as session:
                result = await session.execute(
                    select(User).where(
                        User.onboarding_complete == False,  # noqa: E712
                        User.created_at < cutoff,
                    )
                )
                stale_users = result.scalars().all()

                if stale_users:
                    for user in stale_users:
                        await session.delete(user)

                    await session.commit()
                    logger.info(
                        f"IDM-TASK-001 cleanup_unclaimed_slugs: released {len(stale_users)} "
                        f"unclaimed slug(s)"
                    )

        except Exception as e:
            logger.error(
                f"IDM-TASK-002 cleanup_unclaimed_slugs: error: {type(e).__name__}: {e}"
            )

        # Run every hour
        await asyncio.sleep(3600)


async def refresh_profile_metadata():
    """
    Periodically refresh metadata for all verified OAuth profiles.

    Runs once every 24 hours. For each verified platform integration:
    - Decrypts the access token
    - Queries the platform API for fresh user stats
    - Updates metadata_json (followers, public_repos, etc.)
    - Marks status as 'expired' if the token was revoked or has expired.
    """
    from src.models import Verification
    from src.verification import decrypt_token
    from src.oauth import GitHubOAuth, LinkedInOAuth, FacebookOAuth

    # Map platforms to their OAuth provider classes
    providers = {
        "github": GitHubOAuth,
        "linkedin": LinkedInOAuth,
        "facebook": FacebookOAuth,
    }

    while True:
        try:
            logger.info("IDM-TASK-100 refresh_profile_metadata: starting periodic sync")
            async with async_session_factory() as session:
                # Get all verified OAuth verifications
                result = await session.execute(
                    select(Verification).where(
                        Verification.status == "verified",
                        Verification.platform.in_(list(providers.keys())),
                    )
                )
                verifications = result.scalars().all()

                for v in verifications:
                    if not v.access_token_enc:
                        logger.warning(
                            f"IDM-TASK-101 refresh_profile_metadata: verified verification {v.id} "
                            f"for platform {v.platform} has no access token"
                        )
                        v.status = "expired"
                        v.last_checked_at = datetime.now(timezone.utc)
                        continue

                    # Decrypt token
                    token = decrypt_token(v.access_token_enc)
                    if not token:
                        logger.error(
                            f"IDM-TASK-102 refresh_profile_metadata: decryption failed for verification {v.id}"
                        )
                        v.status = "expired"
                        v.last_checked_at = datetime.now(timezone.utc)
                        continue

                    # Instantiate provider
                    provider_class = providers[v.platform]
                    provider = provider_class()

                    try:
                        user_info = await provider.get_user(token)
                    except Exception as api_err:
                        logger.warning(
                            f"IDM-TASK-103 refresh_profile_metadata: API error during check for "
                            f"verification {v.id} ({v.platform}): {type(api_err).__name__}: {api_err}"
                        )
                        # Do not mark as expired on network/API failure, just try again next time
                        continue

                    if user_info:
                        # Success: update fields
                        v.platform_username = user_info["platform_username"]
                        v.metadata_json = user_info["metadata"]
                        v.last_checked_at = datetime.now(timezone.utc)
                        v.status = "verified"

                        # Sync display name if not set
                        if v.user and not v.user.display_name and user_info.get("display_name"):
                            v.user.display_name = user_info["display_name"]

                        logger.info(
                            f"IDM-TASK-104 refresh_profile_metadata: successfully refreshed metadata "
                            f"for user slug '{v.user.slug if v.user else 'unknown'}' on platform {v.platform}"
                        )
                    else:
                        # API returned None -> token expired, revoked, or invalid
                        logger.warning(
                            f"IDM-TASK-105 refresh_profile_metadata: token invalid/expired for "
                            f"verification {v.id} ({v.platform})"
                        )
                        v.status = "expired"
                        v.last_checked_at = datetime.now(timezone.utc)

                await session.commit()
                logger.info("IDM-TASK-106 refresh_profile_metadata: sync complete")

        except Exception as e:
            logger.error(
                f"IDM-TASK-107 refresh_profile_metadata: error: {type(e).__name__}: {e}"
            )

        # Run once a day
        await asyncio.sleep(86400)


async def start_background_tasks():
    """Start all background tasks. Called during app lifespan."""
    asyncio.create_task(cleanup_unclaimed_slugs())
    asyncio.create_task(refresh_profile_metadata())
    logger.info("Background tasks started")

