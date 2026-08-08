from pydantic import BaseModel, Field
from typing import List


class CropPredictionRequest(BaseModel):
    N: float = Field(..., description="Nitrogen content in soil", example=90)
    P: float = Field(..., description="Phosphorus content in soil", example=42)
    K: float = Field(..., description="Potassium content in soil", example=43)
    temperature: float = Field(..., description="Temperature in Celsius", example=20.9)
    humidity: float = Field(..., description="Relative humidity in %", example=82.0)
    ph: float = Field(..., description="Soil pH value", example=6.5)
    rainfall: float = Field(..., description="Rainfall in mm", example=200.0)


class CropCandidate(BaseModel):
    crop: str
    confidence: float


class CropPredictionResponse(BaseModel):
    recommended_crop: str
    confidence: float
    top_3: List[CropCandidate]
