from pathlib import Path
import os
from dotenv import load_dotenv

# Load backend/.env FIRST, before any os.getenv() below. Several settings
# (WHISPER_MODEL_SIZE, DEFAULT_VOICE_LANGUAGE, VOICE_AUDIO_RETENTION_DAYS,
# MAX_IMAGE_PIXELS) are read further down, so calling this late silently pinned
# them to their defaults on the systemd deployment path, which relies on .env
# (the unit has no EnvironmentFile=). Real process env still wins over .env
# because load_dotenv() does not override existing variables.
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
ML_MODELS_DIR = BASE_DIR / "app" / "ml_models"

CROP_MODEL_PATH = ML_MODELS_DIR / "crop_recommender.pkl"
CROP_ENCODER_PATH = ML_MODELS_DIR / "label_encoder.pkl"

DISEASE_MODEL_PATH = ML_MODELS_DIR / "disease_cnn.pt"
DISEASE_CLASSES_PATH = ML_MODELS_DIR / "disease_classes.json"

DEEP_WEED_MODEL_PATH = ML_MODELS_DIR / "deepweeds_model.pt"
DEEP_WEED_CLASSES_PATH = ML_MODELS_DIR / "deepweeds_classes.json"

STATIC_DIR = BASE_DIR / "app" / "static"
VOICE_AUDIO_OUTPUT_DIR = STATIC_DIR / "voice_responses"
VOICE_AUDIO_RETENTION_DAYS = int(os.getenv("VOICE_AUDIO_RETENTION_DAYS", "30"))
# Object-storage bucket for TTS voice clips (e.g. "gs://valam-voice-clips").
# Cloud Run instances do NOT share a filesystem, so on any multi-instance deploy
# audio written to the per-instance local VOICE_AUDIO_OUTPUT_DIR can 404 when a
# different instance serves the same URL, and clips vanish on redeploy. Empty =
# write to local disk (single-instance / local dev only). app/main.py logs a
# WARNING at startup if production is running without this set. Full Cloud
# Storage migration is intentionally NOT implemented yet — this flag only
# surfaces the risk so it doesn't break silently.
AUDIO_STORAGE_BUCKET = os.getenv("AUDIO_STORAGE_BUCKET", "").strip()
TEMP_UPLOAD_DIR = BASE_DIR / "app" / "temp_uploads"
# Decompression-bomb guard: reject images larger than this many pixels BEFORE
# any decode, so a tiny 15 MB file can't balloon into gigabytes of RAM. PIL's
# own default is 16M; a phone camera photo is ~12MP (12M). 16M is a sane cap.
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "16000000"))
LOG_DIR = BASE_DIR / "logs"
LOG_FILE = LOG_DIR / "backend.log"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "tiny")  # was "base"
DEFAULT_VOICE_LANGUAGE = os.getenv("DEFAULT_VOICE_LANGUAGE", "ta")

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
NOMINATIM_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "ValamAI/0.1 (crop-recommendation prototype)",
)

# App environment ("development" | "production"). Must be defined BEFORE
# CORS_ORIGINS below: in production the origin allowlist has NO dev fallback.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# Comma-separated list of allowed CORS origins (the frontend is a separate
# service: the sibling frontend/ repo today, a Flutter app later). Override
# via env to add production domains without a code change:
#   CORS_ORIGINS="https://app.example.com,https://admin.example.com"
#
# In PRODUCTION there is no hardcoded localhost fallback: the list is read
# strictly from the env var, and validate_config() refuses to start if it is
# empty (an empty allowlist would silently block every cross-origin request,
# including the browser's credentialed auth calls). In development a localhost
# list is used so the Vite dev server works out of the box.
if ENVIRONMENT == "production":
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "").split(",")
        if o.strip()
    ]
else:
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]

# Default SQLite file lives in backend/db/ (app/database.py creates the folder
# on import). Override DATABASE_URL for Postgres — nothing else changes.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db' / 'valam.db'}")

# JWT signing secret — REQUIRED. No fallback on purpose: running with a weak
# or known key is worse than not starting. Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
# Fails loudly at import time if missing (see validate_config below).
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# Short-lived access tokens (~15 min) keep a stolen access token's blast
# radius tiny; the frontend silently refreshes on 401 via /auth/refresh.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
# Refresh tokens live 28 days but are ROTATED on every /auth/refresh and can be
# revoked server-side (logout, reuse detection, account deletion) — see
# app/auth/refresh_store.py.
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "40320"))

# The refresh token is delivered to the browser as an httpOnly cookie (NOT
# localStorage) so injected JS can never read it. The access token stays out of
# cookies entirely — it travels as `Authorization: Bearer` and lives in SPA
# memory only.
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
# Scoped narrowly to auth endpoints — the cookie is never sent on other paths.
REFRESH_COOKIE_PATH = "/api/v1/auth"
# Secure=True is REQUIRED on the live site (HTTPS). Localhost is a secure
# context (Chrome/Firefox treat it as such) so secure cookies still work over
# http://localhost in dev. Set REFRESH_COOKIE_SECURE=false ONLY for non-TLS
# LAN/emulator testing (http://192.168.x.x:8000) where the browser refuses.
REFRESH_COOKIE_SECURE = os.getenv("REFRESH_COOKIE_SECURE", "true").lower() == "true"
# SameSite=lax: api.valam.in and app.valam.in are different origins but the SAME
# site, and browsers only send a SameSite=Lax cookie on same-site requests —
# which is exactly our SPA->API traffic. It also blocks cross-site CSRF POSTs
# (lax cookies are never sent on cross-site POST), so a rogue site cannot
# trigger refresh/logout with a victim's cookie.
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "lax").lower()

# Upload limits (MB) — enforced in app/validation.py BEFORE ML inference.
MAX_IMAGE_UPLOAD_MB = int(os.getenv("MAX_IMAGE_UPLOAD_MB", "10"))
MAX_AUDIO_UPLOAD_MB = int(os.getenv("MAX_AUDIO_UPLOAD_MB", "15"))
# Longest accepted voice note (seconds). FFprobe reads just the header (no
# decode) so a long low-bitrate clip can't force a multi-minute Whisper decode.
MAX_AUDIO_DURATION_SECONDS = int(os.getenv("MAX_AUDIO_DURATION_SECONDS", "300"))

# Optional admin surface. When set, enables GET /api/v1/admin/logs so you can
# read recent log lines with a curl one-liner instead of SSHing. Long random
# value; keep it in .env, never in the frontend.
ADMIN_ACCESS_KEY = os.getenv("ADMIN_ACCESS_KEY")

# Rate limits (per IP) — enforced via slowapi in app/rate_limiter.py.
LOGIN_RATE_PER_MINUTE = os.getenv("LOGIN_RATE_PER_MINUTE", "5/minute")
VOICE_RATE_PER_MINUTE = os.getenv("VOICE_RATE_PER_MINUTE", "10/minute")
# /predict/* (crop / disease / deep-weed / pest) — cheaper than the voice
# pipeline but still CPU-heavy CNN inference + external geocode/weather calls,
# so keep it mid-range: 25/min is inside the agreed 20–30 window.
PREDICT_RATE_PER_MINUTE = os.getenv("PREDICT_RATE_PER_MINUTE", "25/minute")

# Cache TTLs for third-party APIs we silently hammer on every /predict/crop-simple
# and /voice/query (OpenWeather, NASA POWER, Nominatim all have free-tier quotas).
WEATHER_CACHE_TTL_SECONDS = int(os.getenv("WEATHER_CACHE_TTL_SECONDS", "900"))
GEOCODE_CACHE_TTL_SECONDS = int(os.getenv("GEOCODE_CACHE_TTL_SECONDS", "86400"))

REQUIRED_ENV_VARS = {
    "SECRET_KEY": 'JWT signing secret — generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"',
}


def validate_config():
    """Fail loudly at startup when required env vars are missing. Never run
    insecurely with a silent placeholder secret."""
    missing = [f"  {var} — {hint}" for var, hint in REQUIRED_ENV_VARS.items() if not os.getenv(var)]
    if ENVIRONMENT == "production" and not CORS_ORIGINS:
        missing.append(
            "  CORS_ORIGINS — required in production (no localhost fallback). "
            "Comma-separated list of real frontend origins, e.g. "
            'CORS_ORIGINS="https://valam.in,https://app.valam.in"'
        )
    if SECRET_KEY is not None and len(SECRET_KEY) < 32:
        missing.append(
            "  SECRET_KEY — too short (must be ≥ 32 chars). Generate with: "
            'python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if ADMIN_ACCESS_KEY is not None and len(ADMIN_ACCESS_KEY) < 32:
        missing.append(
            "  ADMIN_ACCESS_KEY — too short (must be ≥ 32 chars). Generate with: "
            'python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if REFRESH_COOKIE_SAMESITE not in ("lax", "strict", "none"):
        missing.append(
            "  REFRESH_COOKIE_SAMESITE — must be 'lax', 'strict' or 'none', "
            f"got '{REFRESH_COOKIE_SAMESITE}'"
        )
    if missing:
        raise RuntimeError(
            "FATAL: required environment variables are not set securely. "
            "Add them to backend/.env (see .env.example).\n" + "\n".join(missing)
        )


validate_config()
