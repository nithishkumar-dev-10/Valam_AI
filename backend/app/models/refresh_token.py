"""
app/models/refresh_token.py

Server-side store for refresh tokens so they can be ROTATED and REVOKED,
instead of the previous stateless 28-day JWT that could never be cancelled:

  * login            -> a row is created (jti + SHA-256 hash of the token)
  * /auth/refresh    -> validates against the row, then ROTATES: old row is
                        revoked and a fresh pair is issued. If an already-rotated
                        token is presented again, that is REFRESH-TOKEN REUSE:
                        every refresh token for the farmer is revoked.
  * /auth/logout     -> the presented refresh token is revoked immediately.
  * DELETE /auth/me  -> every refresh token for the account is revoked.

Only a SHA-256 hash of the raw JWT is stored, never the token itself, so a
database dump does not leak usable refresh tokens.
"""

from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func

from app.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, nullable=False, index=True)
    # "jti" (JWT ID) of the raw token; unique so a lookup is a single indexed hit.
    jti = Column(String(64), unique=True, index=True, nullable=False)
    # SHA-256 hex digest of the raw token (never the token itself).
    token_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Set when the token is rotated (replaced) or explicitly revoked (logout).
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    # jti of the token that replaced this one — set on rotation, used for
    # reuse detection (a rotated token presented again marks a theft).
    replaced_by_jti = Column(String(64), nullable=True)

    __table_args__ = (Index("ix_refresh_tokens_farmer_active", "farmer_id", "revoked_at"),)