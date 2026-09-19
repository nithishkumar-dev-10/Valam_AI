"""Shared pytest fixtures for the backend test suite.

Env vars are set BEFORE any `app.*` import so app.config reads the right
values (SECRET_KEY is validated at import; DATABASE_URL drives a throwaway
SQLite file instead of the repo's live backend/valam.db).
"""

import os
import pathlib
import tempfile

_TMP = pathlib.Path(tempfile.mkdtemp(prefix="valam_pytest_"))

os.environ["SECRET_KEY"] = "a" * 64
os.environ["ADMIN_ACCESS_KEY"] = "testadminkey123"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'valam_test.db'}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    """A TestClient bound to the real FastAPI app (lifespan runs on enter/exit)."""
    from app.main import app

    with TestClient(app) as c:
        yield c