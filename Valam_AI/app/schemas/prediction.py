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


class DiseaseOutput(BaseModel):
    predicted_class: str
    confidence: float


class WeedPestOutput(BaseModel):
    predicted_class: str
    confidence: float