from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # Valam_AI/
ML_MODELS_DIR = BASE_DIR / "app" / "ml_models"

# Crop
CROP_MODEL_PATH = ML_MODELS_DIR / "crop_recommender.pkl"
CROP_ENCODER_PATH = ML_MODELS_DIR / "label_encoder.pkl"

# Disease
DISEASE_MODEL_PATH = ML_MODELS_DIR / "disease_cnn.pt"
DISEASE_CLASSES_PATH = ML_MODELS_DIR / "disease_classes.json"

# Weed/Pest
WEED_MODEL_PATH = ML_MODELS_DIR / "deepweeds_model.pt"
WEED_CLASSES_PATH = ML_MODELS_DIR / "deepweeds_classes.json"