"""
Quick CLI prediction — no server needed.
Usage:
    python3 scripts/predict_cli.py 90 42 43 20.9 82.0 6.5 200.0
    (order: N P K temperature humidity ph rainfall)
"""

import sys
import joblib
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "app" / "ml_models"

model = joblib.load(MODEL_DIR / "crop_recommender.pkl")
label_encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")

if len(sys.argv) != 8:
    print("Usage: python3 predict_cli.py N P K temperature humidity ph rainfall")
    sys.exit(1)

values = [float(x) for x in sys.argv[1:]]
prediction = model.predict([values])[0]
crop = label_encoder.inverse_transform([prediction])[0]

print(f"Recommended crop: {crop}")