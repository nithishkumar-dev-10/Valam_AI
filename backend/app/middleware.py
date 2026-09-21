"""
app/middleware.py

Three pieces of middleware, applied in main.py:

* SecurityHeadersMiddleware — defence-in-depth response headers (belt-and-
  braces even behind nginx, which also sets them: a direct hit on :8000 from
  inside the VM gets the same protection).
* BodySizeLimitMiddleware — cheap Content-Length guard so nobody can POST a
  10 GB JSON body at an auth/voice field before parsing even starts (real
  upload size limits live in app/validation.py).
* AccessLogMiddleware — one structured line per HTTP request, written to the
  shared root logger (→ backend/logs/backend.log + stdout). Lines carry
  machine-greppable fields rather than prose so `grep 'level=ERROR'` works on
  the server without extra tooling.
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.logger import get_logger  # noqa: F401 -- triggers logging config

logger = get_logger()

# ---------------------------------------------------------------------------
# Security response headers (defence in depth — nginx sets mirror headers too,
# but a request that reaches uvicorn directly still gets them).
# ---------------------------------------------------------------------------

# Nearest-neighbour cloud/edge proxies may still need these to be conservative:
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",  # FastAPI never renders HTML; nothing may frame it
    "Referrer-Policy": "strict-origin-when-cross-origin",
    # Ratio-header XSS / old-school sniffers can't be tricked into treating a
    # JSON/audio response as executable HTML.
    "X-XSS-Protection": "0",
    # This API serves only JSON/audio, never HTML documents, so a locked-down
    # CSP costs nothing and blocks any accidental HTML-like body (reflected
    # vectors, error pages rendered inline by a future proxy).
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for key, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(key, value)
        return response


# ---------------------------------------------------------------------------
# JSON body size guard. Multipart uploads (voice/img) are sized in
# app/validation.py with their own explicit limits — this gate ONLY applies to
# `application/json` request bodies (the auth/crop Pydantic endpoints), so a
# fat JSON bomb is rejected on the declared Content-Length before any string
# parsing happens. Chunked-without-length abuse is still bounded downstream by
# the actual field validators.
# ---------------------------------------------------------------------------

MAX_JSON_BODY_BYTES = 1_000_000  # 1 MB is far beyond any schema below


class BodySizeLimitMiddleware:
    """Pure-ASGI guard (no BaseHTTPMiddleware request-buffering overhead)."""

    def __init__(self, app, max_json_bytes: int = MAX_JSON_BODY_BYTES):
        self.app = app
        self.max_json_bytes = max_json_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_type = ""
        content_length = None
        for name, value in scope.get("headers", []):
            if name == b"content-type":
                content_type = value.decode("latin-1")
            elif name == b"content-length":
                try:
                    content_length = int(value)
                except ValueError:
                    content_length = None

        if content_type.startswith("application/json") and content_length is not None:
            if content_length > self.max_json_bytes:
                response = _too_large_response()
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)


def _too_large_response():
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=413,
        content={"detail": "Request body too large."},
        headers={"X-Content-Type-Options": "nosniff"},
    )


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