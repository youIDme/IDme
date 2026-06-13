"""
IDme — Rendering Utilities

Provides:
- QR code generation for profile URLs
- Embeddable badge HTML/JS snippet generation
- Open Graph meta tag data preparation
"""

import io
import logging
from typing import Any, Dict

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import RadialGradiantColorMask

from src.config import settings

logger = logging.getLogger(__name__)


def generate_qr_code(slug: str) -> bytes:
    """
    Generate a styled QR code PNG for a profile URL.
    Returns raw PNG bytes suitable for serving as image/png.
    """
    url = f"{settings.PUBLIC_URL}/{slug}"

    qr = qrcode.QRCode(
        version=None,  # Auto-detect size
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    # Styled QR with gradient (electric blue → violet)
    try:
        img = qr.make_image(
            image_factory=StyledPilImage,
            color_mask=RadialGradiantColorMask(
                center_color=(59, 130, 246),    # Electric blue
                edge_color=(139, 92, 246),      # Violet
                back_color=(255, 255, 255),     # White background
            ),
        )
    except Exception:
        # Fallback to plain QR if styled fails
        img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def generate_badge_js(slug: str, trust_score: int) -> str:
    """
    Generate embeddable JavaScript snippet for external sites.
    Renders a small trust badge showing the IDme verification status.
    """
    profile_url = f"{settings.PUBLIC_URL}/{slug}"
    badge_color = _score_to_color(trust_score)

    return f"""(function(){{
  var d=document,s=d.createElement('div');
  s.innerHTML='<a href="{profile_url}" target="_blank" rel="noopener" '
    +'style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;'
    +'border-radius:20px;background:{badge_color};color:#fff;font-family:Inter,system-ui,sans-serif;'
    +'font-size:13px;font-weight:600;text-decoration:none;transition:transform 0.2s;'
    +'box-shadow:0 2px 8px rgba(0,0,0,0.15)" '
    +'onmouseover="this.style.transform=\\'scale(1.05)\\'" '
    +'onmouseout="this.style.transform=\\'scale(1)\\'">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    +'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
    +'<polyline points="9 12 11 14 15 10"/></svg>'
    +'IDme Verified &middot; {trust_score}</a>';
  d.currentScript.parentElement.appendChild(s.firstChild);
}})();"""


def get_og_meta(slug: str, display_name: str, trust_score: int,
                platforms_count: int) -> Dict[str, Any]:
    """
    Prepare Open Graph and Twitter Card meta tag data for a profile page.
    """
    title = f"{display_name or slug} — IDme Verified Identity"
    description = (
        f"Verified across {platforms_count} platform{'s' if platforms_count != 1 else ''} "
        f"with a trust score of {trust_score}/100. "
        f"One link, fully verified."
    )
    url = f"{settings.PUBLIC_URL}/{slug}"

    return {
        "og:title": title,
        "og:description": description,
        "og:url": url,
        "og:type": "profile",
        "og:site_name": "IDme",
        "twitter:card": "summary",
        "twitter:title": title,
        "twitter:description": description,
    }


def _score_to_color(score: int) -> str:
    """Map trust score to a gradient color for badge display."""
    if score >= 80:
        return "linear-gradient(135deg, #10b981, #059669)"  # Emerald
    elif score >= 60:
        return "linear-gradient(135deg, #3b82f6, #2563eb)"  # Blue
    elif score >= 40:
        return "linear-gradient(135deg, #f59e0b, #d97706)"  # Amber
    else:
        return "linear-gradient(135deg, #6b7280, #4b5563)"  # Gray
