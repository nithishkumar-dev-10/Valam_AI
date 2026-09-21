from pydantic import BaseModel, ConfigDict, Field


class SimpleCropInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(
        ...,
        ge=6.0,
        le=37.5,
        description="GPS latitude of the farm"
    )

    longitude: float = Field(
        ...,
        ge=68.0,
        le=97.5,
        description="GPS longitude of the farm"
    )