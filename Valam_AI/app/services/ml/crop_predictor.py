# app/services/ml/crop_predictor.py

import joblib
import numpy as np

from app.config import CROP_MODEL_PATH, CROP_ENCODER_PATH


class CropPredictor:
    def __init__(self):
        self.model = joblib.load(CROP_MODEL_PATH)
        self.label_encoder = joblib.load(CROP_ENCODER_PATH)

    def predict(self, N, P, K, temperature, humidity, ph, rainfall):
        # order MUST match FEATURES in train_crop_model.py: N, P, K, temperature, humidity, ph, rainfall
        features = np.array([[N, P, K, temperature, humidity, ph, rainfall]])
        pred = self.model.predict(features)[0]
        proba = self.model.predict_proba(features)[0]
        confidence = float(max(proba))
        crop_name = self.label_encoder.inverse_transform([pred])[0]
        return crop_name, confidence


crop_predictor = CropPredictor()