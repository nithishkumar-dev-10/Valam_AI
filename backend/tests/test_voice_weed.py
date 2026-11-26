"""DeepWeeds (weed_check intent) wiring in the voice pipeline.

A voice query whose transcribed text mentions a weed - together with a photo -
must route to the DeepWeeds ResNet18 (deep_weed_service), NOT to the
disease/pest CNNs. Unclear-photo fallback behaviour (disease+pest) is
deliberately left untouched.
"""

import asyncio
import io

import numpy as np
from PIL import Image

from app.services.dl import pipeline as pipeline_module
from app.services.dl.intent_parser import parse_intent


def _tiny_png(size: int = 16) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.zeros((size, size, 3), dtype=np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


def _fake_transcribe(path, language=None):
    return {"text": "what weed is this in my field", "language": "en", "language_probability": None}


def test_parse_intent_detects_weed_english():
    r = parse_intent("what weed is this", language="en")
    assert r["intent"] == "weed_check"


def test_parse_intent_detects_weed_tamil():
    r = parse_intent("என் வயலில் களை எடுக்க வேண்டும்", language="ta")
    assert r["intent"] == "weed_check"


def test_weed_photo_voice_query_calls_deep_weed_not_disease_pest(monkeypatch):
    calls = []

    def fake_weed(image_bytes):
        calls.append("weed")
        return ("Lantana", 0.9)

    def fake_disease(image_bytes):
        calls.append("disease")
        raise AssertionError("disease CNN must not run for a weed query")

    def fake_pest(image_bytes):
        calls.append("pest")
        raise AssertionError("pest CNN must not run for a weed query")

    monkeypatch.setattr(pipeline_module.deep_weed_service, "predict", fake_weed)
    monkeypatch.setattr(pipeline_module.disease_service, "predict", fake_disease)
    monkeypatch.setattr(pipeline_module, "_pest_predict_image", fake_pest)

    out = asyncio.run(
        pipeline_module.run_pipeline(
            audio_path="/tmp/does-not-matter.webm",
            image_bytes=_tiny_png(),
            lang_override=None,
            transcribe_fn=_fake_transcribe,
        )
    )

    assert out["intent"] == "weed_check"
    assert calls == ["weed"], f"expected only deep_weed to run, got {calls}"
    assert out["results"] == [
        {"model": "weed", "predicted_class": "Lantana", "confidence": 0.9, "confidence_label": "high"}
    ]
    assert out["weed_result"] is not None
    assert out["disease_result"] is None
    assert out["pest_result"] is None