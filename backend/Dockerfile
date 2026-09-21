# syntax=docker/dockerfile:1
# =============================================================================
# Valam AI backend — production image (multi-stage).
#
# Stage 1 (builder): build a self-contained venv from pinned requirements.txt
#                    AND bake the Whisper ASR weights into the image, so the
#                    first /voice/query request never pays a download cost.
# Stage 2 (runtime): slim image with only ffmpeg + libgomp1, the venv, the app
#                    (incl. app/ml_models/*), and the pre-baked Whisper cache.
#                    Runs as a non-root user.
#
# Build context = ./backend  (see backend/.dockerignore for what is excluded).
#   docker build -t valam-backend:latest ./backend
#
# NOTE: the model weights are ~72 MB tracked in git; torch CPU wheels are large,
# so the final image is ~2 GB. That is expected for an ML serving image.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — builder
# ---------------------------------------------------------------------------
FROM python:3.12.13-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

# build-essential is only needed if a dependency has no prebuilt wheel; it stays
# in this throwaway stage and never reaches the runtime image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create the venv first so the (huge, slow) dependency layer is cached
# independently of application source changes.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip wheel

# requirements.txt pins every dependency AND carries the torch CPU
# --extra-index-url (line 1), so this resolves reproducibly.
COPY requirements.txt .
RUN pip install -r requirements.txt

# --- Bake Whisper weights into the image -----------------------------------
# whisper.load_model() with the default download_root writes to
# $HOME/.cache/whisper/<size>.pt. We bake the three sizes the config supports
# (tiny = fast, base = balanced/default, small = best Tamil) so the operator can
# switch sizes via WHISPER_MODEL_SIZE with zero first-request penalty. Comment
# out the sizes you don't ship to shrink the image (~75 MB each).
ENV HOME=/home/appuser
RUN mkdir -p /home/appuser/.cache \
 && python -c "import whisper; [whisper.load_model(m) for m in ('tiny', 'base')]"

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM python:3.12.13-slim-bookworm AS runtime

# Runtime system deps only:
#   ffmpeg  -> Whisper audio decoding + ffprobe duration checks (app/validation.py)
#   libgomp1-> OpenMP runtime required by torch / numba (llvmlite)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# Non-root runtime user (fixed uid/gid so mounted volumes have stable ownership).
RUN groupadd --system --gid 10001 appuser \
 && useradd --system --uid 10001 --gid appuser --create-home --home-dir /home/appuser appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    HOME=/home/appuser \
    XDG_CACHE_HOME=/home/appuser/.cache \
    # ML libs spawn a thread per core; pin them (mirrors deploy/valam-backend.service).
    KMP_DUPLICATE_LIB_OK=TRUE \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

# Bring in the venv and the baked Whisper cache from the builder.
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /home/appuser/.cache /home/appuser/.cache

WORKDIR /app
# App source (iml. model weights under app/ml_models/) — .dockerignore keeps
# venv/.env/tests/logs/db out of this COPY.
COPY . .

# Writable runtime dirs (TTS clips, audio temp files, rotating logs).
RUN mkdir -p /app/logs /app/app/temp_uploads /app/app/static/voice_responses \
 && chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8000

# Readiness probe for orchestrators (and `docker compose ps` health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').status==200 else 1)"

# Production ASGI server. Workers are configurable: 2 is safe once DATABASE_URL
# points at Postgres. On the default SQLite (single-writer) + in-memory rate
# limiter setup, set UVICORN_WORKERS=1 (see docker-compose.yml / DEPLOY_RUNBOOK.md).
ENV UVICORN_WORKERS=2
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS} --proxy-headers --forwarded-allow-ips '*'"]
