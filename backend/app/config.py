from pathlib import Path
import os
from dotenv import load_dotenv

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
TEMP_UPLOAD_DIR = BASE_DIR / "app" / "temp_uploads"
# Decompression-bomb guard: reject images larger than this many pixels BEFORE
# any decode, so a tiny 15 MB file can't balloon into gigabytes of RAM. PIL's
# own default is 16M; a phone camera photo is ~12MP (12M). 16M is a sane cap.
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "16000000"))
LOG_DIR = BASE_DIR / "logs"
LOG_FILE = LOG_DIR / "backend.log"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "tiny")  # was "base"
DEFAULT_VOICE_LANGUAGE = os.getenv("DEFAULT_VOICE_LANGUAGE", "ta")

load_dotenv()

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
NOMINATIM_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "ValamAI/0.1 (crop-recommendation prototype)",
)

# Comma-separated list of allowed CORS origins (the frontend is a separate
# service: the sibling frontend/ repo today, a Flutter app later). Override
# via env to add production domains without a code change:
#   CORS_ORIGINS="https://app.example.com,https://admin.example.com"
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'valam.db'}")

# JWT signing secret — REQUIRED. No fallback on purpose: running with a weak
# or known key is worse than not starting. Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(64))"
# Fails loudly at import time if missing (see validate_config below).
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# 7 days default access token (good mobile UX, avoids constant re-login).
# Refresh tokens live 28 days; rotating via /auth/refresh.
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "40320"))

# Upload limits (MB) — enforced in app/validation.py BEFORE ML inference.
MAX_IMAGE_UPLOAD_MB = int(os.getenv("MAX_IMAGE_UPLOAD_MB", "15"))
MAX_AUDIO_UPLOAD_MB = int(os.getenv("MAX_AUDIO_UPLOAD_MB", "15"))
# Longest accepted voice note (seconds). FFprobe reads just the header (no
# decode) so a long low-bitrate clip can't force a multi-minute Whisper decode.
MAX_AUDIO_DURATION_SECONDS = int(os.getenv("MAX_AUDIO_DURATION_SECONDS", "300"))

# App environment ("development" | "production"). Swagger docs/redoc are
# disabled in production (app.main sets docs_url=None) so the API surface
# isn't publicly browsable on the live server.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

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
    if SECRET_KEY is not None and len(SECRET_KEY) < 32:
        missing.append(
            "  SECRET_KEY — too short (must be ≥ 32 chars). Generate with: "
            'python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if missing:
        raise RuntimeError(
            "FATAL: required environment variables are not set securely. "
            "Add them to backend/.env (see .env.example).\n" + "\n".join(missing)
        )


validate_config()
