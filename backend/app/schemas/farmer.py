"""
app/schemas/farmer.py

Pydantic schemas for signup/login request and response shapes.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class FarmerSignup(BaseModel):
    """Request body for POST /api/v1/auth/signup.

    Phone number is the account identifier (IN format please — +91 optional).
    Password is bcrypt-hashed server-side; never stored or echoed in plaintext.
    Unknown/misspelled JSON fields are rejected (extra="forbid").
    """

    model_config = ConfigDict(extra="forbid")

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
        pattern=r"^\+?\d{10,15}$",
        description="Login phone number (digits, optional +91).",
        examples=["9845012345"],
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Password — 6–128 chars, must include letters AND digits. Hashed with bcrypt, never returned by the API.",
        examples=["S3cur3-Passw0rd!"],
    )

    @field_validator("password")
    @classmethod
    def _password_needs_letters_and_digits(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers")
        return v


class FarmerLogin(BaseModel):
    phone_number: str
    password: str

    model_config = ConfigDict(extra="forbid")


class FarmerOut(BaseModel):
    """Public view of a farmer account. Deliberately excludes hashed_password."""

    id: int = Field(..., description="Row id.")
    name: str = Field(..., description="Display name.")
    phone_number: str = Field(..., description="Login phone number.")
    created_at: datetime = Field(..., description="UTC timestamp of creation.")

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Login/refresh response body. Values are opaque signed JWTs.

    The refresh token is NOT in this body — it is delivered as an httpOnly,
    SameSite cookie scoped to /api/v1/auth (see app/auth/routers/auth.py), so
    XSS-injected JS cannot read it. The access token is the only token the
    client ever sees.
    """

    access_token: str = Field(
        ...,
        description="Short-lived access JWT (15 minutes). Send as `Authorization: Bearer <token>`. Hold in memory only — never localStorage.",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwIjoiYWNjZXNzIn0.example"],
    )
    token_type: str = Field("bearer", description="Always `bearer`.")