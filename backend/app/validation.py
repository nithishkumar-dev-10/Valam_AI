"""
app/validation.py

Central upload validators — called BEFORE anything touches ML inference.
Returns validated bytes so callers can skip a redundant read.
"""

import io
import logging

from fastapi import UploadFile, HTTPException
from PIL import Image

from app.config import MAX_IMAGE_UPLOAD_MB, MAX_AUDIO_UPLOAD_MB

logger = logging.getLogger("valam_ai.validation")


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

    return data