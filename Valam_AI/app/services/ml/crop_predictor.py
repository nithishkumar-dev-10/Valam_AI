

import joblib
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml_models"

_model = joblib.load(MODEL_DIR / "crop_recommender.pkl")
_label_encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")

FEATURE_ORDER = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]


def predict_crop(n: float, p: float, k: float, temperature: float,
                  humidity: float, ph: float, rainfall: float) -> dict:
    
    features = [[n, p, k, temperature, humidity, ph, rainfall]]

    prediction = _model.predict(features)[0]
    probabilities = _model.predict_proba(features)[0]

    top_crop = _label_encoder.inverse_transform([prediction])[0]

    # Top 3 crops by probability, for a more useful response than just one label
    top3_idx = probabilities.argsort()[-3:][::-1]
    top3 = [
        {
            "crop": _label_encoder.inverse_transform([idx])[0],
            "confidence": round(float(probabilities[idx]), 4)
        }
        for idx in top3_idx
    ]

    return {
        "recommended_crop": top_crop,
        "confidence": round(float(probabilities[prediction]), 4),
        "top_3": top3
    }
