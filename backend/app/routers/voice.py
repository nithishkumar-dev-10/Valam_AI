"""
app/routers/voice.py

Unified multimodal pipeline exposed as one endpoint (backend Part 2):

    optional audio + optional photo + optional GPS + optional lang override
        -> ASR (auto-detect unless overridden)
        -> offline intent parsing
        -> branching (see app/services/dl/pipeline.py)
        -> raw model results
        -> short natural-language summary in the response language
        -> gTTS audio (returned as an absolute /static URL the browser can play)

Contract (exactly what the React frontend's src/api.js sends/expects):
    POST /voice/query   multipart: audio(opt), image(opt), latitude(opt),
                                      longitude(opt), lang(opt: "ta"|"en")
    responses: { text_response, results:[{model, ...}], audio_url, ... }
No auth is required — the frontend calls it with an optional bearer token in
the future, but a listener without an account must still work.
"""

import asyncio
import time
import uuid
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.utils.logger import logger

from app.services.dl.voice_service import voice_service
from app.services.dl.pipeline import run_pipeline, PipelineInputError

from app.schemas.voice import UnifiedVoiceResponse, ModelResult
from app.schemas.prediction import CropOutput, DiseaseOutput, WeedPestOutput
from app.validation import validate_image_upload, validate_audio_upload
from app.rate_limiter import limiter
from app.config import (
    GROQ_API_KEY,
    TEMP_UPLOAD_DIR,
    TTS_TIMEOUT_SECONDS,
    VOICE_PIPELINE_TIMEOUT_SECONDS,
    VOICE_RATE_PER_MINUTE,
)

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])


def _timing(stage: str, started: float) -> None:
    logger.info("[voice-timing] stage=%s ms=%d", stage, int((time.perf_counter() - started) * 1000))


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    lang: str = Field(default="en", pattern="^(ta|en)$")


@router.post(
    "/query",
    response_model=UnifiedVoiceResponse,
    summary="Multimodal voice query",
    description=(
        "The main feature. Send **one or more** of:\n"
        "- `audio` — spoken question in Tamil/English (MP3/WAV/OGG/WebM/FLAC, max 15 MB)\n"
        "- `image` — field photo showing disease, weed, or crop\n"
        "- `latitude` / `longitude` — GPS coordinates for crop recommendation\n\n"
        "The pipeline transcribes → detects language/intent → runs the relevant model(s) → "
        "returns a natural-language summary + a playable TTS audio URL.\n\n"
        "**No auth required.** Rate-limited to 10 queries per IP per minute."
    ),
    responses={
        400: {"description": "No inputs provided, or invalid lang parameter"},
        413: {"description": "Upload too large (image > 15 MB or audio > 15 MB)"},
        415: {"description": "Unsupported file type (wrong magic bytes or unknown audio format)"},
        429: {"description": "Too many queries from this IP (10/minute)"},
        422: {"description": "Invalid form values"},
    },
)
@limiter.limit(VOICE_RATE_PER_MINUTE)
async def voice_query(
    request: Request,
    audio: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    lang: Optional[str] = Form(None),
):
    """
    Runs the full pipeline. Returns a UnifiedVoiceResponse whose `text_response`
    is the summary, `results` is one entry per model that actually ran (each
    with the CROP_FIELDS shape the frontend renders), and `audio_url` is a
    playable gTTS rendering of the summary.
    """
    if audio is None and image is None and latitude is None and longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one input: a voice note, a photo, or GPS location.",
        )

    # Early rejection before multipart parsing / disk writes. Individual file
    # limits are enforced in validation.py (15 MB each); this caps the whole
    # body so a single oversized request can't eat the instance's memory.
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > 32 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Upload is too large (32 MB total limit).")

    started_total = time.perf_counter()
    logger.info(
        "[voice-timing] request start audio=%s image=%s lang=%s",
        bool(audio), bool(image), lang,
    )

    # Fail fast instead of waiting for an STT call that can never authenticate.
    if audio is not None and not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Voice transcription is not configured on the server (GROQ_API_KEY missing).",
        )

    # Accept the BCP-47 hints the browser uses (ta-IN / en-IN) as well as the
    # bare ISO codes, and always hand the pipeline a canonical "ta"/"en".
    if lang is not None:
        lang = lang.strip().lower().split("-")[0]
    if lang is not None and lang not in ("ta", "en"):
        raise HTTPException(status_code=400, detail="lang must be 'ta' or 'en' (or omitted for auto).")

    # Same bounds the /predict/crop-simple endpoint enforces (India only):
    # reject out-of-range coordinates here BEFORE the geocode/weather calls,
    # so a bogus GPS value can't burn a free-tier reverse-geocode quota.
    if latitude is not None and not (6.0 <= latitude <= 37.5):
        raise HTTPException(
            status_code=400,
            detail="latitude must be between 6.0 and 37.5 (India).",
        )
    if longitude is not None and not (68.0 <= longitude <= 97.5):
        raise HTTPException(
            status_code=400,
            detail="longitude must be between 68.0 and 97.5 (India).",
        )

    temp_audio_path = None
    image_bytes = None

    try:
        stage = time.perf_counter()
        if audio is not None:
            audio_bytes = await validate_audio_upload(audio)
            temp_audio_path = TEMP_UPLOAD_DIR / f"{uuid.uuid4().hex}.audio"
            with open(temp_audio_path, "wb") as f:
                f.write(audio_bytes)

        if image is not None:
            image_bytes = await validate_image_upload(image)
        _timing("receive", stage)

        stage = time.perf_counter()
        try:
            out = await asyncio.wait_for(
                run_pipeline(
                    audio_path=temp_audio_path,
                    image_bytes=image_bytes,
                    latitude=latitude,
                    longitude=longitude,
                    lang_override=lang,
                    transcribe_fn=voice_service.transcribe,
                ),
                timeout=VOICE_PIPELINE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            logger.exception("[voice-timing] pipeline exceeded %ss", VOICE_PIPELINE_TIMEOUT_SECONDS)
            raise HTTPException(
                status_code=504,
                detail="The server took too long to analyze this request. Please try again.",
            ) from exc
        _timing("pipeline-total", stage)

    except PipelineInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        # STT/model failures get a clean JSON error with a logged cause.
        logger.error("Voice runtime failure: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Voice transcription or analysis is unavailable right now. Please try again.",
        ) from exc
    except HTTPException:
        raise
    except Exception:
        # Full traceback in Render logs so a hung/failed stage is diagnosable.
        logger.exception("Voice pipeline failed unexpectedly")
        raise HTTPException(
            status_code=500,
            detail="The server could not complete the request. Please try again.",
        )

    finally:
        if temp_audio_path is not None:
            temp_audio_path.unlink(missing_ok=True)

    # TTS intentionally NOT done here: gTTS has no internal timeout and must
    # never hold the diagnosis response. The frontend calls /voice/tts after
    # rendering the text.
    audio_url = None
    audio_relative = None
    _timing("total", started_total)

    crop = out["crop_result"]
    disease = out["disease_result"]
    pest = out["pest_result"]
    weed = out["weed_result"]

    return UnifiedVoiceResponse(
        intent=out["intent"],
        transcribed_text=out["transcribed_text"],
        detected_language=out["detected_language"],
        language_probability=out["language_probability"],
        text_response=out["summary"],
        response_text=out["summary"],
        audio_url=audio_url,
        audio_response_path=audio_relative,
        results=[ModelResult(**r) for r in out["results"]],
        crop_result=(
            CropOutput(
                predicted_crop=crop["predicted_crop"],
                confidence=crop["confidence"],
                confidence_label=crop["confidence_label"],
                soil_source=crop["soil_source"],
                weather_source=crop["weather_source"],
                location=crop["location"],
                warning=crop["warning"],
                data_resolution=crop["data_resolution"],
                input_confidence=crop["input_confidence"],
                data_quality_note=crop["data_quality_note"],
            )
            if crop
            else None
        ),
        disease_result=(
            DiseaseOutput(predicted_class=disease["predicted_class"], confidence=disease["confidence"])
            if disease
            else None
        ),
        pest_result=(
            WeedPestOutput(predicted_class=pest["predicted_class"], confidence=pest["confidence"])
            if pest
            else None
        ),
        weed_result=(
            WeedPestOutput(predicted_class=weed["predicted_class"], confidence=weed["confidence"])
            if weed
            else None
        ),
    )


@router.post("/tts", summary="Optional speech for a diagnosis")
async def synthesize_tts(payload: TTSRequest, request: Request):
    """Best-effort TTS. Called by the frontend AFTER the text is rendered.

    gTTS uses requests with no internal timeout, so it runs in a worker thread
    under a hard timeout. Failure/timeout simply returns no audio (200), never
    an error and never a held-open request.
    """
    started = time.perf_counter()
    try:
        reference = await asyncio.wait_for(
            run_in_threadpool(
                voice_service.synthesize, payload.text, language=payload.lang
            ),
            timeout=TTS_TIMEOUT_SECONDS,
        )
        _timing("tts", started)
    except Exception as exc:
        logger.warning("TTS skipped (failed or >%ss): %s", TTS_TIMEOUT_SECONDS, exc)
        return {"audio_url": None}

    if reference.startswith(("http://", "https://")):
        return {"audio_url": reference}
    if reference:
        return {"audio_url": str(request.base_url).rstrip("/") + reference}
    return {"audio_url": None}
