"""Shared pytest fixtures for the backend test suite.

Env vars are set BEFORE any `app.*` import so app.config reads the right
values (SECRET_KEY is validated at import; DATABASE_URL drives a throwaway
SQLite file instead of the repo's live backend/db/valam.db).
"""

import os
import pathlib
import tempfile

_TMP = pathlib.Path(tempfile.mkdtemp(prefix="valam_pytest_"))

os.environ["SECRET_KEY"] = "a" * 64
os.environ["ADMIN_ACCESS_KEY"] = "testadminkey12345678901234567890abcdef"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'valam_test.db'}"
# httpx/TestClient runs over plain http://testserver and (unlike browsers, which
# treat localhost as a secure context) refuses to store/send Secure cookies over
# http. Non-TLS test transport == the documented REFRESH_COOKIE_SECURE=false
# scenario; production keeps the default (secure=True).
os.environ["REFRESH_COOKIE_SECURE"] = "false"
# slowapi's limiter is a process-global in-memory singleton shared by every
# TestClient incarnation, so auth requests from many tests bleed into one
# sliding window. Raise the auth budget for tests (the voice 10/min limit stays
# untouched — test_rate_limit_returns_json_429_with_retry_after hammers it).
os.environ["LOGIN_RATE_PER_MINUTE"] = "100/minute"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    """A TestClient bound to the real FastAPI app (lifespan runs on enter/exit)."""
    from app.main import app

    with TestClient(app) as c:
        yield c