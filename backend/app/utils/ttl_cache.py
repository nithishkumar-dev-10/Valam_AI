"""
app/utils/ttl_cache.py

Small asyncio-safe TTL cache for third-party HTTP calls that carry free-tier
quotas (OpenWeather, NASA POWER, Nominatim). The backend runs as a single
uvicorn worker by design (deploy/README.md), so an in-process dict is the
correct granularity — no Redis needed.

Two properties that matter under a burst:
  * TTL expiry — cached value for N seconds, then refetched.
  * singleflight — concurrent calls for the same key share ONE in-flight
    fetch instead of each firing a separate HTTP request.

Usage:
    _cache = TTLCache()

    async def get_thing(key: str) -> dict:
        return await _cache.get(key, ttl=900, factory=fetch_thing_async)

Failures are never cached: if `factory()` raises, the exception propagates to
all concurrent waiters and nothing is stored.
"""

import asyncio
import time
from typing import Awaitable, Callable, Generic, Hashable, TypeVar

T = TypeVar("T")
Factory = Callable[[], Awaitable[T]]


class TTLCache(Generic[T]):
    def __init__(self, max_entries: int = 4096):
        self._max_entries = max_entries
        self._data: dict[Hashable, tuple[float, T]] = {}
        self._inflight: dict[Hashable, asyncio.Future] = {}

    async def get(self, key: Hashable, ttl: float, factory: Factory) -> T:
        """Return cached `key` if fresh, otherwise compute it via `factory`
        (protected by singleflight) and cache the result."""
        now = time.monotonic()
        entry = self._data.get(key)
        if entry is not None and entry[0] > now:
            return entry[1]

        # Singleflight: if another caller is already fetching this key, just
        # await their result instead of issuing a duplicate upstream call.
        future = self._inflight.get(key)
        if future is not None:
            return await future

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self._inflight[key] = future
        try:
            value = await factory()
            if value is not None:
                self._store(key, value, ttl, now)
            future.set_result(value)
            return value
        except BaseException as exc:
            if not future.done():
                future.set_exception(exc)
            raise
        finally:
            self._inflight.pop(key, None)

    def _store(self, key: Hashable, value: T, ttl: float, now: float) -> None:
        if len(self._data) >= self._max_entries and key not in self._data:
            self._evict(now)
        self._data[key] = (now + ttl, value)

    def _evict(self, now: float) -> None:
        # Drop expired entries first; if still at capacity, drop the soonest
        # to expire. Cost is acceptable at cache sizes we actually hit.
        for stale in [k for k, (exp, _) in self._data.items() if exp <= now]:
            del self._data[stale]
        while len(self._data) >= self._max_entries and self._data:
            oldest = min(self._data, key=lambda k: self._data[k][0])
            del self._data[oldest]

    def clear(self) -> None:
        self._data.clear()