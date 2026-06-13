"""
IDme — Main Application Entry Point

Configures FastAPI with:
- Lifespan management (DB init, background tasks)
- Static file serving
- Jinja2 template engine
- Request timing middleware
- Router mounting (specific routes first, catch-all profile route last)
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from src.config import settings
from src.database import engine, Base
from src.tasks import start_background_tasks

from src.routes.pages import router as pages_router
from src.routes.api_create import router as api_router
from src.routes.oauth_callback import router as oauth_router
from src.routes.profile import router as profile_router
from src.routes.health import router as health_router

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Public URL: {settings.PUBLIC_URL}")

    # Create database tables (idempotent)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified")
    except Exception as db_err:
        logger.error(f"Failed to initialize database tables: {type(db_err).__name__}: {db_err}. Proceeding without active DB connection (Offline/Demo Mode).")

    # Start background tasks (slug cleanup, etc.)
    await start_background_tasks()

    yield

    # Shutdown
    await engine.dispose()
    logger.info("Shutdown complete")


# ── Application ──────────────────────────────────────────

app = FastAPI(
    title="IDme",
    description="One verified link for all your work",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# ── Static Files ─────────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── Templates ────────────────────────────────────────────
templates = Jinja2Templates(directory="templates")
app.state.templates = templates
app.state.public_url = settings.PUBLIC_URL

# ── CORS ─────────────────────────────────────────────────
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ── Middleware ───────────────────────────────────────────

@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add X-Response-Time header to all responses."""
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Response-Time"] = f"{duration:.3f}s"
    return response


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


# ── Routers ──────────────────────────────────────────────
# Order matters: specific routes first, catch-all /{slug} last
app.include_router(health_router)      # /health
app.include_router(pages_router)       # / and /create
app.include_router(api_router)         # /api/*
app.include_router(oauth_router)       # /oauth/*
app.include_router(profile_router)     # /{slug} (catch-all, must be last)
