from fastapi import FastAPI

from app.routers import crop, disease, weed_pest

app = FastAPI(
    title="Valam AI",
    description="AI-powered farmer assistant backend — ML, DL, and GenAI features.",
    version="0.1.0"
)

app.include_router(crop.router)
app.include_router(disease.router)
app.include_router(weed_pest.router)


@app.get("/")
def root():
    return {"status": "Valam AI backend is running"}