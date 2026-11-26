"""
app/services/dl/voice_service.py

Handles Speech-to-Text (Groq Whisper API) and Text-to-Speech (gTTS).

Whisper is NOT loaded locally anymore — the decode happens on Groq's API
(whisper-large-v3), which removes ~240 MB import + ~244 MB model from this
process. This was the single biggest memory lever for memory-constrained
hosts (see audit): local Whisper made a 512 MB instance unbootable.
"""

import io
import os
import uuid

import httpx
from gtts import gTTS

from app.config import (
    AUDIO_STORAGE_BUCKET,
    R2_ENDPOINT_URL,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    GROQ_API_KEY,
    VOICE_AUDIO_OUTPUT_DIR,
    DEFAULT_VOICE_LANGUAGE,
)
from app.utils.logger import logger

GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_MODEL = "whisper-large-v3"

# Groq accepts these media extensions only; the uploaded temp file has NO
# extension (voice.py writes {uuid}.audio), so the format is re-derived from
# its magic bytes here — mirroring validation.py's sniff logic.
_EXT_BY_MAGIC = (
    # (ext, mime, predicate over 12-byte lead)
    (".wav", "audio/wav", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WAVE"),
    (".ogg", "audio/ogg", lambda b: b[:4] == b"OggS"),
    (".flac", "audio/flac", lambda b: b[:4] == b"fLaC"),
    (".m4a", "audio/mp4", lambda b: b[4:8] == b"ftyp"),
    (".webm", "audio/webm", lambda b: b[:4] == b"\x1a\x45\xdf\xa3"),
    (".mp3", "audio/mpeg", lambda b: b[0] == 0xFF and (b[1] & 0xE0) == 0xE0),
)
_DEFAULT_EXT, _DEFAULT_MIME = ".webm", "audio/webm"


def _sniff_audio_extension(path: str) -> tuple[str, str]:
    """Return (extension, mime) from the file's magic bytes (12-byte lead)."""
    try:
        with open(path, "rb") as f:
            magic = f.read(12)
    except OSError:
        return _DEFAULT_EXT, _DEFAULT_MIME
    for ext, mime, predicate in _EXT_BY_MAGIC:
        if predicate(magic):
            return ext, mime
    return _DEFAULT_EXT, _DEFAULT_MIME


def _normalize_language(raw: str | None, override: str | None) -> str:
    """Map Groq's verbose_json language (a full name like 'tamil') back to an
    ISO 639-1 code the pipeline expects ('ta' / 'en')."""
    if raw:
        name = raw.strip().lower()
        if name in ("ta", "tam", "tamil"):
            return "ta"
        if name in ("en", "eng", "english"):
            return "en"
        if override and (override == "ta" or override == "en"):
            return override
    return override or "en"


def _store_audio_in_s3(filename: str, data: bytes) -> str:
    """Upload TTS bytes to the R2 bucket (S3-compatible) and return a 1-hour
    presigned URL.

    boto3 is imported lazily so a local/dev process that never sets
    AUDIO_STORAGE_BUCKET pays nothing for it. The client targets Cloudflare R2
    via R2_ENDPOINT_URL / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (see
    app/config.py). Fails loudly at call time (not boot) if the bucket or the
    credentials are missing — voice.py catches it and the response degrades
    to "no audio".
    """
    if not (R2_ENDPOINT_URL and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY):
        raise RuntimeError(
            "AUDIO_STORAGE_BUCKET is set but the R2 credentials are missing "
            "(R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)."
        )

    import boto3

    client = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )
    client.put_object(
        Bucket=AUDIO_STORAGE_BUCKET,
        Key=filename,
        Body=data,
        ContentType="audio/mpeg",
    )
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": AUDIO_STORAGE_BUCKET, "Key": filename},
        ExpiresIn=3600,
    )


class VoiceService:
    def __init__(self, model_size: str | None = None):
        # model_size is kept for CLI/back-compat only. Groq always serves
        # whisper-large-v3 (GROQ_MODEL); the value is ignored.
        self._model_size = model_size
        os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)

    def transcribe(
        self, audio_file_path: str, language: str | None = DEFAULT_VOICE_LANGUAGE
    ) -> dict:
        """
        Transcribes speech via the Groq Whisper API.

        language=None -> Groq AUTO-DETECTS the language; the detected code is
        returned from the verbose_json payload (e.g. "ta"/"en").
        language="ta" -> forced Tamil (existing backend behavior; the micro-
        phone path already knows the farmer is Tamil-speaking).

        Returns: {"text": "<transcribed text>", "language": "<code>",
                  "language_probability": <float | None>}
        """
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not configured. Set it in the environment to "
                "enable voice transcription."
            )

        ext, mime = _sniff_audio_extension(audio_file_path)
        filename = f"recording{ext}"

        multipart = {
            "file": (filename, open(audio_file_path, "rb"), mime),
            "model": GROQ_MODEL,
            "response_format": "verbose_json",
        }
        if language is not None:
            multipart["language"] = language

        try:
            with httpx.Client(
                timeout=120.0,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            ) as client:
                response = client.post(GROQ_TRANSCRIBE_URL, data={}, files=multipart)
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Groq transcription failed with HTTP {exc.response.status_code}: "
                f"{exc.response.text[:200]}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Unable to reach Groq transcription API: {exc}") from exc

        text = (payload.get("text") or "").strip()
        detected = _normalize_language(payload.get("language"), language)

        return {
            "text": text,
            "language": detected,
            "language_probability": None,
        }

    def synthesize(self, text: str, language: str = DEFAULT_VOICE_LANGUAGE) -> str:
        """
        Converts text to speech in the given language using gTTS.

        NOTE: gTTS requires internet at call time — not offline. Worth
        revisiting later given Valam's offline-first goal.

        Returns a browser-addressable reference to the generated .mp3:
          - AUDIO_STORAGE_BUCKET set  -> absolute https presigned URL (1h) of
            the object in R2 (S3-compatible; multi-instance safe).
          - otherwise                 -> relative "/static/voice_responses/x.mp3"
            (local disk; dev / single-instance only).
        """
        try:
            filename = f"{uuid.uuid4().hex}.mp3"
            tts = gTTS(text=text, lang=language)

            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            data = audio_buffer.getvalue()

            if AUDIO_STORAGE_BUCKET:
                return _store_audio_in_s3(filename, data)

            os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)
            output_path = os.path.join(VOICE_AUDIO_OUTPUT_DIR, filename)
            with open(output_path, "wb") as f:
                f.write(data)
            return f"/static/voice_responses/{filename}"
        except Exception as e:
            logger.error(f"gTTS synthesis failed: {e}")
            raise


voice_service = VoiceService()