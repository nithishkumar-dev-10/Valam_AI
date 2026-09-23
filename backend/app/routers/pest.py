import io
import json
import threading

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

# Must match train_pest_model.py exactly.
PEST_MODEL_PATH = ML_MODELS_DIR / "pest_model.onnx"
PEST_CLASSES_PATH = ML_MODELS_DIR / "pest_classes.json"


class PestService:
    """ONNX pest classifier, loaded lazily on first request.

    Mirrors the disease/deep-weed lazy-load pattern: nothing loads at import
    time (keeps boot memory flat on memory-constrained hosts), a lock guards
    against concurrent first-use races, and a load failure is remembered so
    predict() surfaces a 503 instead of crashing the process.
    """

    def __init__(self):
        self._session = None
        self._classes = None
        self._transform = None
        self._load_error = False
        self._lock = threading.Lock()

    def _ensure_loaded(self):
        if self._session is not None or self._load_error:
            return
        with self._lock:
            if self._session is not None or self._load_error:
                return

            try:
                self._session = ort.InferenceSession(
                    str(PEST_MODEL_PATH), providers=["CPUExecutionProvider"]
                )
                with open(PEST_CLASSES_PATH) as f:
                    self._classes = json.load(f)
                # same as training transform (no augmentation, plain 224x224 resize)
                self._transform = transforms.Compose([
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                          std=[0.229, 0.224, 0.225]),
                ])
            except Exception:
                # Fail fast from here on (no retry-per-request): log once with
                # the traceback and let predict() surface a clear error.
                self._load_error = True
                self._session = None
                logger.exception(
                    "Pest model failed to load (%s) — pest predictions will fail until the model is fixed",
                    PEST_MODEL_PATH,
                )

    def predict(self, image_bytes: bytes):
        self._ensure_loaded()
        if self._session is None:
            raise RuntimeError(
                "Pest model is unavailable (failed to load). Please try again later."
            )
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._transform(img).unsqueeze(0).numpy()

        outputs = self._session.run(None, {self._session.get_inputs()[0].name: tensor})[0]

        # stable softmax over logits
        scores = outputs[0] - np.max(outputs[0])
        probs = np.exp(scores) / np.sum(np.exp(scores))
        idx = int(np.argmax(probs))

        return self._classes[idx], float(probs[idx])


pest_service = PestService()


def _predict(image_bytes: bytes):
    """Module-level helper re-exported for the voice pipeline (pipeline.py
    imports `from app.routers.pest import _predict`). Lazy-loads the model and
    surfaces a 503 (not a 500) when it failed to load — same contract as the
    original import-time setup."""
    try:
        return pest_service.predict(image_bytes)
    except RuntimeError:
        logger.error("pest model is not loaded — refusing pest prediction")
        raise HTTPException(
            status_code=503,
            detail="Pest model is currently unavailable. Please try again later.",
        )


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
        503: {"description": "Pest model unavailable (failed to load)"},
    },
)
@limiter.limit(PREDICT_RATE_PER_MINUTE)
async def predict_pest(request: Request, file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    try:
        # ONNX inference is CPU-bound; offload it so the single event loop keeps
        # serving (health checks, other users) during it.
        class_name, confidence = await run_in_threadpool(pest_service.predict, image_bytes)
    except RuntimeError:
        logger.error("pest model is not loaded — refusing pest prediction")
        raise HTTPException(
            status_code=503,
            detail="Pest model is currently unavailable. Please try again later.",
        )
    return WeedPestOutput(predicted_class=class_name, confidence=confidence)