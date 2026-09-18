from pathlib import Path
import joblib
import pandas as pd

from app.utils.logger import logger

BASE_DIR = Path(__file__).resolve().parents[3]
MODEL_PATH = BASE_DIR / "app" / "ml_models" / "crop_recommender.pkl"
ENCODER_PATH = BASE_DIR / "app" / "ml_models" / "label_encoder.pkl"
DATA_PATH = BASE_DIR / "data" / "crop_recommendation.csv"

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]


class CropPredictor:
    def __init__(self):
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Crop model not found: {MODEL_PATH}")

        self.model = joblib.load(MODEL_PATH)

        if ENCODER_PATH.exists():
            self.encoder = joblib.load(ENCODER_PATH)
            self.labels = None
        else:
            self.encoder = None
            self.labels = sorted(
                pd.read_csv(DATA_PATH)["label"].astype(str).unique()
            )

    def predict(self, **features) -> tuple[str, float]:
        frame = pd.DataFrame(
            [{name: float(features[name]) for name in FEATURES}],
            columns=FEATURES,
        )

        encoded = int(self.model.predict(frame)[0])
        probabilities = self.model.predict_proba(frame)[0]
        confidence = float(probabilities.max())

        if self.encoder is not None:
            crop_name = str(self.encoder.inverse_transform([encoded])[0])
        else:
            crop_name = str(self.labels[encoded])

        return crop_name, round(confidence, 4)


def _load_predictor():
    """Import-time load, guarded: a missing/corrupt model must NOT take down
    the whole API at startup (health, auth, and the other models keep working).
    The failure is logged with its traceback here once, then surfacing as 503s
    on the crop endpoints (see get_predictor)."""
    try:
        return CropPredictor()
    except Exception:
        logger.exception("Crop model failed to load at import time (%s)", MODEL_PATH)
        return None


crop_predictor = _load_predictor()


def get_predictor() -> CropPredictor:
    """Return the singleton, or raise a clear RuntimeError when the crop model
    failed to load at startup so callers can map it to a 503 response."""
    if crop_predictor is None:
        raise RuntimeError("Crop model is unavailable (failed to load at startup).")
    return crop_predictor
