from pydantic import BaseModel, Field


class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float


class CropOutput(BaseModel):
    """Result of a crop recommendation. `input_confidence` tells you how
    trustworthy the soil inputs were (manual → high, regional → medium,
    training-data fallback → low)."""

    predicted_crop: str = Field(..., description="Recommended crop name.", examples=["rice"])
    confidence: float = Field(..., description="Classifier confidence (0–1).", examples=[0.9351])
    confidence_label: str = Field(
        ...,
        description="Binned confidence: high (≥0.80) / medium (≥0.60) / low.",
        examples=["high"],
    )
    soil_source: str = Field(
        ...,
        description="Where the N/P/K/pH values came from.",
        examples=["regional_estimate"],
    )
    weather_source: str = Field(
        ...,
        description="Where temperature/humidity/rainfall came from.",
        examples=["OpenWeather + NASA POWER (annual avg rainfall)"],
    )
    location: str = Field(..., description="Resolved location label.", examples=["Ernakulam"])
    warning: str | None = Field(None, description="Optional advisory for degraded inputs.")
    # Part 1: explicit provenance of the soil/recommendation inputs.
    data_resolution: str = Field(
        ...,
        description="Which tier of the fallback chain produced the soil values.",
        examples=["district"],
    )  # "district" | "state" | "fallback" | "manual"
    input_confidence: str = Field(
        ...,
        description="high (measured) / medium (regional) / low (generic fallback).",
        examples=["medium"],
    )
    data_quality_note: str | None = Field(
        None,
        description="Plain-language caveat shown whenever inputs were generic averages.",
        examples=["Recommendation based on generic averages — soil data unavailable for your exact location."],
    )


class DiseaseOutput(BaseModel):
    """Result of plant-disease classification."""

    predicted_class: str = Field(..., description="Disease or healthy label.", examples=["Tomato___Leaf_Mold"])
    confidence: float = Field(..., description="Softmax confidence (0–1).", examples=[0.9211])


class WeedPestOutput(BaseModel):
    """Result of weed or pest classification."""

    predicted_class: str = Field(..., description="Weed/pest label.", examples=["Parthenium"])
    confidence: float = Field(..., description="Softmax confidence (0–1).", examples=[0.8442])