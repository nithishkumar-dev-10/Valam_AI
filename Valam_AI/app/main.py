import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.models import farmer  # noqa: F401 -- registers the model before create_all
from app.routers import crop, disease, deep_weed, voice, auth
from app.config import STATIC_DIR, VOICE_AUDIO_OUTPUT_DIR

# Creates the farmers table on startup if it doesn't exist yet.
# Fine for v1 -- swap to Alembic migrations before this has real user data.
Base.metadata.create_all(bind=engine)

os.makedirs(VOICE_AUDIO_OUTPUT_DIR, exist_ok=True)

app = FastAPI(
    title="Valam AI",
    description="AI-powered farmer assistant backend — ML, DL, and Auth (v1).",
    version="1.0.0"
)

# CORS -- required once the frontend runs on a different origin
# (e.g. localhost:3000) than this backend (localhost:8000).
# Replace the localhost entries with your deployed frontend domain later.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves app/static/** at /static/** so audio files, etc. are fetchable
# over HTTP instead of only existing as a local filesystem path.
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth.router)
app.include_router(crop.router)
app.include_router(disease.router)
app.include_router(deep_weed.router)
app.include_router(voice.router)


@app.get("/")
def root():
    return {"status": "Valam AI backend is running"}
