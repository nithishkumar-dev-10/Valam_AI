from fastapi import APIRouter, File, UploadFile

from app.schemas.prediction import WeedPestOutput
from app.services.dl.deep_weed_service import deep_weed_service
from app.validation import validate_image_upload

router = APIRouter(prefix="/predict", tags=["deep-weed"])

@router.post(
    "/deep-weed",
    response_model=WeedPestOutput,
    summary="Identify weed type",
    description=(
        "Classifies a field photo into one of 9 weed species (DeepWeeds CNN). "
        "Useful for targeted herbicide advice. Returns predicted label + softmax confidence."
    ),
    responses={
        413: {"description": "Image exceeds 15 MB"},
        415: {"description": "File is not a valid JPEG/PNG/WebP"},
        422: {"description": "Invalid input"},
    },
)
async def predict_deep_weed(file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    class_name, confidence = deep_weed_service.predict(image_bytes)
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)