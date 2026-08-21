"""
app/schemas/farmer.py

Pydantic schemas for signup/login request and response shapes.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class FarmerSignup(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    phone_number: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=6)


class FarmerLogin(BaseModel):
    phone_number: str
    password: str


class FarmerOut(BaseModel):
    id: int
    name: str
    phone_number: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
