"""
app/services/dl/intent_router.py

Takes the transcribed (English-translated) text + optional GPS coords +
optional image bytes from the voice endpoint, decides which feature it
maps to, and returns a plain English response (translated back to the
farmer's language upstream).
"""

from typing import Optional
from app.utils.logger import logger

from app.services.ml.crop_predictor import crop_predictor
from app.services.dl.disease_service import disease_service
from app.services.dl.deep_weed_service import deep_weed_service
from app.services.external.geocoding import reverse_geocode
from app.services.external.weather_fetch import fetch_weather_features
from app.services.external.soil_lookup import get_regional_soil_values
from app.config import NOMINATIM_USER_AGENT


INTENT_KEYWORDS = {
    "crop": ["crop", "grow", "plant", "suggest", "recommend", "land", "soil"],
    "disease": ["disease", "leaf", "sick", "infected", "spots", "wilting"],
    "weed_pest": ["weed", "pest", "insect", "bug"],
    "market": ["price", "sell", "market", "mandi"],
    "pesticide": ["pesticide", "spray", "dosage", "treatment"],
    "weather": ["weather", "rain", "forecast"],
    "scheme": ["scheme", "subsidy", "government", "loan"],
}


def detect_intent(text: str) -> Optional[str]:
    """Very simple keyword match. Swap for Gemini classification later — farmer
    phrasing will get messier than clean keyword matches can handle."""
    text_lower = text.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return intent
    return None


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.80:
        return "high"
    if confidence >= 0.60:
        return "medium"
    return "low"


async def _handle_crop_intent(latitude: Optional[float], longitude: Optional[float]) -> str:
    """
    Mirrors app/routers/crop.py's predict_crop_simple() pipeline exactly:
    GPS -> state/district -> regional soil values + live weather -> crop_predictor.
    """
    if latitude is None or longitude is None:
        return "I need your location to suggest a crop for your land. Please enable location access and try again."

    try:
        location = await reverse_geocode(latitude, longitude, NOMINATIM_USER_AGENT)
        state = location.get("state")
        district = location.get("district")

        if not state:
            return "Sorry, I couldn't figure out your location from GPS. Could you try again?"

        soil = get_regional_soil_values(state, district)
        weather = await fetch_weather_features(latitude, longitude)

        N, P, K, ph = soil["N"], soil["P"], soil["K"], soil["ph"]
        temperature = weather["temperature"]
        humidity = weather["humidity"]
        rainfall = weather["rainfall"]

        crop_name, confidence = crop_predictor.predict(
            N=N, P=P, K=K,
            temperature=temperature, humidity=humidity,
            ph=ph, rainfall=rainfall,
        )

        confidence_pct = round(confidence * 100)
        confidence_word = _confidence_label(confidence)

        return (
            f"Based on your land's soil and current weather, I recommend growing {crop_name}. "
            f"Confidence: {confidence_pct}% ({confidence_word})."
        )

    except Exception as e:
        logger.error(f"Crop intent handling failed: {e}")
        return "Sorry, something went wrong while checking crop suggestions for your location. Please try again."


def _handle_disease_intent(image_bytes: bytes) -> str:
    try:
        class_name, confidence = disease_service.predict(image_bytes)
        return f"This looks like {class_name.replace('_', ' ')}. Confidence: {round(confidence * 100)}%."
    except Exception as e:
        logger.error(f"Disease intent handling failed: {e}")
        return "Sorry, something went wrong while checking the photo for disease. Please try again."


def _handle_weed_pest_intent(image_bytes: bytes) -> str:
    try:
        class_name, confidence = deep_weed_service.predict(image_bytes)
        return f"This looks like {class_name.replace('_', ' ')}. Confidence: {round(confidence * 100)}%."
    except Exception as e:
        logger.error(f"Weed/pest intent handling failed: {e}")
        return "Sorry, something went wrong while checking the photo for weeds or pests. Please try again."


def _handle_dual_image_intent(image_bytes: bytes) -> str:
    """
    Intent was unclear but a photo was attached. Run BOTH models and let
    the farmer's next reply tell us which result actually matches.
    """
    try:
        disease_class, disease_conf = disease_service.predict(image_bytes)
        weed_class, weed_conf = deep_weed_service.predict(image_bytes)
        return (
            f"I checked your photo two ways. "
            f"Disease check: {disease_class.replace('_', ' ')} ({round(disease_conf * 100)}% confidence). "
            f"Weed or pest check: {weed_class.replace('_', ' ')} ({round(weed_conf * 100)}% confidence). "
            f"Please tell me which one matches what you're seeing."
        )
    except Exception as e:
        logger.error(f"Dual image intent handling failed: {e}")
        return "Sorry, something went wrong while checking your photo. Please try again."


async def route_query(
    text: str,
    language: str = "en",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    image_bytes: Optional[bytes] = None,
) -> dict:
    """
    Returns: {"intent": "crop", "response_text": "..."}
    """
    intent = detect_intent(text)
    logger.info(
        f"Voice query routed to intent: {intent} | text: {text} | has_image: {image_bytes is not None}"
    )

    if intent == "crop":
        response_text = await _handle_crop_intent(latitude, longitude)

    elif intent == "disease":
        if image_bytes is None:
            response_text = "I need a photo of the affected leaf to check for disease. Please attach a photo and try again."
        else:
            response_text = _handle_disease_intent(image_bytes)

    elif intent == "weed_pest":
        if image_bytes is None:
            response_text = "I need a photo of your field to check for weeds or pests. Please attach a photo and try again."
        else:
            response_text = _handle_weed_pest_intent(image_bytes)

    elif image_bytes is not None:
        # Intent unclear, but a photo was attached anyway — check both models.
        intent = "disease_or_weed_pest"
        response_text = _handle_dual_image_intent(image_bytes)

    elif intent == "market":
        response_text = "Market advisor feature not yet wired up — need market_service.py signature."
    elif intent == "pesticide":
        response_text = "Pesticide advisor feature not yet wired up."
    elif intent == "weather":
        response_text = "Weather advisory feature not yet wired up."
    elif intent == "scheme":
        response_text = "Government scheme assistant not yet wired up."
    else:
        response_text = "Sorry, I couldn't understand what you need. Could you rephrase, or attach a photo if it's about a plant?"

    return {"intent": intent, "response_text": response_text}
