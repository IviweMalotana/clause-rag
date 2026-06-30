"""Minimal in-process per-IP rate limiter.

Token-bucket per client IP. Intentionally simple — for a single-instance demo
backed by FastAPI on one box, this is enough to stop casual abuse without
pulling in Redis. Production deployments would put a real limiter at the edge.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock

from fastapi import HTTPException, Request


@dataclass
class _Bucket:
    tokens: float
    last_refill: float


class RateLimiter:
    def __init__(self, *, rate_per_minute: int, burst: int | None = None):
        self.rate = rate_per_minute / 60.0  # tokens per second
        self.capacity = float(burst or rate_per_minute)
        self._buckets: dict[str, _Bucket] = {}
        self._lock = Lock()

    def check(self, key: str, now: float | None = None) -> tuple[bool, float]:
        """Returns (allowed, retry_after_seconds)."""
        now = now if now is not None else time.monotonic()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                self._buckets[key] = _Bucket(tokens=self.capacity - 1.0, last_refill=now)
                return True, 0.0
            elapsed = now - b.last_refill
            b.tokens = min(self.capacity, b.tokens + elapsed * self.rate)
            b.last_refill = now
            if b.tokens >= 1.0:
                b.tokens -= 1.0
                return True, 0.0
            needed = (1.0 - b.tokens) / self.rate
            return False, needed


def _client_ip(request: Request) -> str:
    # Trust X-Forwarded-For from the deployment proxy; fall back to socket.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


def limiter_dependency(limiter: RateLimiter):
    """Build a FastAPI dependency from a configured limiter."""

    async def _dep(request: Request) -> None:
        allowed, retry = limiter.check(_client_ip(request))
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down.",
                headers={"Retry-After": str(max(1, int(retry)))},
            )

    return _dep


# Endpoint-scoped limits. /ask is the costliest, /ingest is the next concern;
# everything else uses the broad default at the app level.
ask_limiter = RateLimiter(rate_per_minute=20, burst=8)
ingest_limiter = RateLimiter(rate_per_minute=10, burst=4)
