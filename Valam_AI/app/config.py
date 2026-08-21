from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ML_MODELS_DIR = BASE_DIR / "app" / "ml_models"

CROP_MODEL_PATH = ML_MODELS_DIR / "crop_recommender.pkl"
CROP_ENCODER_PATH = ML_MODELS_DIR / "label_encoder.pkl"

DISEASE_MODEL_PATH = ML_MODELS_DIR / "disease_cnn.pt"
DISEASE_CLASSES_PATH = ML_MODELS_DIR / "disease_classes.json"

DEEP_WEED_MODEL_PATH = ML_MODELS_DIR / "deepweeds_model.pt"
DEEP_WEED_CLASSES_PATH = ML_MODELS_DIR / "deepweeds_classes.json"

STATIC_DIR = BASE_DIR / "app" / "static"
VOICE_AUDIO_OUTPUT_DIR = STATIC_DIR / "voice_responses"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEFAULT_VOICE_LANGUAGE = os.getenv("DEFAULT_VOICE_LANGUAGE", "ta")

load_dotenv()

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
NOMINATIM_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "ValamAI/0.1 (crop-recommendation prototype)",
)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'valam.db'}")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-before-any-real-deployment")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
