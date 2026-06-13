"""
IDme — Async Redis Client

Provides connection pool and convenience functions for:
- OAuth state management (ephemeral, TTL-based)
- Rate limiting (sliding window counters)
- Session caching
"""

import redis.asyncio as aioredis
from src.config import settings

redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True,
)


async def get_redis() -> aioredis.Redis:
    """FastAPI dependency — returns a Redis client from the pool."""
    return aioredis.Redis(connection_pool=redis_pool)


# Module-level client for use outside of request context (tasks, startup)
redis_client = aioredis.Redis(connection_pool=redis_pool)
