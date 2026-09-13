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
    # Part 1: explicit provenance of the soil/recommendation inputs.
    # Which tier of the fallback chain actually produced the N/P/K/pH values.
    data_resolution: str  # "district" | "state" | "fallback" | "manual"
    # How trustworthy those values are:
    #   high   -> soil health card / manual measured input
    #   medium -> regional state-level nutrient index
    #   low    -> generic training-data median (no regional signal)
    input_confidence: str
    # Human-readable, prominent note surfaced to the user whenever the
    # recommendation is based on generic averages (input_confidence == "low").
    # Mirrors `warning` but is guaranteed to be set for low-confidence inputs.
    data_quality_note: str | None = None


class DiseaseOutput(BaseModel):
    predicted_class: str
    confidence: float


class WeedPestOutput(BaseModel):
    predicted_class: str
    confidence: float