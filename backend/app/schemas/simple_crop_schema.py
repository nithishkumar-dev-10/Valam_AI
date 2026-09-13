from pydantic import BaseModel, Field


class SimpleCropInput(BaseModel):
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