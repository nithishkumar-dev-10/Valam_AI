"""
app/auth/refresh_store.py

DB-backed storage + rotation logic for refresh tokens. See
app/models/refresh_token.py for the schema and the security model.

All entry points raise HTTP 401 (never leaking whether a token was invalid,
expired, revoked, or a stolen-token replay — same message everywhere).
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.jwt_handler import _decode_token, create_access_token, create_refresh_token
from app.config import REFRESH_TOKEN_EXPIRE_MINUTES
from app.models.refresh_token import RefreshToken

_UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid refresh token",
)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cleanup_expired(db: Session, farmer_id: int) -> None:
    """Best-effort: drop long-expired rows so the table does not grow forever."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=REFRESH_TOKEN_EXPIRE_MINUTES // 1440 + 1)
    db.query(RefreshToken).filter(
        RefreshToken.farmer_id == farmer_id,
        RefreshToken.expires_at < cutoff,
    ).delete(synchronize_session=False)


def _issue(db: Session, farmer_id: int) -> tuple[str, str]:
    """Persist a new refresh-token row, return (raw_jwt, jti)."""
    _cleanup_expired(db, farmer_id)
    jti = uuid.uuid4().hex
    raw = create_refresh_token(data={"sub": str(farmer_id), "jti": jti})
    db.add(
        RefreshToken(
            farmer_id=farmer_id,
            jti=jti,
            token_hash=_hash(raw),
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES),
        )
    )
    return raw, jti


def issue_refresh_token(db: Session, farmer_id: int) -> str:
    """Create a new refresh token for the farmer and persist its hash so it can
    later be rotated/revoked. Returns the raw JWT (handed to the client once)."""
    raw, _ = _issue(db, farmer_id)
    return raw


def _load(db: Session, jti: str) -> RefreshToken | None:
    return db.query(RefreshToken).filter(RefreshToken.jti == jti).first()


def _revoke_row(db: Session, row: RefreshToken, replaced_by_jti: str | None = None) -> None:
    row.revoked_at = datetime.now(timezone.utc)
    if replaced_by_jti is not None:
        row.replaced_by_jti = replaced_by_jti


def _revoke_all_for_farmer(db: Session, farmer_id: int) -> None:
    now = datetime.now(timezone.utc)
    rows = (
        db.query(RefreshToken)
        .filter(RefreshToken.farmer_id == farmer_id, RefreshToken.revoked_at.is_(None))
        .all()
    )
    for row in rows:
        row.revoked_at = now


def revoke_all_for_farmer(db: Session, farmer_id: int) -> None:
    """Revoke every outstanding refresh token for the account (logout-all,
    account deletion, password change...)."""
    _revoke_all_for_farmer(db, farmer_id)
    db.commit()


def revoke_token(db: Session, raw_token: str) -> None:
    """Revoke a single refresh token (logout). Idempotent, never raises."""
    try:
        payload = _decode_token(raw_token)
    except HTTPException:
        return
    jti = payload.get("jti")
    if not jti:
        return
    row = _load(db, jti)
    if row is not None and row.revoked_at is None:
        _revoke_row(db, row)
        db.commit()


def rotate_refresh_token(db: Session, raw_token: str) -> dict:
    """Validate a refresh token and ROTATE it:

    - invalid/expired/wrong-type                       -> 401
    - row missing / already passed expiry              -> 401
    - token reused after being rotated (theft replay)  -> revoke ALL of the
      farmer's refresh tokens, then 401
    - otherwise: revoke this row, mint a fresh pair    -> {access, refresh}

    Returns {"access_token": ..., "refresh_token": ...} for the Token schema.
    """
    payload = _decode_token(raw_token)
    if payload.get("type") != "refresh":
        raise _UNAUTH

    jti = payload.get("jti")
    farmer_id = payload.get("sub")
    if not jti or farmer_id is None:
        raise _UNAUTH

    row = _load(db, jti)
    if row is None:
        raise _UNAUTH

    # Hard expiry (defense in depth — the row should also expire, but a clock
    # mismatch on the signing side must not be able to extend a token).
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    if row.expires_at.replace(tzinfo=None) < now_naive:
        _revoke_row(db, row)
        db.commit()
        raise _UNAUTH

    if row.revoked_at is not None:
        # If a rotated/replaced token shows up again, someone is replaying a
        # stolen token (or an attacker rotated it ahead of the legitimate
        # user). Kill the entire family so the theft cannot persist.
        if row.replaced_by_jti is not None:
            _revoke_all_for_farmer(db, row.farmer_id)
            db.commit()
        raise _UNAUTH

    new_refresh, new_jti = _issue(db, row.farmer_id)
    _revoke_row(db, row, replaced_by_jti=new_jti)
    db.commit()

    return {
        "access_token": create_access_token(data={"sub": str(row.farmer_id)}),
        "refresh_token": new_refresh,
    }