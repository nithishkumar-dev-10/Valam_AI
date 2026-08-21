"""
app/routers/auth.py

POST /auth/signup -- create a farmer account
POST /auth/login   -- returns a JWT (uses OAuth2PasswordRequestForm so
                       Swagger's built-in "Authorize" button works directly;
                       its "username" field is used to hold the phone number)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.farmer import FarmerSignup, FarmerOut, Token
from app.auth.jwt_handler import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=FarmerOut, status_code=status.HTTP_201_CREATED)
def signup(payload: FarmerSignup, db: Session = Depends(get_db)):
    existing = db.query(Farmer).filter(Farmer.phone_number == payload.phone_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this phone number already exists.")

    farmer = Farmer(
        name=payload.name,
        phone_number=payload.phone_number,
        hashed_password=hash_password(payload.password),
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter(Farmer.phone_number == form_data.username).first()
    if not farmer or not verify_password(form_data.password, farmer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(farmer.id)})
    return Token(access_token=access_token, token_type="bearer")
