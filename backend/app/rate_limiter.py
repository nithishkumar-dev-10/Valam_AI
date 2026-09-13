"""
app/rate_limiter.py

Shared slowapi limiter instance. Backed by in-memory storage (single-worker
uvicorn is enough for ~100 users). For multi-worker deployment, swap to
RedisStorage (slowapi.ext.redis_storage.RedisStorage) for accurate shared
counting across processes.

Usage on any endpoint:
    from app.rate_limiter import limiter
    @router.post("/thing")
    @limiter.limit("10/minute")
    def thing(request: Request, ...):          # request param is REQUIRED
        ...
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)