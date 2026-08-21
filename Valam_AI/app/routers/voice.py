"""
app/routers/voice.py

Full pipeline: Tamil audio (+ optional GPS) in -> Tamil text -> English
-> routed (crop suggestion needs lat/long, mirrors /predict/crop-simple)
-> English response -> Tamil response -> Tamil audio out.
"""

import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.dl.voice_service import voice_service
from app.services.dl.intent_router import route_query
from app.schemas.voice import VoiceQueryResponse
from app.config import DEFAULT_VOICE_LANGUAGE

router = APIRouter(prefix="/voice", tags=["Voice Assistant"])

TEMP_UPLOAD_DIR = "app/temp_uploads"
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)


@router.post("/query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
):
    """
    latitude/longitude are optional at the schema level, but required in
    practice for the crop intent — the mobile app should send the phone's
    GPS coords alongside the audio (same data your existing crop screen
    already needs to send to /predict/crop-simple).
    """
    temp_path = os.path.join(TEMP_UPLOAD_DIR, f"{uuid.uuid4().hex}_{audio.filename}")

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        # 1. Tamil audio -> Tamil text
        stt_result = voice_service.transcribe(temp_path, language=DEFAULT_VOICE_LANGUAGE)
        tamil_text = stt_result["text"]

        if not tamil_text:
            raise HTTPException(status_code=400, detail="Could not detect any speech in the audio.")

        # 2. Tamil text -> English text (intent_router / ML+DL+GenAI services are English-based)
        english_query = voice_service.translate(tamil_text, source="ta", target="en")

        # 3. Route to the right feature -> English response
        routed = await route_query(english_query, language="en", latitude=latitude, longitude=longitude)

        # 4. English response -> Tamil response
        tamil_response = voice_service.translate(routed["response_text"], source="en", target="ta")

        # 5. Tamil response -> Tamil audio
        audio_response_path = voice_service.synthesize(tamil_response, language=DEFAULT_VOICE_LANGUAGE)

        return VoiceQueryResponse(
            transcribed_text=tamil_text,
            detected_language=DEFAULT_VOICE_LANGUAGE,
            response_text=tamil_response,
            audio_response_path=audio_response_path,
            intent=routed["intent"],
        )

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)