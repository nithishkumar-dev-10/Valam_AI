import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI

from app.routers import crop, disease, deep_weed 

app = FastAPI(
    title="Valam AI",
    description="AI-powered farmer assistant backend — ML, DL, and GenAI features.",
    version="0.1.0"
)

app.include_router(crop.router)
app.include_router(disease.router)
app.include_router(deep_weed.router) 


@app.get("/")
def root():
    return {"status": "Valam AI backend is running"}