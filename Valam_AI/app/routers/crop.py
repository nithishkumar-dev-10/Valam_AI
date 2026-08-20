from fastapi import APIRouter, HTTPException

from app.schemas.simple_crop_schema import SimpleCropInput
from app.services.ml.crop_input_converter import convert_soil_inputs
from app.services.external.weather_fetch import fetch_weather_features
from app.services.ml.crop_predictor import crop_predictor  # your existing model wrapper
from app.config import WEATHER_API_KEY  # add this to config.py, sourced from .env

router = APIRouter(prefix="/predict", tags=["crop"])


@router.post("/crop-simple")
async def predict_crop_simple(payload: SimpleCropInput):
    try:
        weather = await fetch_weather_features(
            lat=payload.latitude,
            lon=payload.longitude,
            api_key=WEATHER_API_KEY,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch weather data for this location.")

    soil = convert_soil_inputs(
        soil_nitrogen=payload.soil_nitrogen,
        soil_phosphorus=payload.soil_phosphorus,
        soil_potassium=payload.soil_potassium,
        soil_ph=payload.soil_ph,
    )

    crop_name, confidence = crop_predictor.predict(
        N=soil["N"],
        P=soil["P"],
        K=soil["K"],
        temperature=weather["temperature"],
        humidity=weather["humidity"],
        ph=soil["ph"],
        rainfall=weather["rainfall"],
    )

    return {"predicted_crop": crop_name, "confidence": confidence}