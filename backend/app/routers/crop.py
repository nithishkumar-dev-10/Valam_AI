from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool
from app.utils.logger import logger

from app.schemas.simple_crop_schema import SimpleCropInput
from app.schemas.prediction import CropOutput

from app.services.external.geocoding import reverse_geocode
from app.services.external.weather_fetch import fetch_weather_features
from app.services.external.soil_lookup import get_regional_soil_values
from app.services.ml.crop_predictor import get_predictor

from app.config import NOMINATIM_USER_AGENT, PREDICT_RATE_PER_MINUTE
from app.rate_limiter import limiter


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


class ManualCropInput(BaseModel):
    """
    Direct override inputs — bypasses geocoding and soil lookup entirely.
    Soil values are treated as measured (Soil Health Card style).
    Unknown JSON fields are rejected (extra="forbid").
    """

    model_config = ConfigDict(extra="forbid")

    N: float = Field(..., ge=0)
    P: float = Field(..., ge=0)
    K: float = Field(..., ge=0)
    temperature: float = Field(..., ge=-50, le=60)
    humidity: float = Field(..., ge=0, le=100)
    ph: float = Field(..., ge=0, le=14)
    rainfall: float = Field(..., ge=0)


async def _predict_from_features(features: dict, location: str) -> CropOutput:
    try:
        predictor = get_predictor()
    except RuntimeError:
        logger.error("crop model is not loaded — refusing crop prediction")
        raise HTTPException(
            status_code=503,
            detail="Crop model is currently unavailable. Please try again later.",
        )

    # joblib predict is a blocking call; keep it off the single event loop.
    crop_name, confidence = await run_in_threadpool(
        predictor.predict,
        N=features["N"],
        P=features["P"],
        K=features["K"],
        temperature=features["temperature"],
        humidity=features["humidity"],
        ph=features["ph"],
        rainfall=features["rainfall"],
    )

    return CropOutput(
        predicted_crop=crop_name,
        confidence=confidence,
        confidence_label=_confidence_label(confidence),
        soil_source=features["soil_source"],
        weather_source=features["weather_source"],
        location=location,
        warning=features.get("warning"),
        data_resolution=features["data_resolution"],
        input_confidence=features["input_confidence"],
        data_quality_note=features.get("data_quality_note"),
    )


@router.post(
    "/crop-simple",
    response_model=CropOutput,
    summary="Recommend a crop from GPS",
    description=(
        "Recommends a crop for a farm given only GPS coordinates. The backend looks up the "
        "district/state, regional soil nutrient values, current weather + annual rainfall "
        "(OpenWeather + NASA POWER), and predicts the best crop.\n\n"
        "Latitude must be within India (6.0–37.5), longitude within 68.0–97.5. "
        "No auth required."
    ),
    responses={
        400: {"description": "Could not determine the state from those coordinates"},
        422: {"description": "Coordinates out of range or malformed"},
        429: {"description": "Too many requests from this IP (25/minute)"},
        500: {"description": "Geocoding/weather lookup failed (generic body; detail logged server-side)"},
    },
)
@limiter.limit(PREDICT_RATE_PER_MINUTE)
async def predict_crop_simple(request: Request, payload: SimpleCropInput):

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
        # Resolves district -> state -> training-median fallback and
        # always reports which tier produced the values via
        # data_resolution / input_confidence / warning.

        soil = get_regional_soil_values(state, district)

        # =========================================================
        # 3. GPS coordinates → Weather
        # =========================================================
        #
        # fetch_weather_features() takes ONLY (latitude, longitude).
        # It reads WEATHER_API_KEY from the environment itself
        # (via app.config's load_dotenv() side effect), and it
        # internally merges in NASA POWER annual-average rainfall.
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
        # Rainfall is an annual average (NASA POWER), not current
        # conditions — keep that distinction in the outer response.

        temperature = weather["temperature"]
        humidity = weather["humidity"]
        rainfall = weather.get("avg_annual_rainfall", weather.get("rainfall"))

        # =========================================================
        # 6. Response assembly
        # =========================================================

        location_label = district or state
        is_degraded = soil["input_confidence"] == "low"

        # Prominent plain-language note whenever inputs are generic
        # (Issue 1) — surfaced as its own field, not buried in `warning`.
        data_quality_note = (
            "Recommendation based on generic averages — soil data "
            "unavailable for your exact location."
            if is_degraded
            else None
        )

        return await _predict_from_features(
            {
                **{
                    "N": N,
                    "P": P,
                    "K": K,
                    "ph": ph,
                    "temperature": temperature,
                    "humidity": humidity,
                    "rainfall": rainfall,
                },
                "soil_source": soil.get("source", "regional_estimate"),
                "weather_source": "OpenWeather + NASA POWER (annual avg rainfall)",
                "warning": soil.get("warning"),
                "data_resolution": soil["data_resolution"],
                "input_confidence": soil["input_confidence"],
                "data_quality_note": data_quality_note,
            },
            location=location_label,
        )

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("crop-simple failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Crop recommendation failed. Please try again.",
        )


@router.post(
    "/crop-manual",
    response_model=CropOutput,
    summary="Recommend a crop from measured soil values",
    description=(
        "Like `/crop-simple` but you supply measured N/P/K/pH/temperature/humidity/rainfall "
        "directly (e.g. Soil Health Card values). Bypasses geocoding and soil lookup. "
        "`input_confidence` is reported `high`."
    ),
    responses={
        422: {"description": "Values out of range (e.g. rainfall < 0, humidity > 100)"},
        429: {"description": "Too many requests from this IP (25/minute)"},
        500: {"description": "Prediction failed (generic body; detail logged server-side)"},
    },
)
@limiter.limit(PREDICT_RATE_PER_MINUTE)
async def predict_crop_manual(request: Request, payload: ManualCropInput):
    """
    Manual override: supply exact N/P/K/temperature/humidity/ph/rainfall,
    bypassing geocoding and soil lookup entirely. Intended for advanced
    users and testers (e.g. Soil Health Card values or CLI --manual mode).
    """

    try:
        return await _predict_from_features(
            {
                "N": payload.N,
                "P": payload.P,
                "K": payload.K,
                "ph": payload.ph,
                "temperature": payload.temperature,
                "humidity": payload.humidity,
                "rainfall": payload.rainfall,
                "soil_source": "user_provided_manual_input",
                "weather_source": "user_provided_manual_input",
                "warning": None,
                "data_resolution": "manual",
                "input_confidence": "high",
                "data_quality_note": None,
            },
            location="manual input",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("crop-manual failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Crop recommendation failed. Please try again.",
        )