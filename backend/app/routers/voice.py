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

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from app.utils.logger import logger

from app.services.dl.voice_service import voice_service
from app.services.dl.pipeline import run_pipeline, PipelineInputError

from app.schemas.voice import UnifiedVoiceResponse, ModelResult
from app.schemas.prediction import CropOutput, DiseaseOutput, WeedPestOutput
from app.validation import validate_image_upload, validate_audio_upload
from app.rate_limiter import limiter
from app.config import VOICE_RATE_PER_MINUTE, TEMP_UPLOAD_DIR

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])


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

    if lang is not None and lang not in ("ta", "en"):
        raise HTTPException(status_code=400, detail="lang must be 'ta' or 'en' (or omitted for auto).")

    temp_audio_path = None
    image_bytes = None

    try:
        if audio is not None:
            audio_bytes = await validate_audio_upload(audio)
            temp_audio_path = TEMP_UPLOAD_DIR / f"{uuid.uuid4().hex}.audio"
            with open(temp_audio_path, "wb") as f:
                f.write(audio_bytes)

        if image is not None:
            image_bytes = await validate_image_upload(image)

        out = await run_pipeline(
            audio_path=temp_audio_path,
            image_bytes=image_bytes,
            latitude=latitude,
            longitude=longitude,
            lang_override=lang,
            transcribe_fn=voice_service.transcribe,
        )

    except PipelineInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    finally:
        if temp_audio_path is not None:
            temp_audio_path.unlink(missing_ok=True)

    # ---- Step 6: speak the summary (gTTS in the response language) ----
    audio_url = None
    audio_relative = None
    try:
        # gTTS does blocking socket I/O; run it off the event loop so one slow
        # synthesis can't stall every other request on the single worker.
        audio_path = await run_in_threadpool(
            voice_service.synthesize, out["summary"], language=out["summary_language"]
        )
        audio_relative = f"/static/voice_responses/{Path(audio_path).name}"
        audio_url = str(request.base_url).rstrip("/") + audio_relative
    except Exception as exc:  # response is still fully usable without audio
        logger.error(f"gTTS synthesis failed: {exc}")

    crop = out["crop_result"]
    disease = out["disease_result"]
    pest = out["pest_result"]

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
    )