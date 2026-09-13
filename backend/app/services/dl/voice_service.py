"""
app/services/dl/voice_service.py

Handles Speech-to-Text (local Whisper, with optional auto language
detection), translation (deep-translator, free), and Text-to-Speech (gTTS).

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
    def __init__(self, model_size: str | None = None):
        # model_size=None -> use config WHISPER_MODEL_SIZE. A CLI can pass an
        # explicit size (e.g. "base") for better auto language detection.
        self._model_size = model_size
        self.model = None
        self._lock = threading.Lock()
        os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)

    def _ensure_loaded(self):
        if self.model is not None:
            return
        with self._lock:
            if self.model is not None:
                return
            size = self._model_size or WHISPER_MODEL_SIZE
            logger.info(f"Loading Whisper model: {size}")
            self.model = whisper.load_model(size)

    def transcribe(
        self, audio_file_path: str, language: str | None = DEFAULT_VOICE_LANGUAGE
    ) -> dict:
        """
        Transcribes speech.

        language=None -> Whisper AUTO-DETECTS the language. The detected
        code is returned (e.g. "ta"/"en") along with its confidence.
        language="ta" -> forced Tamil (existing backend behavior; the micro-
        phone path already knows the farmer is Tamil-speaking).

        Returns: {"text": "<transcribed text>", "language": "<code>",
                  "language_probability": <float | None>}
        """
        self._ensure_loaded()
        kwargs = {} if language is None else {"language": language}
        result = self.model.transcribe(str(audio_file_path), **kwargs)

        detected = result.get("language") or language or "en"

        prob = None
        segments = result.get("segments") or []
        if segments:
            prob = segments[0].get("language_probability")

        return {
            "text": result["text"].strip(),
            "language": detected,
            "language_probability": prob,
        }

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