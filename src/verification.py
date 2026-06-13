"""
IDme — Verification Utilities

Provides:
- Fernet-based token encryption/decryption for OAuth tokens at rest
- Re-verification status checks
- Token status management
"""

import base64
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from src.config import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """
    Derive a Fernet key from SECRET_KEY.
    Fernet requires exactly 32 url-safe base64-encoded bytes.
    We take the first 32 bytes of SECRET_KEY, pad if needed, then encode.
    """
    raw = settings.SECRET_KEY.encode("utf-8")[:32].ljust(32, b"\0")
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    """Lazy-initialized Fernet instance (singleton)."""
    global _fernet
    if _fernet is None:
        _fernet = _get_fernet()
    return _fernet


def encrypt_token(plaintext: str) -> bytes:
    """Encrypt an OAuth access/refresh token for storage."""
    if not plaintext:
        return b""
    return get_fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_token(ciphertext: bytes) -> Optional[str]:
    """
    Decrypt an OAuth access/refresh token.
    Returns None if decryption fails (key rotation, corruption).
    """
    if not ciphertext:
        return None
    try:
        return get_fernet().decrypt(ciphertext).decode("utf-8")
    except InvalidToken:
        logger.error("IDM-CRYPT-001 decrypt_token: Fernet decryption failed (key mismatch or corruption)")
        return None
    except Exception as e:
        logger.error(f"IDM-CRYPT-002 decrypt_token: unexpected error: {type(e).__name__}")
        return None
