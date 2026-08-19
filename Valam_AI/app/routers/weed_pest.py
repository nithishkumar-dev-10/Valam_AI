from fastapi import APIRouter, File, UploadFile

from app.schemas.prediction import WeedPestOutput
from app.services.dl.weed_pest_service import weed_pest_service

router = APIRouter(prefix="/predict", tags=["weed-pest"])


@router.post("/weed-pest", response_model=WeedPestOutput)
async def predict_weed_pest(file: UploadFile = File(...)):
    image_bytes = await file.read()
    class_name, confidence = weed_pest_service.predict(image_bytes)
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)