from pydantic import BaseModel


class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float


class CropOutput(BaseModel):
    predicted_crop: str
    confidence: float
    confidence_label: str
    soil_source: str
    weather_source: str
    location: str
    warning: str | None = None


class DiseaseOutput(BaseModel):
    predicted_class: str
    confidence: float


class WeedPestOutput(BaseModel):
    predicted_class: str
    confidence: float
