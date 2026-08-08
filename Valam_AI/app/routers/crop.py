from fastapi import APIRouter
from app.schemas.prediction import CropPredictionRequest, CropPredictionResponse
from app.services.ml.crop_predictor import predict_crop

router = APIRouter(prefix="/predict", tags=["Crop Recommendation (ML)"])


@router.post("/crop", response_model=CropPredictionResponse)
def get_crop_recommendation(payload: CropPredictionRequest):
    """
    Predicts the most suitable crop based on soil nutrients (N, P, K),
    pH, and climate conditions (temperature, humidity, rainfall).
    """
    result = predict_crop(
        n=payload.N,
        p=payload.P,
        k=payload.K,
        temperature=payload.temperature,
        humidity=payload.humidity,
        ph=payload.ph,
        rainfall=payload.rainfall,
    )
    return result
