"""
IDme — OAuth Provider Implementations

Platforms (v1.0):
- GitHub: Standard OAuth 2.0 code grant
- LinkedIn: OAuth 2.0 with OpenID Connect
- Facebook: OAuth 2.0 code grant (Graph API v19.0)
- WhatsApp: Click-to-chat verification (no OAuth)

Each provider manages its own state tokens via Redis (10-min TTL, single-use).
"""

import hashlib
import json
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from httpx import AsyncClient

from src.config import settings
from src.redis_client import redis_client

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
# Base Provider
# ═══════════════════════════════════════════════════════════

class OAuthProvider:
    """Base OAuth provider with Redis-backed state management."""

    def __init__(self, platform: str):
        self.platform = platform

    async def create_state(self, session_token: str) -> str:
        """Create and store a single-use OAuth state token in Redis (10-min TTL)."""
        state = secrets.token_urlsafe(32)

        # SIDE EFFECT: Redis write. Why necessary and unavoidable: OAuth state must be
        # persisted between the redirect and callback (two separate HTTP requests).
        await redis_client.setex(
            f"oauth_state:{state}",
            600,  # 10 minutes
            f"{session_token}:{self.platform}",
        )

        return state

    async def validate_state(self, state: str) -> Optional[str]:
        """
        Validate OAuth state, return session_token if valid.
        Deletes the state token after use (single-use enforcement).
        """
        key = f"oauth_state:{state}"
        value = await redis_client.get(key)

        if not value:
            logger.warning(f"IDM-OAUTH-001 validate_state: state token not found or expired, platform={self.platform}")
            return None

        # SIDE EFFECT: Redis delete. Why necessary and unavoidable: prevents replay attacks.
        await redis_client.delete(key)

        parts = value.split(":", 1)
        if len(parts) != 2:
            logger.error(f"IDM-OAUTH-002 validate_state: malformed state value, platform={self.platform}")
            return None

        session_token, platform = parts
        if platform != self.platform:
            logger.error(
                f"IDM-OAUTH-003 validate_state: platform mismatch, "
                f"expected={self.platform}, got={platform}"
            )
            return None

        return session_token


# ═══════════════════════════════════════════════════════════
# GitHub
# ═══════════════════════════════════════════════════════════

class GitHubOAuth(OAuthProvider):
    AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    API_URL = "https://api.github.com"

    def __init__(self):
        super().__init__("github")

    def get_authorize_url(self, state: str) -> str:
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": f"{settings.PUBLIC_URL}/oauth/github/callback",
            "scope": "read:user",
            "state": state,
            "allow_signup": "false",
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> Optional[str]:
        """Exchange authorization code for access token."""
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self.TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-010 exchange_code: GitHub token exchange failed, "
                    f"status={resp.status_code}"
                )
                return None

            data = resp.json()
            if "error" in data:
                logger.error(
                    f"IDM-OAUTH-011 exchange_code: GitHub returned error={data.get('error')}"
                )
                return None

            return data.get("access_token")

    async def get_user(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch GitHub user profile."""
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.API_URL}/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-012 get_user: GitHub API failed, status={resp.status_code}"
                )
                return None

            data = resp.json()
            return {
                "platform_user_id": str(data["id"]),
                "platform_username": data["login"],
                "display_name": data.get("name") or data["login"],
                "metadata": {
                    "avatar_url": data.get("avatar_url"),
                    "html_url": data.get("html_url"),
                    "bio": data.get("bio"),
                    "company": data.get("company"),
                    "location": data.get("location"),
                    "public_repos": data.get("public_repos", 0),
                    "followers": data.get("followers", 0),
                    "created_at": data.get("created_at"),
                },
            }


# ═══════════════════════════════════════════════════════════
# LinkedIn
# ═══════════════════════════════════════════════════════════

class LinkedInOAuth(OAuthProvider):
    AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
    TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

    def __init__(self):
        super().__init__("linkedin")

    def get_authorize_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": f"{settings.PUBLIC_URL}/oauth/linkedin/callback",
            "scope": "openid profile email",
            "state": state,
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> Optional[str]:
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self.TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.LINKEDIN_CLIENT_ID,
                    "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                    "redirect_uri": f"{settings.PUBLIC_URL}/oauth/linkedin/callback",
                },
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-020 exchange_code: LinkedIn token exchange failed, "
                    f"status={resp.status_code}"
                )
                return None

            data = resp.json()
            return data.get("access_token")

    async def get_user(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch LinkedIn user profile via OpenID Connect userinfo."""
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-021 get_user: LinkedIn API failed, status={resp.status_code}"
                )
                return None

            data = resp.json()
            return {
                "platform_user_id": data["sub"],
                "platform_username": data.get("email", data["sub"]),
                "display_name": data.get("name", ""),
                "metadata": {
                    "email": data.get("email"),
                    "picture": data.get("picture"),
                    "given_name": data.get("given_name"),
                    "family_name": data.get("family_name"),
                    "locale": data.get("locale"),
                },
            }


# ═══════════════════════════════════════════════════════════
# Facebook
# ═══════════════════════════════════════════════════════════

class FacebookOAuth(OAuthProvider):
    AUTHORIZE_URL = "https://www.facebook.com/v19.0/dialog/oauth"
    TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
    API_URL = "https://graph.facebook.com/v19.0"

    def __init__(self):
        super().__init__("facebook")

    def get_authorize_url(self, state: str) -> str:
        params = {
            "client_id": settings.FACEBOOK_CLIENT_ID,
            "redirect_uri": f"{settings.PUBLIC_URL}/oauth/facebook/callback",
            "scope": "public_profile",
            "state": state,
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> Optional[str]:
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self.TOKEN_URL,
                params={
                    "client_id": settings.FACEBOOK_CLIENT_ID,
                    "client_secret": settings.FACEBOOK_CLIENT_SECRET,
                    "redirect_uri": f"{settings.PUBLIC_URL}/oauth/facebook/callback",
                    "code": code,
                },
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-030 exchange_code: Facebook token exchange failed, "
                    f"status={resp.status_code}"
                )
                return None

            data = resp.json()
            return data.get("access_token")

    async def get_user(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch Facebook user profile via Graph API."""
        async with AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.API_URL}/me",
                params={
                    "fields": "id,name,picture.type(large),link",
                    "access_token": access_token,
                },
            )

            if resp.status_code != 200:
                logger.error(
                    f"IDM-OAUTH-031 get_user: Facebook API failed, status={resp.status_code}"
                )
                return None

            data = resp.json()
            avatar_url = None
            picture_data = data.get("picture")
            if isinstance(picture_data, dict):
                avatar_url = picture_data.get("data", {}).get("url")

            username = data["id"]
            link = data.get("link", "")
            if link:
                # Extract username from facebook.com/username URL
                parts = link.rstrip("/").split("/")
                if parts:
                    username = parts[-1]

            return {
                "platform_user_id": data["id"],
                "platform_username": username,
                "display_name": data.get("name", ""),
                "metadata": {
                    "profile_url": data.get("link"),
                    "avatar_url": avatar_url,
                },
            }


# ═══════════════════════════════════════════════════════════
# WhatsApp — Click-to-Chat Verification (No OAuth)
# ═══════════════════════════════════════════════════════════

class WhatsAppVerifier:
    """
    WhatsApp verification via wa.me click-to-chat link.

    Flow:
    1. User enters phone number on create page
    2. IDme generates wa.me link with embedded verification code
    3. User opens link → WhatsApp opens with pre-filled message
    4. User sends the message (proves control of the number)
    5. Frontend polls /api/whatsapp/check/{code} until confirmed

    For v1.0, confirmation is triggered by the user clicking a "I sent it"
    button after opening WhatsApp. This is trust-on-first-use and acceptable
    for a phone-as-identity signal. Twilio webhook verification (v1.1)
    provides cryptographic proof.
    """

    PLATFORM = "whatsapp"

    async def generate_verification(
        self, phone_number: str, session_token: str
    ) -> Dict[str, str]:
        """Generate wa.me link with verification code."""
        cleaned = re.sub(r"[+\s\-\(\)]", "", phone_number)

        # 8-char hex code for readability in WhatsApp
        code = secrets.token_hex(4)

        # SIDE EFFECT: Redis write. Why necessary and unavoidable: verification code
        # must persist between generation and confirmation (two separate HTTP requests).
        await redis_client.setex(
            f"whatsapp_verify:{code}",
            600,  # 10 minutes
            json.dumps({
                "session_token": session_token,
                "phone": f"+{cleaned}",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }),
        )

        message_text = f"IDme-verify-{code}"
        wa_link = f"https://wa.me/{cleaned}?text={message_text}"

        return {
            "verification_link": wa_link,
            "code": code,
            "phone": f"+{cleaned}",
        }

    async def confirm_verification(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Confirm that the user sent the WhatsApp verification message.
        Called when user clicks "I sent it" on the create page.
        """
        key = f"whatsapp_verify:{code}"
        data = await redis_client.get(key)

        if not data:
            logger.warning(
                f"IDM-WA-001 confirm_verification: code not found or expired"
            )
            return None

        parsed = json.loads(data)

        # SIDE EFFECT: Redis delete. Why necessary and unavoidable: single-use code.
        await redis_client.delete(key)

        return {
            "phone": parsed["phone"],
            "session_token": parsed["session_token"],
            "verified": True,
        }
