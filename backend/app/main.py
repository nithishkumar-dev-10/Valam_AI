# ---------------------------------------------------------------------------
# Application metadata — this text appears on /docs and /redoc.
# ---------------------------------------------------------------------------

import os
import logging

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
from slowapi import _rate_limit_exceeded_handler
import sqlalchemy

from app.database import Base, engine
from app.models import farmer  # noqa: F401 -- registers the model before create_all
from app.routers import crop, disease, deep_weed, voice, auth, pest, admin
from app.config import STATIC_DIR, VOICE_AUDIO_OUTPUT_DIR, CORS_ORIGINS, ADMIN_ACCESS_KEY
from app.rate_limiter import limiter
from app.middleware import AccessLogMiddleware

logger = logging.getLogger("valam_ai.main")

# Creates the farmers table on startup if it doesn't exist yet.
# Fine for v1 -- swap to Alembic migrations before this has real user data.
Base.metadata.create_all(bind=engine)

os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)

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

## Auth model

* Read / docs / `voice` callers work **anonymously**.
* Optional accounts via phone + password; `POST /auth/login` returns a short-lived
  access JWT and a 28-day refresh JWT. Mobile apps should refresh silently
  (see `POST /auth/refresh`) and only re-prompt when the refresh fails.

## Deployment notes

* Backend: FastAPI + uvicorn behind nginx TLS (see `deploy/`).
* Database: SQLite (WAL) by default; switch to PostgreSQL by setting `DATABASE_URL`.
* All secrets/URLs come from `.env` — the app refuses to start without `SECRET_KEY`.
"""

app = FastAPI(
    title="Valam AI — Farmer Assistant API",
    description=API_DESCRIPTION,
    version="1.0.0",
    contact={
        "name": "Valam AI",
        "url": "https://valam.in",
    },
    license_info={
        "name": "Proprietary",
    },
    # Stable, versioned API for mobile clients (Play Store): frontends must
    # pin to /api/v1 so future breaking changes ship as /api/v2 harmlessly.
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate limiting (slowapi — in-memory store, single-worker deployment).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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