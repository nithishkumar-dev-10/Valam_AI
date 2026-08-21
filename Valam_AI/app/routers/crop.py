from fastapi import APIRouter, HTTPException

from app.schemas.simple_crop_schema import SimpleCropInput
from app.schemas.prediction import CropOutput

from app.services.external.geocoding import reverse_geocode
from app.services.external.weather_fetch import fetch_weather_features
from app.services.external.soil_lookup import get_regional_soil_values
from app.services.ml.crop_predictor import crop_predictor

from app.config import NOMINATIM_USER_AGENT


router = APIRouter(
    prefix="/predict",
    tags=["crop"],
)


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.80:
        return "high"

    if confidence >= 0.60:
        return "medium"

    return "low"


@router.post(
    "/crop-simple",
    response_model=CropOutput,
)
async def predict_crop_simple(payload: SimpleCropInput):

    try:

        # =========================================================
        # 1. GPS coordinates → Location
        # =========================================================

        location = await reverse_geocode(
            payload.latitude,
            payload.longitude,
            NOMINATIM_USER_AGENT,
        )

        state = location.get("state")
        district = location.get("district")

        if not state:
            raise HTTPException(
                status_code=400,
                detail="Could not determine the state from the provided GPS coordinates.",
            )

        # =========================================================
        # 2. State/District → Regional Soil Values
        # =========================================================

        soil = get_regional_soil_values(state, district)

        # =========================================================
        # 3. GPS coordinates → Weather
        # =========================================================
        #
        # fetch_weather_features() takes ONLY (latitude, longitude).
        # It reads WEATHER_API_KEY from the environment itself
        # (via app.config's load_dotenv() side effect), and it
        # internally merges in NASA POWER rainfall too.
        #
        # =========================================================

        weather = await fetch_weather_features(
            payload.latitude,
            payload.longitude,
        )

        # =========================================================
        # 4. Extract soil values
        # =========================================================

        N = soil["N"]
        P = soil["P"]
        K = soil["K"]
        ph = soil["ph"]

        # =========================================================
        # 5. Extract weather values
        # =========================================================

        temperature = weather["temperature"]
        humidity = weather["humidity"]
        rainfall = weather["rainfall"]

        # =========================================================
        # 6. Crop prediction
        # =========================================================

        crop_name, confidence = crop_predictor.predict(
            N=N,
            P=P,
            K=K,
            temperature=temperature,
            humidity=humidity,
            ph=ph,
            rainfall=rainfall,
        )

        # =========================================================
        # 7. Return result
        # =========================================================

        return CropOutput(
            predicted_crop=crop_name,
            confidence=confidence,
            confidence_label=_confidence_label(confidence),
            soil_source=soil.get("source", "regional_estimate"),
            weather_source="OpenWeather + NASA POWER",
            location=state,
            warning=soil.get("warning"),
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Crop recommendation failed: {str(exc)}",
        )