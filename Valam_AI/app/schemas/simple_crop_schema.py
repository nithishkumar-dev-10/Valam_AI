from typing import Literal
from pydantic import BaseModel, Field


class SimpleCropInput(BaseModel):
    # Location drives auto-fetched weather data
    latitude: float = Field(..., description="Farmer's field latitude")
    longitude: float = Field(..., description="Farmer's field longitude")

    # Qualitative soil inputs — no lab numbers required
    soil_nitrogen: Literal["low", "medium", "high"]
    soil_phosphorus: Literal["low", "medium", "high"]
    soil_potassium: Literal["low", "medium", "high"]
    soil_ph: Literal["acidic", "neutral", "alkaline"]