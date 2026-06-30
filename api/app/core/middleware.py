"""Structured logging + request-id middleware."""

from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("clause.api")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a stable X-Request-Id to every request + response, and log timing."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = rid
        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            logger.exception(
                "request failed rid=%s method=%s path=%s",
                rid,
                request.method,
                request.url.path,
            )
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-Id"] = rid
        logger.info(
            "rid=%s %s %s -> %d in %.1fms",
            rid,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
