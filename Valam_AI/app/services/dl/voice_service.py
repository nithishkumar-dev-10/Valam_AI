"""
app/services/dl/voice_service.py

Handles Speech-to-Text (local Whisper, forced language), translation
(deep-translator, free), and Text-to-Speech (gTTS).

Pipeline: Tamil audio -> Tamil text -> English text (for intent routing)
          -> English response -> Tamil response -> Tamil audio
"""
import torch
import os
import uuid
import threading
import whisper
from gtts import gTTS
from deep_translator import GoogleTranslator   # pip install deep-translator (free, no API key)

from app.config import WHISPER_MODEL_SIZE, VOICE_AUDIO_OUTPUT_DIR, DEFAULT_VOICE_LANGUAGE
from app.utils.logger import logger

torch.set_num_threads(1)
class VoiceService:
    def __init__(self):
        self.model = None
        self._lock = threading.Lock()
        os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)

    def _ensure_loaded(self):
        if self.model is not None:
            return
        with self._lock:
            if self.model is not None:
                return
            logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE}")
            self.model = whisper.load_model(WHISPER_MODEL_SIZE)

    def transcribe(self, audio_file_path: str, language: str = DEFAULT_VOICE_LANGUAGE) -> dict:
        """
        Transcribes speech in the given language (default Tamil).

        IMPORTANT: we FORCE the language instead of letting Whisper auto-detect.
        On the "base" model, auto-detect on Tamil speech is unreliable and can
        misfire as a completely different language (seen: Tamil -> detected as
        Greek). Forcing language="ta" fixes this since we already know the
        target audience is Tamil Nadu farmers.

        Returns: {"text": "<tamil text>", "language": "ta"}
        """
        self._ensure_loaded()
        try:
            result = self.model.transcribe(str(audio_file_path), language=language)
            return {
                "text": result["text"].strip(),
                "language": language,
            }
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            raise

    def translate(self, text: str, source: str, target: str) -> str:
        """
        Generic translate helper. source/target are language codes, e.g.
        'ta' (Tamil), 'en' (English), 'hi' (Hindi).
        """
        try:
            return GoogleTranslator(source=source, target=target).translate(text)
        except Exception as e:
            logger.error(f"Translation failed ({source}->{target}): {e}")
            raise

    def synthesize(self, text: str, language: str = DEFAULT_VOICE_LANGUAGE) -> str:
        """
        Converts text to speech in the given language using gTTS.

        NOTE: gTTS requires internet at call time — not offline, unlike
        local Whisper. Worth revisiting later given Valam's offline-first goal.

        Returns: path to the generated .mp3 file.
        """
        try:
            filename = f"{uuid.uuid4().hex}.mp3"
            output_path = os.path.join(VOICE_AUDIO_OUTPUT_DIR, filename)

            tts = gTTS(text=text, lang=language)
            tts.save(output_path)

            return output_path
        except Exception as e:
            logger.error(f"gTTS synthesis failed: {e}")
            raise


voice_service = VoiceService()