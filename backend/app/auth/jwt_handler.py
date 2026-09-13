"""
app/auth/jwt_handler.py

Password hashing, JWT creation, and the get_current_farmer dependency
used to protect any endpoint that requires a logged-in farmer.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db
from app.models.farmer import Farmer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl points Swagger's "Authorize" button at /auth/login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_farmer(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Farmer:
    """
    Drop `farmer: Farmer = Depends(get_current_farmer)` into any router's
    endpoint signature to require a valid JWT before that endpoint runs.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        farmer_id: str = payload.get("sub")
        if farmer_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    farmer = db.query(Farmer).filter(Farmer.id == int(farmer_id)).first()
    if farmer is None:
        raise credentials_exception
    return farmer
