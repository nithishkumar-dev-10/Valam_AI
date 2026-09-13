"""
app/schemas/farmer.py

Pydantic schemas for signup/login request and response shapes.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class FarmerSignup(BaseModel):
    """Request body for POST /api/v1/auth/signup.

    Phone number is the account identifier (IN format please — +91 optional).
    Password is bcrypt-hashed server-side; never stored or echoed in plaintext.
    """

    name: str = Field(
        ...,
        min_length=2,
        max_length=120,
        description="Farmer's display name.",
        examples=["Kamala"],
    )
    phone_number: str = Field(
        ...,
        min_length=10,
        max_length=15,
        description="Login phone number (digits, optional +91).",
        examples=["9845012345"],
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Password — hashed with bcrypt, never returned by the API.",
        examples=["S3cur3-Passw0rd!"],
    )


class FarmerLogin(BaseModel):
    phone_number: str
    password: str


class FarmerOut(BaseModel):
    """Public view of a farmer account. Deliberately excludes hashed_password."""

    id: int = Field(..., description="Row id.")
    name: str = Field(..., description="Display name.")
    phone_number: str = Field(..., description="Login phone number.")
    created_at: datetime = Field(..., description="UTC timestamp of creation.")

    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT pair returned by login/refresh. Values are opaque signed JWTs."""

    access_token: str = Field(
        ...,
        description="Short-lived access JWT (default 7 days). Send as `Authorization: Bearer <token>`.",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwIjoiYWNjZXNzIn0.example"],
    )
    refresh_token: str = Field(
        "",
        description="28-day refresh JWT. Post it to /auth/refresh to rotate. Never used as a Bearer token.",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwIjoicmVmcmVzaCJ9.example"],
    )
    token_type: str = Field("bearer", description="Always `bearer`.")