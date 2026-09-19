"""
app/routers/auth.py

POST /api/v1/auth/signup -- create a farmer account (rate-limited)
POST /api/v1/auth/login   -- returns access + refresh JWTs (rate-limited);
                            uses OAuth2PasswordRequestForm so Swagger's
                            "Authorize" button works directly (its "username"
                            field holds the phone number)
POST /api/v1/auth/refresh -- exchange a refresh token for a fresh pair
GET  /api/v1/auth/me      -- profile for a valid access token
DELETE /api/v1/auth/me    -- permanently delete the account (Play Store
                            account-deletion requirement)
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.farmer import FarmerSignup, FarmerOut, Token
from app.auth.jwt_handler import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    _decode_token,
    get_current_farmer,
)
from app.rate_limiter import limiter
from app.config import LOGIN_RATE_PER_MINUTE

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=FarmerOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a farmer account",
    description=(
        "Registers a new phone+password account and returns the public profile "
        "(**not** a token — call `/auth/login` next).\n\n"
        "Constraints: phone must be 10–15 digits, password ≥ 6 chars incl. letters+digits. "
        "A second signup for an existing phone returns `400`."
    ),
    responses={
        400: {"description": "Phone number already registered"},
        422: {"description": "Invalid input (short name/password, bad phone format)"},
        429: {"description": "Too many signups from this IP (5/minute)"},
    },
)
@limiter.limit(LOGIN_RATE_PER_MINUTE)
def signup(
    request: Request,
    payload: FarmerSignup,
    db: Session = Depends(get_db),
):
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


@router.post(
    "/login",
    response_model=Token,
    summary="Log in and get JWT pair",
    description=(
        "Accepts **OAuth2 password-form** (like Swagger's Authorize dialog): the "
        "`username` field is the phone number. Returns a short-lived access JWT "
        "(7 days) and a 28-day refresh JWT. Anonymous/voice features never need this."
    ),
    responses={
        401: {"description": "Incorrect phone number or password"},
        422: {"description": "Invalid input"},
        429: {"description": "Too many attempts from this IP (5/minute)"},
    },
)
@limiter.limit(LOGIN_RATE_PER_MINUTE)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Hard caps on the form fields to keep malformed brute-force attempts cheap
    # (values are also bounded by rate limiting, but cap the work per request).
    if len(form_data.username) > 20 or len(form_data.password) > 128:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    farmer = db.query(Farmer).filter(Farmer.phone_number == form_data.username).first()
    if not farmer or not verify_password(form_data.password, farmer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(farmer.id)})
    refresh_token = create_refresh_token(data={"sub": str(farmer.id)})
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/refresh",
    response_model=Token,
    summary="Rotate a refresh token",
    description=(
        "Exchanges a valid 28-day refresh JWT for a **fresh access+refresh pair**. "
        "Send `{\"refresh_token\": \"...\"}`. Use this on mobile when an API call "
        "returns `401` so users don't have to re-enter their password. "
        "Access tokens are rejected here (`401 Invalid refresh token`)."
    ),
    responses={
        401: {"description": "Refresh token missing/expired/wrong type"},
        422: {"description": "Invalid input"},
        429: {"description": "Too many attempts from this IP (5/minute)"},
    },
)
@limiter.limit(LOGIN_RATE_PER_MINUTE)
def refresh(
    request: Request,
    db: Session = Depends(get_db),
    refresh_token: str = Body(..., embed=True),
):
    """Exchange a valid refresh token for a fresh access+refresh pair.

    Stateless refresh (signed JWT, 28-day life) — simple and zero-storage, at
    the cost of not being able to revoke a stolen token before it expires.
    For <100 users that tradeoff is acceptable; move to a DB-backed allowlist
    if you ever need server-side revocation.
    """
    payload = _decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    farmer_id = payload.get("sub")
    if farmer_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    farmer = db.query(Farmer).filter(Farmer.id == int(farmer_id)).first()
    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    return Token(
        access_token=create_access_token(data={"sub": str(farmer.id)}),
        refresh_token=create_refresh_token(data={"sub": str(farmer.id)}),
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=FarmerOut,
    summary="Get my profile",
    description="Returns the logged-in farmer's public profile. Requires `Authorization: Bearer <access-token>`.",
    responses={
        401: {
            "description": (
                "Credential missing/expired/invalid. `detail` distinguishes "
                "`Not authenticated` (no token) from `Token has expired...` (refresh needed)."
            )
        },
    },
)
def read_me(farmer: Farmer = Depends(get_current_farmer)):
    """Return the logged-in farmer for a valid Bearer token.

    Demonstrates protecting a route with get_current_farmer. The core
    assistant feature (/voice/query) intentionally stays open; this is the
    optional authenticated surface the frontend uses to fetch the profile.
    """
    return farmer


@router.patch(
    "/me",
    response_model=FarmerOut,
    summary="Update my profile",
    description="Updates the logged-in farmer's display name. Requires `Authorization: Bearer <access-token>`.",
    responses={
        200: {"description": "Updated profile"},
        401: {"description": "Not authenticated / invalid token"},
        422: {"description": "Name too short"},
    },
)
def update_me(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
    name: str = Body(..., min_length=1, max_length=80, embed=True),
):
    """Rename the authenticated farmer.  Returns the updated profile."""
    farmer.name = name
    db.commit()
    db.refresh(farmer)
    return farmer


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete my account",
    description=(
        "Permanently deletes the logged-in farmer's account (name, phone, "
        "password hash). Requires `Authorization: Bearer <access-token>`. "
        "Required by the Google Play account-deletion policy — the farmer "
        "must be able to delete their data in-app, not just by email.\n\n"
        "Note: voice queries are anonymous (no account linkage), so no "
        "associated voice/photo data is deleted alongside — that data is "
        "auto-purged by the retention sweep (see privacy policy §5)."
    ),
    responses={
        204: {"description": "Account deleted"},
        401: {"description": "Not authenticated / invalid token"},
    },
)
def delete_me(
    farmer: Farmer = Depends(get_current_farmer),
    db: Session = Depends(get_db),
):
    """Delete the authenticated farmer row. 204 with no body."""
    db.delete(farmer)
    db.commit()