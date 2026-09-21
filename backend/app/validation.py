"""
app/validation.py

Central upload validators — called BEFORE anything touches ML inference.
Returns validated bytes so callers can skip a redundant read.

Images are RE-ENCODED here, server-side, to a clean JPEG:

  * any embedded metadata (EXIF incl. GPS, XMP, thumbnails) is stripped —
    farmer field photos can carry precise GPS coordinates;
  * polyglot payloads (valid image + appended junk/JS) are discarded — only
    the decoded pixels survive re-encode;
  * EXIF orientation is applied first, so rotated phone photos still classify
    as upright (then the EXIF itself is dropped).
"""

import asyncio
import io
import logging
import tempfile

from fastapi import UploadFile, HTTPException
from PIL import Image, ImageOps

from app.config import (
    MAX_IMAGE_UPLOAD_MB,
    MAX_AUDIO_UPLOAD_MB,
    MAX_IMAGE_PIXELS,
    MAX_AUDIO_DURATION_SECONDS,
)

logger = logging.getLogger("valam_ai.validation")


async def _probe_audio_duration(data: bytes) -> float | None:
    """Return the media duration (seconds) via ffprobe, or None if ffprobe is
    unavailable / can't read it. Fails OPEN: missing ffprobe must not block
    uploads, it only means no duration cap.

    ffprobe is given a real (seekable) file: probing a stdin pipe returns 'N/A'
    for formats like WAV where duration isn't resolvable without seeking.
    """
    if not data:
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=True) as probe_file:
            probe_file.write(data)
            probe_file.flush()
            proc = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                "-i", probe_file.name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await proc.communicate()
    except FileNotFoundError:
        logger.warning("ffprobe not found — skipping audio duration cap")
        return None
    except Exception as exc:
        logger.warning("ffprobe failed (%s) — skipping audio duration cap", exc)
        return None

    try:
        duration = float(stdout.decode().strip())
    except (ValueError, UnicodeDecodeError):
        return None
    return duration if duration >= 0 else None


def _file_size(file: UploadFile) -> int:
    """Cheap size check via seek — avoids loading the whole file into RAM."""
    pos = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(pos)
    return size


async def validate_image_upload(file: UploadFile) -> bytes:
    size = _file_size(file)
    if size > MAX_IMAGE_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the {MAX_IMAGE_UPLOAD_MB} MB limit.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    magic = data[:12]
    is_image = (
        magic[:3] == b"\xff\xd8\xff"                    # JPEG
        or magic[:4] == b"\x89PNG"                       # PNG
        or (magic[:4] == b"RIFF" and magic[8:12] == b"WEBP")  # WebP
    )
    if not is_image:
        raise HTTPException(
            status_code=415,
            detail="File is not a valid image (accepts JPEG, PNG, WebP).",
        )

    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        logger.warning("PIL could not decode uploaded image (magic passed)")
        raise HTTPException(
            status_code=415,
            detail="File could not be decoded as an image.",
        )

    # Decompression-bomb guard (reads only header metadata, no pixel decode).
    # A tiny compressed image with huge dimensions would otherwise eat GBs of
    # RAM when the CNNs decode it. Reject before any actual decode happens.
    try:
        img = Image.open(io.BytesIO(data))
        width, height = img.size
    except Exception:
        logger.warning("PIL could not read image dimensions (magic passed)")
        raise HTTPException(
            status_code=415,
            detail="File could not be decoded as an image.",
        )
    if width * height > MAX_IMAGE_PIXELS:
        logger.warning("Rejected oversized image %dx%d (> %d pixels)", width, height, MAX_IMAGE_PIXELS)
        raise HTTPException(
            status_code=415,
            detail="Image dimensions exceed the allowed limit.",
        )

    # Re-encode to a clean JPEG: applies EXIF orientation, then discards ALL
    # metadata (GPS/EXIF/XMP thumbnails) and any trailing polyglot payload.
    # ML inference below only ever reads sanitized pixels, never raw uploads.
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        if buf.getvalue():
            data = buf.getvalue()
        else:
            raise HTTPException(
                status_code=415,
                detail="File could not be re-encoded for safe processing.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("PIL failed to re-encode uploaded image (magic passed)")
        raise HTTPException(
            status_code=415,
            detail="File could not be decoded as an image.",
        )

    return data


async def validate_audio_upload(file: UploadFile) -> bytes:
    size = _file_size(file)
    if size > MAX_AUDIO_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Audio exceeds the {MAX_AUDIO_UPLOAD_MB} MB limit.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    magic = data[:12]
    is_audio = (
        (magic[0] == 0xFF and magic[1] & 0xE0 == 0xE0)  # MP3 sync word
        or magic[:4] == b"RIFF" and magic[8:12] == b"WAVE"  # WAV
        or magic[:4] == b"OggS"                            # OGG/Opus
        or magic[:4] == b"fLaC"                            # FLAC
        or magic[4:8] == b"ftyp"                           # M4A/AAC
        or magic[:4] == b"\x1a\x45\xdf\xa3"               # WebM/EBML
    )
    if not is_audio:
        raise HTTPException(
            status_code=415,
            detail="File is not a recognized audio format (accepts MP3, WAV, WebM, OGG, FLAC, M4A).",
        )

    # Duration cap (ffprobe reads only the header — no decode, no Whisper run).
    # Stops a long low-bitrate clip from forcing a multi-minute ASR decode.
    duration = await _probe_audio_duration(data)
    if duration is not None and duration > MAX_AUDIO_DURATION_SECONDS:
        logger.info(
            "Rejected audio %.1fs (> %ds cap)", duration, MAX_AUDIO_DURATION_SECONDS
        )
        raise HTTPException(
            status_code=413,
            detail=f"Audio is too long. Maximum duration is {MAX_AUDIO_DURATION_SECONDS} seconds.",
        )

    return data