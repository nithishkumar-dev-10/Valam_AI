import io
import json

import numpy as np
import onnxruntime as ort
from fastapi import APIRouter, File, UploadFile
from PIL import Image
from starlette.concurrency import run_in_threadpool
from torchvision import transforms

from app.config import ML_MODELS_DIR
from app.schemas.prediction import WeedPestOutput
from app.validation import validate_image_upload

router = APIRouter(prefix="/predict", tags=["pest"])

# The ONNX session is a module-level singleton: it loads once at import time,
# not on every request. Must match train_pest_model.py exactly.
PEST_MODEL_PATH = ML_MODELS_DIR / "pest_model.onnx"
PEST_CLASSES_PATH = ML_MODELS_DIR / "pest_classes.json"

_session = ort.InferenceSession(str(PEST_MODEL_PATH), providers=["CPUExecutionProvider"])

with open(PEST_CLASSES_PATH) as f:
    _pest_classes = json.load(f)

# same as training transform (no augmentation, plain 224x224 resize)
_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def _predict(image_bytes: bytes):
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
    },
)
async def predict_pest(file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    # ONNX inference is CPU-bound; offload it so the single event loop keeps
    # serving (health checks, other users) during it.
    class_name, confidence = await run_in_threadpool(_predict, image_bytes)
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)