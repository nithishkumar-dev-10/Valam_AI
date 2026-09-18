# ---------------------------------------------------------------------------
# Application metadata — this text appears on /docs and /redoc.
# ---------------------------------------------------------------------------

import os
import logging
import time
import asyncio
from contextlib import asynccontextmanager

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
import sqlalchemy

from app.database import Base, engine
from app.models import farmer  # noqa: F401 -- registers the model before create_all
from app.routers import crop, disease, deep_weed, voice, auth, pest, admin
from app.config import (
    STATIC_DIR,
    VOICE_AUDIO_OUTPUT_DIR,
    VOICE_AUDIO_RETENTION_DAYS,
    TEMP_UPLOAD_DIR,
    CORS_ORIGINS,
    ADMIN_ACCESS_KEY,
    ENVIRONMENT,
)
from app.rate_limiter import limiter
from app.middleware import AccessLogMiddleware

logger = logging.getLogger("valam_ai.main")

# Creates the farmers table on startup if it doesn't exist yet.
# Fine for v1 -- swap to Alembic migrations before this has real user data.
Base.metadata.create_all(bind=engine)

os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

_RETENTION_SECONDS = VOICE_AUDIO_RETENTION_DAYS * 86400


def _purge_voice_audio() -> None:
    """Delete TTS preview clips older than the retention window. Logs a summary
    line and never fails startup — retention is best-effort, not critical."""
    now = time.time()
    removed = 0
    for path in VOICE_AUDIO_OUTPUT_DIR.glob("*.mp3"):
        try:
            if now - path.stat().st_mtime > _RETENTION_SECONDS:
                path.unlink(missing_ok=True)
                removed += 1
        except OSError as exc:
            logger.warning("Could not purge TTS clip %s: %s", path, exc)
    if removed:
        logger.info("Retention: purged %d expired TTS clips (older than %d days)", removed, VOICE_AUDIO_RETENTION_DAYS)


def _purge_temp_uploads() -> None:
    """Request-scoped audio temp files are deleted in a finally block on every
    request; anything left in temp_uploads at startup is an orphan (crash,
    SIGKILL) and must not persist — it can contain farmer voice recordings."""
    for path in TEMP_UPLOAD_DIR.glob("*"):
        try:
            if path.is_file():
                path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Could not purge temp upload %s: %s", path, exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: purge stale TTS clips + any orphaned temp uploads (both are
    user-derived data that must never linger), then run a background retention
    sweep every 6h so cleanup happens continuously, not only on restart."""
    logger.info("CORS_ORIGINS=%s", ",".join(CORS_ORIGINS) or "(none)")
    _purge_temp_uploads()
    _purge_voice_audio()

    async def _retention_loop():
        while True:
            await asyncio.sleep(6 * 3600)
            _purge_voice_audio()

    task = asyncio.create_task(_retention_loop())
    try:
        yield
    finally:
        task.cancel()

API_DESCRIPTION = """
Valam AI is a voice-first agri assistant for Indian farmers. A farmer sends a
voice note, a field photo, and/or their GPS location; the backend transcribes,
detects language (Tamil/English), and routes to the right model, then replies
with a built-for-voice summary **and** a playable TTS audio clip.

## What each group of endpoints does

| Group | Path prefix | Purpose |
|-------|-------------|---------|
| **Authentication** | `/api/v1/auth` | Optional phone+password accounts (login via the **Authorize** button: the `username` field holds the phone number). Always open, but only guarded endpoints use it. |
| **Voice Assistant** | `/api/v1/voice` | The main feature: multimodal query → STT → intent → model → TTS audio. **Rate-limited** and open to anonymous users. |
| **Crop** | `/api/v1/predict` | Crop recommendation from GPS (`crop-simple`) or measured N/P/K (`crop-manual`). |
| **Disease / Deep-Weed / Pest** | `/api/v1/predict` | Image classification endpoints (JPEG/PNG/WebP uploads). |
| **Health** | `/api/v1/health` | Liveness + database probe for uptime monitors. |

## Response conventions

- Errors are `{"detail": "human-readable message"}` (or `{"detail": ..., "errors": [...]}` for validation).
- Never rely on `500` bodies — they're intentionally generic; full details go to server logs.
- Status codes you'll see: `200` ok, `201` created, `400` bad input, `401` unauthenticated,
  `413` upload too large, `415` unsupported file type, `422` validation error, `429` rate limited.

## Rate limits (per IP)

| Endpoint | Limit |
|----------|-------|
| `POST /auth/signup`, `/auth/login`, `/auth/refresh` | 5 / minute |
| `POST /voice/query` | 10 / minute |
| `POST /predict/*` (crop, disease, deep-weed, pest) | 25 / minute |

## Auth model

* Read / docs / `voice` callers work **anonymously**.
* Optional accounts via phone + password; `POST /auth/login` returns a short-lived
  access JWT and a 28-day refresh JWT. Mobile apps should refresh silently
  (see `POST /auth/refresh`) and only re-prompt when the refresh fails.

## Deployment notes

* Backend: FastAPI + uvicorn behind nginx TLS (see `deploy/`).
* Database: SQLite (WAL) by default; switch to PostgreSQL by setting `DATABASE_URL`.
* All secrets/URLs come from `.env` — the app refuses to start without `SECRET_KEY`.
* Swagger `/docs` + `/redoc` are **disabled in production** (`ENVIRONMENT=production`).
"""

app = FastAPI(
    title="Valam AI — Farmer Assistant API",
    description=API_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "Valam AI",
        "url": "https://valam.in",
    },
    license_info={
        "name": "Proprietary",
    },
    # Stable, versioned API for mobile clients (Play Store): frontends must
    # pin to /api/v1 so future breaking changes ship as /api/v2 harmlessly.
    # Swagger/redoc stay ON in development but are disabled in production
    # (ENVIRONMENT=production) so the live API surface isn't publicly browsable.
    docs_url=None if ENVIRONMENT == "production" else "/docs",
    redoc_url=None if ENVIRONMENT == "production" else "/redoc",
)

# Rate limiting (slowapi — in-memory store, single-worker deployment).
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """429s conform to the API's error convention (`{"detail": ...}`) instead
    of slowapi's default plain-text body. Retry-After is set manually (slowapi
    keeps its header injection disabled by default, so its own `_inject_headers`
    would be a no-op) so clients can back off instead of blind-polling."""
    response = JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again."},
    )
    view_limit = getattr(request.state, "view_rate_limit", None)
    if view_limit is not None:
        try:
            item, args = view_limit
            reset_in, remaining = app.state.limiter.limiter.get_window_stats(item, *args)
            response.headers["Retry-After"] = str(max(1, int(reset_in)))
            response.headers["X-RateLimit-Limit"] = str(item.amount)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        except Exception as exc:
            logger.warning("Could not attach rate-limit headers: %s", exc)
    return response

# CORS: the frontend is a SEPARATE service (sibling ../frontend repo /
# eventual Flutter app) talking to this API over HTTP. Origins come from the
# env-driven CORS_ORIGINS (comma-separated); localhost values are dev-only
# defaults that production .env replaces.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AccessLogMiddleware)

# Serves app/static/** at /static/** so audio files, etc. are fetchable
# over HTTP instead of only existing as a local filesystem path. Intentionally
# unversioned — these are opaque asset URLs handed to clients by the API.
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Global error handlers — clients get clean, generic responses; full details
# are logged server-side only. Never leak stack traces / internal paths.
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []) if x not in ("body", "query", "path"))
        conf = err.get("ctx")
        msg = err.get("msg", "invalid input")
        if conf and "min_length" in conf:
            msg = "too short"
        elif conf and "max_length" in conf:
            msg = "too long"
        errors.append({"field": loc, "message": msg})
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid input.", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again."},
    )


# ---------------------------------------------------------------------------
# Versioned routers — all under /api/v1. (Root "/" stays unversioned as a
# legacy liveness surface.)
# ---------------------------------------------------------------------------

API_V1 = "/api/v1"
app.include_router(auth.router, prefix=API_V1)
app.include_router(crop.router, prefix=API_V1)
app.include_router(disease.router, prefix=API_V1)
app.include_router(deep_weed.router, prefix=API_V1)
app.include_router(voice.router, prefix=API_V1)
app.include_router(pest.router, prefix=API_V1)
if ADMIN_ACCESS_KEY:
    app.include_router(admin.router, prefix=API_V1)


@app.get("/")
def root():
    return {"status": "Valam AI backend is running"}


@app.get(f"{API_V1}/health", tags=["Health"], summary="Liveness + DB probe",
         description="Returns 200 when the service and its database are reachable — used by uptime monitors (UptimeRobot etc.).")
def health_check():
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
    except Exception:
        db_ok = False
    status_code = 200 if db_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if db_ok else "degraded",
            "service": "valam-ai-backend",
            "version": "1.0.0",
            "database": "ok" if db_ok else "unreachable",
        },
    )