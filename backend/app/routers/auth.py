"""
app/routers/auth.py

POST /api/v1/auth/signup   -- create a farmer account (rate-limited)
POST /api/v1/auth/login    -- returns the access JWT in the body AND sets the
                              rotating refresh JWT as an httpOnly cookie
                              (rate-limited); uses OAuth2PasswordRequestForm so
                              Swagger's "Authorize" button works directly (its
                              "username" field holds the phone number)
POST /api/v1/auth/refresh  -- ROTATES the refresh token (old one revoked
                              server-side) for a fresh access token + a fresh
                              httpOnly cookie; reads the cookie, never the body
POST /api/v1/auth/logout   -- revokes the refresh token immediately and clears
                              the cookie
GET  /api/v1/auth/me       -- profile for a valid access token
PATCH /api/v1/auth/me      -- rename the authenticated farmer
DELETE /api/v1/auth/me     -- permanently delete the account (Play Store
                              account-deletion requirement); also revokes all
                              refresh tokens for the account

Cookie strategy: the refresh token is an httpOnly + Secure + SameSite=Lax
cookie scoped to path=/api/v1/auth — XSS-injected JS can never read it, and it
is only ever sent to the auth endpoints that need it. The access token stays in
the JSON body + browser memory (never localStorage, never a cookie).
"""

import time
from collections import defaultdict

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.farmer import Farmer
from app.schemas.farmer import FarmerSignup, FarmerOut, Token
from app.auth.jwt_handler import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_farmer,
)
from app.auth.refresh_store import (
    issue_refresh_token,
    rotate_refresh_token,
    revoke_all_for_farmer,
    revoke_token,
)
from app.rate_limiter import limiter
from app.config import (
    LOGIN_RATE_PER_MINUTE,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    REFRESH_COOKIE_SECURE,
    REFRESH_COOKIE_SAMESITE,
    REFRESH_TOKEN_EXPIRE_MINUTES,
)

REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_EXPIRE_MINUTES * 60


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Attach the (rotating) refresh token to the response as an httpOnly,
    SameSite=Lax cookie scoped to the auth endpoints."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        path=REFRESH_COOKIE_PATH,
        secure=REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=REFRESH_COOKIE_SAMESITE,
    )


def _clear_cookie_header() -> str:
    """HTTPException-compatible `Set-Cookie` that expires the refresh cookie.

    Used on error paths (missing/reused/expired token) where an exception
    replaces the response under construction, so cookies set on the injected
    `response` object would be lost.
    """
    flags = [f"{REFRESH_COOKIE_NAME}=", "Max-Age=0", f"Path={REFRESH_COOKIE_PATH}", "HttpOnly"]
    if REFRESH_COOKIE_SECURE:
        flags.append("Secure")
    flags.append(f"SameSite={REFRESH_COOKIE_SAMESITE}")
    return "; ".join(flags)


def _clear_refresh_cookie(response: Response) -> None:
    """Expire the refresh cookie immediately (logout, or a failed rotation)."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value="",
        max_age=0,
        path=REFRESH_COOKIE_PATH,
        secure=REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=REFRESH_COOKIE_SAMESITE,
    )

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Per-account (phone) brute-force guard — in-process sliding window, keyed by
# normalized phone number. On top of the per-IP slowapi limits so an attacker
# rotating source IPs still cannot hammer a single phone number.
#    5 failed attempts / 15 min  -> temporary lockout (HTTP 429)
#    a success resets the counter
# ---------------------------------------------------------------------------
_ACCOUNT_WINDOW_SECONDS = 15 * 60
_ACCOUNT_MAX_FAILURES = 5

_failures: dict[str, list[float]] = defaultdict(list)


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit())


def _account_attempt_allowed(phone: str) -> bool:
    key = _normalize_phone(phone)
    if not key:
        return True
    now = time.monotonic()
    recent = [t for t in _failures[key] if now - t < _ACCOUNT_WINDOW_SECONDS]
    _failures[key] = recent
    return len(recent) < _ACCOUNT_MAX_FAILURES


def _record_failed_attempt(phone: str) -> None:
    key = _normalize_phone(phone)
    if key:
        _failures[key].append(time.monotonic())


def _record_success(phone: str) -> None:
    _failures.pop(_normalize_phone(phone), None)


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
    summary="Log in and get an access token (+ refresh cookie)",
    description=(
        "Accepts **OAuth2 password-form** (like Swagger's Authorize dialog): the "
        "`username` field is the phone number. Returns a short-lived access JWT "
        "(15 min) in the body and sets the rotating refresh token as an "
        "**httpOnly cookie** (path=/api/v1/auth) — the browser must send "
        "`credentials` on cross-origin requests for the cookie to be stored.\n\n"
        "Anonymous/voice features never need this."
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
    response: Response,
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

    # Per-account (phone) brute-force guard on top of the per-IP limit, so an
    # attacker rotating IPs still gets throttled against one target account.
    if not _account_attempt_allowed(form_data.username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts for this account. Please try again later.",
        )

    farmer = db.query(Farmer).filter(Farmer.phone_number == form_data.username).first()
    if not farmer or not verify_password(form_data.password, farmer.hashed_password):
        _record_failed_attempt(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _record_success(form_data.username)
    access_token = create_access_token(data={"sub": str(farmer.id)})
    refresh_token = issue_refresh_token(db, farmer.id)
    db.commit()
    _set_refresh_cookie(response, refresh_token)
    return Token(
        access_token=access_token,
        token_type="bearer",
    )


@router.post(
    "/refresh",
    response_model=Token,
    summary="Rotate a refresh token (via httpOnly cookie)",
    description=(
        "Rotates the refresh token the browser carries in the **httpOnly "
        "cookie** (path=/api/v1/auth) and returns a **fresh access token** in "
        "the body, re-setting the cookie with the rotated token. No request "
        "body is needed — leave it empty. If the cookie is missing or the "
        "token is invalid/expired, `401` and the cookie is cleared.\n\n"
        "Rotation means the presented token is revoked server-side and replaced; "
        "reuse of an already-rotated token is treated as theft and revokes all "
        "refresh tokens for the account. Access tokens are rejected here "
        "(`401 Invalid refresh token`)."
    ),
    responses={
        401: {"description": "Refresh cookie missing/invalid/expired"},
        429: {"description": "Too many attempts from this IP (5/minute)"},
    },
)
@limiter.limit(LOGIN_RATE_PER_MINUTE)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Rotate the cookie-borne refresh token into a fresh access token + cookie.

    DB-backed (app/auth/refresh_store.py): every login creates a row; every
    refresh revokes the old row and issues a new one; replaying an already
    rotated token revokes the whole family. This gives server-side revocation
    (logout, account deletion) and limits a stolen token's lifetime to one
    rotation instead of the full 28-day window.
    """
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"Set-Cookie": _clear_cookie_header()},
        )

    try:
        pair = rotate_refresh_token(db, raw_token)
    except HTTPException:
        # Bad/expired/replayed token: drop the dead cookie so the browser
        # doesn't keep re-sending it on every page load.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"Set-Cookie": _clear_cookie_header()},
        ) from None

    _set_refresh_cookie(response, pair["refresh_token"])
    return Token(
        access_token=pair["access_token"],
        token_type="bearer",
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out (revoke refresh token + clear cookie)",
    description=(
        "Revokes the refresh token server-side (it can never be used again, "
        "even if stolen) and clears the httpOnly cookie. Reading it from the "
        "cookie, so no body is needed. Missing/invalid/expired cookie is "
        "ignored (still 204). The access token lingers only until its ~15-min "
        "expiry, which is fine — access tokens never give out a refresh token."
    ),
    responses={
        204: {"description": "Logged out (refresh token revoked, cookie cleared)"},
        429: {"description": "Too many attempts from this IP (5/minute)"},
    },
)
@limiter.limit(LOGIN_RATE_PER_MINUTE)
def logout(
    request: Request,
    db: Session = Depends(get_db),
):
    revoke_token(db, request.cookies.get(REFRESH_COOKIE_NAME, ""))
    # Build the 204 ourselves and clear the cookie on THAT response — a handler
    # that returns a Response object ignores cookies set on the injected one.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


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
    """Delete the authenticated farmer row AND all of its refresh tokens so no
    lingering session can be refreshed after account deletion. 204, no body."""
    revoke_all_for_farmer(db, farmer.id)
    db.delete(farmer)
    db.commit()