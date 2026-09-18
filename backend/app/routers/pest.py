import io
import json

import numpy as np
import onnxruntime as ort
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from PIL import Image
from starlette.concurrency import run_in_threadpool
from torchvision import transforms

from app.config import ML_MODELS_DIR, PREDICT_RATE_PER_MINUTE
from app.schemas.prediction import WeedPestOutput
from app.utils.logger import logger
from app.validation import validate_image_upload
from app.rate_limiter import limiter

router = APIRouter(prefix="/predict", tags=["pest"])

# The ONNX session is a module-level singleton: it loads once at import time,
# not on every request. Must match train_pest_model.py exactly.
PEST_MODEL_PATH = ML_MODELS_DIR / "pest_model.onnx"
PEST_CLASSES_PATH = ML_MODELS_DIR / "pest_classes.json"

# ===========================================================================
# Import-time model load, guarded: a missing/corrupt ONNX or classes file must
# NOT take down the whole API at startup. The failure is logged once (with its
# traceback); pest endpoints then return 503 instead of crashing the process.
# ===========================================================================
try:
    _session = ort.InferenceSession(str(PEST_MODEL_PATH), providers=["CPUExecutionProvider"])
except Exception:
    logger.exception("Pest ONNX model failed to load at import time (%s)", PEST_MODEL_PATH)
    _session = None

try:
    with open(PEST_CLASSES_PATH) as f:
        _pest_classes = json.load(f)
except Exception:
    logger.exception("Pest class list failed to load at import time (%s)", PEST_CLASSES_PATH)
    _pest_classes = None

# same as training transform (no augmentation, plain 224x224 resize)
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _predict(image_bytes: bytes):
    if _session is None:
        logger.error("pest model is not loaded — refusing pest prediction")
        raise HTTPException(
            status_code=503,
            detail="Pest model is currently unavailable. Please try again later.",
        )
    if _pest_classes is None:
        logger.error("pest class list is not loaded — refusing pest prediction")
        raise HTTPException(
            status_code=503,
            detail="Pest model is currently unavailable. Please try again later.",
        )

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _transform(img).unsqueeze(0).numpy()

    outputs = _session.run(None, {_session.get_inputs()[0].name: tensor})[0]

    # stable softmax over logits
    scores = outputs[0] - np.max(outputs[0])
    probs = np.exp(scores) / np.sum(np.exp(scores))
    idx = int(np.argmax(probs))

    return _pest_classes[idx], float(probs[idx])


@router.post(
    "/pest",
    response_model=WeedPestOutput,
    summary="Identify pest type",
    description=(
        "Classifies a photo of a pest into one of 9 classes (ONNX model, CPU). "
        "Returns predicted label + softmax confidence."
    ),
    responses={
        413: {"description": "Image exceeds 15 MB"},
        415: {"description": "File is not a valid JPEG/PNG/WebP"},
        422: {"description": "Invalid input"},
        429: {"description": "Too many requests from this IP (25/minute)"},
    },
)
@limiter.limit(PREDICT_RATE_PER_MINUTE)
async def predict_pest(request: Request, file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    # ONNX inference is CPU-bound; offload it so the single event loop keeps
    # serving (health checks, other users) during it.
    class_name, confidence = await run_in_threadpool(_predict, image_bytes)
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)