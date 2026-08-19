from fastapi import APIRouter

from app.schemas.prediction import CropInput, CropOutput
from app.services.ml.crop_service import crop_service

router = APIRouter(prefix="/predict", tags=["crop"])


@router.post("/crop", response_model=CropOutput)
def predict_crop(data: CropInput):
    crop, confidence = crop_service.predict(
        data.N, data.P, data.K, data.temperature,
        data.humidity, data.ph, data.rainfall
    )
    return CropOutput(predicted_crop=crop, confidence=confidence)