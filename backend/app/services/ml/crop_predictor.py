from pathlib import Path
import joblib
import pandas as pd

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


crop_predictor = CropPredictor()
