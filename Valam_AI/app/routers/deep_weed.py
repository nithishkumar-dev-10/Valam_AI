from fastapi import APIRouter, File, UploadFile

from app.schemas.prediction import WeedPestOutput
from app.services.dl.deep_weed_service import deep_weed_service

router = APIRouter(prefix="/predict", tags=["deep-weed"])

@router.post("/deep-weed", response_model=WeedPestOutput)
async def predict_deep_weed(file: UploadFile = File(...)):
    image_bytes = await file.read()
    class_name, confidence = deep_weed_service.predict(image_bytes)
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)