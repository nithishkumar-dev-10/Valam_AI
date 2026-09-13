"""
app/services/dl/pipeline.py

Step 3-5 of the unified voice pipeline, backend Part 2:

    ASR (optional, auto-detect unless overridden)
        -> intent parsing (offline, app/services/dl/intent_parser.py)
        -> branching (which models run, and clear errors for missing inputs)
        -> raw model results
        -> short natural-language summary in the detected/override language

Returns a plain dict that app/routers/voice.py wraps in the UnifiedVoiceResponse
schema (and turns into spoken audio). No TTS here — the router owns audio URLs.
"""

import re
from typing import Optional

from app.utils.logger import logger

from app.services.dl.intent_parser import parse_intent
from app.services.dl.disease_service import disease_service

from app.services.external.geocoding import reverse_geocode
from app.services.external.weather_fetch import fetch_weather_features
from app.services.external.soil_lookup import get_regional_soil_values
from app.services.ml.crop_predictor import crop_predictor

from app.config import NOMINATIM_USER_AGENT

from app.routers.crop import _predict_from_features
from app.routers.pest import _predict as _pest_predict_image

# Valid output/override language codes shared with the frontend toggle.
VALID_LANGS = ("ta", "en")


class PipelineInputError(Exception):
    """Raised when the inputs don't let us answer (e.g. disease asked without
    a photo, or nothing was provided at all). The router maps this -> HTTP 400
    with a clear, non-crashing message."""


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.80:
        return "high"
    if confidence >= 0.60:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Model runners
# ---------------------------------------------------------------------------

async def _run_crop(latitude: float, longitude: float) -> dict:
    """
    Mirrors POST /predict/crop-simple exactly (same geocode -> soil -> weather
    -> predict chain), reusing the router's feature-to-CropOutput assembly so
    part 1's data_resolution / input_confidence / data_quality_note fields are
    guaranteed identical and the frontend badge renders unchanged.
    """
    location = await reverse_geocode(latitude, longitude, NOMINATIM_USER_AGENT)
    state = location.get("state")
    district = location.get("district")

    if not state:
        raise PipelineInputError(
            "Could not determine the state from the provided GPS coordinates."
        )

    soil = get_regional_soil_values(state, district)
    weather = await fetch_weather_features(latitude, longitude)

    N, P, K, ph = soil["N"], soil["P"], soil["K"], soil["ph"]
    temperature = weather["temperature"]
    humidity = weather["humidity"]
    rainfall = weather.get("avg_annual_rainfall", weather.get("rainfall"))

    is_degraded = soil["input_confidence"] == "low"
    data_quality_note = (
        "Recommendation based on generic averages — soil data "
        "unavailable for your exact location."
        if is_degraded
        else None
    )

    output = await _predict_from_features(
        {
            "N": N,
            "P": P,
            "K": K,
            "ph": ph,
            "temperature": temperature,
            "humidity": humidity,
            "rainfall": rainfall,
            "soil_source": soil.get("source", "regional_estimate"),
            "weather_source": "OpenWeather + NASA POWER (annual avg rainfall)",
            "warning": soil.get("warning"),
            "data_resolution": soil["data_resolution"],
            "input_confidence": soil["input_confidence"],
            "data_quality_note": data_quality_note,
        },
        location=district or state,
    )

    return {
        "model": "crop",
        "predicted_crop": output.predicted_crop,
        "predicted_class": None,
        "confidence": output.confidence,
        "confidence_label": output.confidence_label,
        "soil_source": output.soil_source,
        "weather_source": output.weather_source,
        "location": output.location,
        "warning": output.warning,
        "data_resolution": output.data_resolution,
        "input_confidence": output.input_confidence,
        "data_quality_note": output.data_quality_note,
    }


def _pretty_class(class_name: str) -> str:
    return re.sub(r"\s+", " ", class_name.replace("_", " ")).strip()


def _run_disease(image_bytes: bytes) -> dict:
    class_name, confidence = disease_service.predict(image_bytes)
    return {
        "model": "disease",
        "predicted_class": _pretty_class(class_name),
        "confidence": confidence,
        "confidence_label": _confidence_label(confidence),
    }


def _run_pest(image_bytes: bytes) -> dict:
    class_name, confidence = _pest_predict_image(image_bytes)
    return {
        "model": "pest",
        "predicted_class": _pretty_class(class_name),
        "confidence": confidence,
        "confidence_label": _confidence_label(confidence),
    }


# ---------------------------------------------------------------------------
# Step 3 — branching
# ---------------------------------------------------------------------------

def _plan_models(intent, has_image: bool, has_location: bool) -> list[str]:
    """Decide which models to run. Returns ordered model keys, or raises
    PipelineInputError with a clear, human message about exactly what is
    missing."""

    if intent == "crop_recommendation":
        if not has_location:
            raise PipelineInputError(
                "I need your location to recommend a crop for your field. "
                "Please share your village or GPS location and try again."
            )
        return ["crop"]

    if intent == "disease_check":
        if not has_image:
            raise PipelineInputError(
                "A photo of the leaf is required for a disease check. "
                "Please attach a close-up image and try again."
            )
        return ["disease"]

    if intent == "pest_check":
        if not has_image:
            raise PipelineInputError(
                "A photo of the plant is required for a pest check. "
                "Please attach a close-up image and try again."
            )
        return ["pest"]

    # ---- unclear, or no voice at all: run every model the inputs support ----
    if not has_image and not has_location:
        raise PipelineInputError(
            "I did not get any voice, photo, or location to work with. "
            "Please record a question, attach a photo, or share your location."
        )

    order = []
    if has_image:
        order.append("disease")
        order.append("pest")
    if has_location:
        order.append("crop")
    return order


# ---------------------------------------------------------------------------
# Step 5 — short bilingual summary
# ---------------------------------------------------------------------------

def _pct(conf: float) -> str:
    return str(round(conf * 100))


def _summarize(results: list[dict], lang: str) -> str:
    crop = next((r for r in results if r["model"] == "crop"), None)
    disease = next((r for r in results if r["model"] == "disease"), None)
    pest = next((r for r in results if r["model"] == "pest"), None)

    sentences = []

    if crop:
        crop_name = crop["predicted_crop"]
        pct = _pct(crop["confidence"])
        if lang == "ta":
            sentences.append(f"உங்கள் நிலத்திற்கு {crop_name} பயிர் பொருத்தமானது ({pct}% நம்பகம்).")
        else:
            sentences.append(f"A good fit for your field is {crop_name} ({pct}% confidence).")

        resolution = crop.get("data_resolution")
        note = crop.get("data_quality_note")
        if lang == "ta":
            if note:
                sentences.append(
                    "உங்கள் இடத்தின் சரியான மண் தரவு கிடைக்காததால், பொதுவான மதிப்புகள் பயன்படுத்தப்பட்டன. செயல்படும் முன் உள்ளூர் நிபுணரிடம் சரிபார்க்கவும்."
                )
            elif resolution == "district":
                sentences.append("இந்த பரிந்துரை மாவட்ட அளவிலான மண் தரவின் அடிப்படையில் உள்ளது.")
            elif resolution == "state":
                sentences.append("இந்த பரிந்துரை மாநில அளவிலான மண் தரவின் அடிப்படையில் உள்ளது.")
        else:
            if note:
                sentences.append(
                    "Because precise soil data was unavailable, generic averages were used — please check with a local expert before acting."
                )
            elif resolution == "district":
                sentences.append("This recommendation is based on district-level soil data.")
            elif resolution == "state":
                sentences.append("This recommendation is based on state-level soil data.")

    if disease and pest:
        if lang == "ta":
            sentences.append(
                f"உங்கள் இலையில் {disease['predicted_class']} ({_pct(disease['confidence'])}%), புகைப்படத்தில் {pest['predicted_class']} ({_pct(pest['confidence'])}%) தெரிகிறது."
            )
        else:
            sentences.append(
                f"The leaf shows {disease['predicted_class']} ({_pct(disease['confidence'])}%), and the photo also shows {pest['predicted_class']} ({_pct(pest['confidence'])}%)."
            )
    elif disease:
        if lang == "ta":
            sentences.append(
                f"உங்கள் இலையில் {disease['predicted_class']} ({_pct(disease['confidence'])}%) கண்டறியப்பட்டது."
            )
        else:
            sentences.append(
                f"The leaf shows {disease['predicted_class']} ({_pct(disease['confidence'])}% confidence)."
            )
    elif pest:
        if lang == "ta":
            sentences.append(
                f"புகைப்படத்தில் {pest['predicted_class']} ({_pct(pest['confidence'])}%) தெரிகிறது."
            )
        else:
            sentences.append(
                f"The photo shows {pest['predicted_class']} ({_pct(pest['confidence'])}% confidence)."
            )

    return " ".join(sentences)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_pipeline(
    *,
    audio_path: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    lang_override: Optional[str] = None,
    transcribe_fn=None,
) -> dict:
    """
    Core pipeline. transcribe_fn(path, language) is injected so the router can
    pass voice_service.transcribe and tests can stub it.

    Returns:
      {
        "intent", "transcribed_text", "detected_language", "language_probability",
        "results": [ModelResult dicts in run order],
        "crop_result" | "disease_result" | "pest_result": per-model dicts (None if not run),
        "summary": str (in the response language),
        "summary_language": str,
      }

    Raises PipelineInputError for missing inputs (clear messages).
    """

    has_image = bool(image_bytes)
    has_location = latitude is not None and longitude is not None

    # 1. ASR (auto-detect unless overridden). No speech -> blank text -> the
    #    "unclear" branch below (runs all applicable models).
    transcribed_text = ""
    detected_language = lang_override or "en"
    language_probability = None
    if audio_path and transcribe_fn is not None:
        stt = transcribe_fn(audio_path, language=lang_override)
        transcribed_text = (stt.get("text") or "").strip()
        detected_language = stt.get("language") or detected_language
        language_probability = stt.get("language_probability")

    # 2. intent (only from real speech)
    intent = "unclear"
    if transcribed_text:
        intent = parse_intent(transcribed_text, language=detected_language)["intent"]

    # 3. branch -> which models run (raises clear errors for missing inputs)
    plan = _plan_models(intent, has_image, has_location)

    # 4. run each model in plan order (crop/disease/pest)
    results = []
    for key in plan:
        if key == "crop":
            results.append(await _run_crop(latitude, longitude))
        elif key == "disease":
            results.append(_run_disease(image_bytes))
        elif key == "pest":
            results.append(_run_pest(image_bytes))

    # 5. response language: override > detected > English
    out_lang = lang_override if lang_override in VALID_LANGS else (
        detected_language if detected_language in VALID_LANGS else "en"
    )

    # 6. summary
    summary = _summarize(results, out_lang)

    return {
        "intent": intent,
        "transcribed_text": transcribed_text,
        "detected_language": detected_language if detected_language in VALID_LANGS else "en",
        "language_probability": language_probability,
        "results": results,
        "crop_result": next((r for r in results if r["model"] == "crop"), None),
        "disease_result": next((r for r in results if r["model"] == "disease"), None),
        "pest_result": next((r for r in results if r["model"] == "pest"), None),
        "summary": summary,
        "summary_language": out_lang,
    }