from fastapi import APIRouter, File, UploadFile
from starlette.concurrency import run_in_threadpool

from app.schemas.prediction import DiseaseOutput
from app.services.dl.disease_service import disease_service
from app.validation import validate_image_upload

router = APIRouter(prefix="/predict", tags=["disease"])


@router.post(
    "/disease",
    response_model=DiseaseOutput,
    summary="Identify plant disease",
    description=(
        "Classifies a field photo as one of 38 tomato/pepper/apple/etc. disease or healthy "
        "classes (PlantVillage CNN). No auth required. Returns predicted class + softmax confidence."
    ),
    responses={
        413: {"description": "Image exceeds 15 MB"},
        415: {"description": "File is not a valid JPEG/PNG/WebP"},
        422: {"description": "Invalid input"},
    },
)
async def predict_disease(file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    # CNN inference is CPU-bound torch that releases the GIL; offload it so the
    # single event loop keeps serving (health checks, other users) during it.
    class_name, confidence = await run_in_threadpool(disease_service.predict, image_bytes)
    return DiseaseOutput(predicted_class=class_name, confidence=confidence)