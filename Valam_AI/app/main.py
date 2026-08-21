import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI

from app.database import Base, engine
from app.models import farmer  # noqa: F401 -- registers the model before create_all
from app.routers import crop, disease, deep_weed, voice, auth

# Creates the farmers table on startup if it doesn't exist yet.
# Fine for v1 -- swap to Alembic migrations before this has real user data.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Valam AI",
    description="AI-powered farmer assistant backend — ML, DL, and Auth (v1).",
    version="1.0.0"
)

app.include_router(auth.router)
app.include_router(crop.router)
app.include_router(disease.router)
app.include_router(deep_weed.router)
app.include_router(voice.router)


@app.get("/")
def root():
    return {"status": "Valam AI backend is running"}
