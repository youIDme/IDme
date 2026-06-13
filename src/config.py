"""
IDme — Application Configuration

Loads from environment variables / .env file.
All secrets must be set before production deployment.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────
    APP_NAME: str = "IDme"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "production"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ── Server ───────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    PUBLIC_URL: str = "https://idme.io"

    # ── Database (PostgreSQL 16) ─────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://idme:password@postgres:5432/idme"

    # ── Redis 7.2 ────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── Secret Key ───────────────────────────────────────
    # Used for Fernet token encryption and session signing.
    # MUST be a URL-safe base64-encoded 32-byte key in production.
    SECRET_KEY: str = "change-me-to-a-random-64-char-string"

    # ── GitHub OAuth ─────────────────────────────────────
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # ── LinkedIn OAuth ───────────────────────────────────
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""

    # ── Facebook OAuth ───────────────────────────────────
    FACEBOOK_CLIENT_ID: str = ""
    FACEBOOK_CLIENT_SECRET: str = ""

    # ── WhatsApp (Twilio — v1.1) ─────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""

    # ── Rate Limiting ────────────────────────────────────
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── Session ──────────────────────────────────────────
    SESSION_TOKEN_LENGTH: int = 64

    # ── Slug Cleanup ─────────────────────────────────────
    SLUG_EXPIRY_HOURS: int = 24

    # ── Supported Platforms ──────────────────────────────
    SUPPORTED_PLATFORMS: List[str] = ["github", "linkedin", "facebook", "whatsapp"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
