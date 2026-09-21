"""Converted pytest suite for the production-readiness audit checks that used
to live in tests/manual_tests/ (audit_bomb_test.py + audit_verify.py).

Run from backend/:  venv/bin/pytest tests/ -v
"""

import io

import numpy as np
from PIL import Image


def _tiny_png(size: int = 20) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.zeros((size, size, 3), dtype=np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


def _api_paths(client) -> set[str]:
    """The API surface clients can actually hit. Starlette 1.x represents
    included routers as opaque _IncludedRouter objects (no public '.path'
    on them), so introspecting app.routes directly is brittle — the OpenAPI
    schema is the canonical, prefix-resolved public contract instead."""
    return set(client.app.openapi()["paths"].keys())


# ---------------------------------------------------------------------------
# Route inventory
# ---------------------------------------------------------------------------

def test_pest_route_canonicalized(client):
    paths = _api_paths(client)
    assert "/api/v1/predict/pest" in paths
    assert "/api/v1/pest/predict" not in paths


def test_account_deletion_route_present(client):
    assert "/api/v1/auth/me" in _api_paths(client)


def test_health_on_boot(client):
    assert client.get("/api/v1/health").status_code == 200


# ---------------------------------------------------------------------------
# Decompression-bomb guard (MAX_IMAGE_PIXELS) — converted audit_bomb_test.py
# ---------------------------------------------------------------------------

def test_bomb_guard_rejects_oversized_image(client, monkeypatch):
    import app.validation as validation

    monkeypatch.setattr(validation, "MAX_IMAGE_PIXELS", 100)  # 20x20 = 400 px > 100
    png = _tiny_png(20)
    r = client.post("/api/v1/predict/disease", files={"file": ("leaf.png", png, "image/png")})
    assert r.status_code == 415, r.text


def test_bomb_guard_via_voice(client, monkeypatch):
    import app.validation as validation

    monkeypatch.setattr(validation, "MAX_IMAGE_PIXELS", 100)
    png = _tiny_png(20)
    r = client.post(
        "/api/v1/voice/query",
        files={"image": ("leaf.png", png, "image/png")},
        data={},
    )
    assert r.status_code == 415, r.text


# ---------------------------------------------------------------------------
# Voice GPS bounds (same ranges as /predict/crop-simple: lat 6-37.5, lon 68-97.5)
# ---------------------------------------------------------------------------

def test_voice_rejects_out_of_range_latitude(client):
    r = client.post("/api/v1/voice/query", data={"latitude": 60.0, "longitude": 80.0})
    assert r.status_code == 400, r.text
    assert "latitude" in r.json()["detail"]


def test_voice_rejects_out_of_range_longitude(client):
    r = client.post("/api/v1/voice/query", data={"latitude": 13.0, "longitude": 150.0})
    assert r.status_code == 400, r.text
    assert "longitude" in r.json()["detail"]


def test_voice_accepts_in_range_coords(client):
    # In-range coords pass the bounds check and are enough for the crop model
    # to run on its own -> 200 with a crop recommendation (not a bounds 400).
    r = client.post("/api/v1/voice/query", data={"latitude": 12.9, "longitude": 80.1})
    assert r.status_code == 200, r.text
    assert r.json()["crop_result"] is not None


# ---------------------------------------------------------------------------
# Auth lifecycle + in-app account deletion — converted audit_verify.py
# ---------------------------------------------------------------------------

def test_auth_lifecycle_and_inapp_deletion(client):
    phone = "9999999991"
    r = client.post(
        "/api/v1/auth/signup",
        json={"name": "Audit User", "phone_number": phone, "password": "testpass123"},
    )
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/auth/login", data={"username": phone, "password": "testpass123"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text

    r = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204, r.text

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, r.text


def test_delete_account_requires_auth(client):
    r = client.delete("/api/v1/auth/me")
    assert r.status_code in (401, 422), r.text


def test_rename_profile_patch_me(client):
    phone = "9999999992"
    r = client.post(
        "/api/v1/auth/signup",
        json={"name": "Old Name", "phone_number": phone, "password": "testpass123"},
    )
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/auth/login", data={"username": phone, "password": "testpass123"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.patch("/api/v1/auth/me", json={"name": "New Name"}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "New Name"
    assert r.json()["phone_number"] == phone

    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "New Name"


def test_rename_profile_requires_valid_name(client):
    phone = "9999999993"
    r = client.post(
        "/api/v1/auth/signup",
        json={"name": "Nameless", "phone_number": phone, "password": "testpass123"},
    )
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/auth/login", data={"username": phone, "password": "testpass123"})
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.patch("/api/v1/auth/me", json={"name": ""}, headers=headers)
    assert r.status_code == 422, r.text

    r = client.patch("/api/v1/auth/me", json={"name": "No token"})
    assert r.status_code in (401, 422), r.text


# ---------------------------------------------------------------------------
# Admin constant-time gate — converted audit_verify.py
# ---------------------------------------------------------------------------

def test_admin_wrong_key_forbidden(client):
    r = client.get("/api/v1/admin/logs", headers={"X-Admin-Key": "wrong-key"})
    assert r.status_code == 403, r.text


def test_admin_right_key_ok(client):
    r = client.get(
        "/api/v1/admin/logs",
        headers={"X-Admin-Key": "testadminkey12345678901234567890abcdef"},
    )
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# Soil lookup caching — converted audit_verify.py
# ---------------------------------------------------------------------------

def test_soil_lookup_cache_idempotent():
    from app.services.external.soil_lookup import get_regional_soil_values

    r1 = get_regional_soil_values("Tamil Nadu", "Vellore")
    r2 = get_regional_soil_values("Tamil Nadu", "Vellore")
    assert r1 == r2
    assert r1.get("data_resolution") in ("district", "state", "fallback")


# ---------------------------------------------------------------------------
# 429 shape + headers (rate_limit_exceeded_handler in app/main.py)
# Voice is limited to 10/min per IP; hammering past it must yield the JSON
# error convention, not slowapi's plain-text default.
# ---------------------------------------------------------------------------

def test_rate_limit_returns_json_429_with_retry_after(client):
    limit_response = None
    for _ in range(11):
        limit_response = client.post("/api/v1/voice/query", data={})
    assert limit_response.status_code == 429, limit_response.text
    assert limit_response.json()["detail"] == "Too many requests. Please slow down and try again."
    assert int(limit_response.headers["Retry-After"]) >= 1
    assert int(limit_response.headers["X-RateLimit-Limit"]) >= 1