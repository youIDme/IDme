"""
IDme — Page Routes

Serves HTML pages:
- GET / — Landing page
- GET /create — Identity creation wizard
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["pages"])


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Landing page — 'One verified link for all your work'."""
    return request.app.state.templates.TemplateResponse(
        request,
        "index.html",
        {"request": request},
    )


@router.get("/create", response_class=HTMLResponse)
async def create_page(request: Request):
    """Identity creation wizard — multi-step onboarding flow."""
    return request.app.state.templates.TemplateResponse(
        request,
        "create.html",
        {"request": request},
    )
