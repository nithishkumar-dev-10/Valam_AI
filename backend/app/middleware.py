"""
app/middleware.py

Request logging middleware: one structured line per HTTP request, written to
the shared root logger (→ backend/logs/backend.log + stdout). Lines carry
machine-greppable fields rather than prose so `grep 'level=ERROR'` works on
the server without extra tooling.
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.logger import get_logger  # noqa: F401 -- triggers logging config

logger = get_logger()


def _safe_ua(request: Request) -> str:
    ua = request.headers.get("user-agent", "")
    return ua[:120].replace("|", " ")


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:  # let global handler emit its own logged 500
            logger.exception(
                "request=exc method=%s path=%s exc=%s",
                request.method,
                request.url.path,
                type(exc).__name__,
            )
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        client = request.client.host if request.client else "-"
        status = response.status_code
        if status >= 500:
            level = "ERROR"
        elif status >= 400:
            level = "WARN"
        else:
            level = "INFO"
        logger.log(
            getattr(__import__("logging"), level),
            "method=%s path=%s status=%d duration_ms=%.1f client=%s ua=%s",
            request.method,
            request.url.path,
            status,
            duration_ms,
            client,
            _safe_ua(request),
        )
        return response