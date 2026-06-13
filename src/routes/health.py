"""
IDme — Health Check Route

GET /health — Returns service health with DB and Redis connectivity status.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from src.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Health check endpoint. Used by Docker HEALTHCHECK and Caddy upstream."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "app": settings.APP_NAME,
    }

    # Check database connectivity
    try:
        from src.database import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception:
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"

    # Check Redis connectivity
    try:
        from src.redis_client import redis_client
        await redis_client.ping()
        health_status["redis"] = "connected"
    except Exception:
        health_status["redis"] = "disconnected"
        health_status["status"] = "degraded"

    return health_status
