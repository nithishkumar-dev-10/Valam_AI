from fastapi import APIRouter, File, UploadFile

from app.schemas.prediction import DiseaseOutput
from app.services.dl.disease_service import disease_service

router = APIRouter(prefix="/predict", tags=["disease"])


@router.post("/disease", response_model=DiseaseOutput)
async def predict_disease(file: UploadFile = File(...)):
    image_bytes = await file.read()
    class_name, confidence = disease_service.predict(image_bytes)
    return DiseaseOutput(predicted_class=class_name, confidence=confidence)