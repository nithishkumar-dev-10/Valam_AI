"""One-off production-readiness audit verification. Run: python audit_verify.py
Creates a throwaway SQLite DB, boots the app, and asserts every fix."""

import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

os.environ["SECRET_KEY"] = "a" * 64
os.environ["ADMIN_ACCESS_KEY"] = "testadminkey123"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
TEST_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "valam_audit_test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

FAILURES = []


def check(name, cond, extra=""):
    if cond:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name}  {extra}")
        FAILURES.append(name)


def main():
    with TestClient(app) as client:
        api_paths = sorted(
            r.path for r in app.routes if getattr(r, "path", "").startswith("/api")
        )
        print("api paths:", api_paths)
        check(
            "pest route canonicalized",
            "/api/v1/predict/pest" in api_paths and "/api/v1/pest/predict" not in api_paths,
        )
        check(
            "account-deletion route present",
            "/api/v1/auth/me" in [p for p in api_paths if p.endswith("/me")],
        )

        r = client.get("/api/v1/health")
        check("health on boot", r.status_code == 200, r.text[:120])

        # --- auth lifecycle + in-app account deletion ---
        phone = "9999999991"
        r = client.post(
            "/api/v1/auth/signup",
            json={"name": "Audit User", "phone_number": phone, "password": "testpass123"},
        )
        check("signup 201", r.status_code == 201, r.text[:200])
        r = client.post(
            "/api/v1/auth/login", data={"username": phone, "password": "testpass123"}
        )
        check("login 200", r.status_code == 200, r.text[:200])
        token = r.json()["access_token"]
        r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("me 200", r.status_code == 200, r.text[:120])
        r = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("delete me 204", r.status_code == 204, r.text[:120])
        r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        check("me 401 after deletion", r.status_code == 401, r.text[:120])
        r = client.delete("/api/v1/auth/me")
        check("delete w/o auth 401", r.status_code in (401, 422), r.text[:120])

        # --- admin constant-time gate ---
        r = client.get("/api/v1/admin/logs", headers={"X-Admin-Key": "wrong-key"})
        check("admin wrong key 403", r.status_code == 403, r.text[:120])
        r = client.get("/api/v1/admin/logs", headers={"X-Admin-Key": "testadminkey123"})
        check("admin right key 200", r.status_code == 200, r.text[:120])

        # --- temp_uploads orphan purge on startup ---
        from app.config import TEMP_UPLOAD_DIR
        orphan = TEMP_UPLOAD_DIR / "orphan_audit.bin"
        orphan.write_bytes(b"x" * 10)
        check("orphan exists pre-purge", orphan.exists())
        # purge happened in lifespan before we added the file; trigger restart
        client.__exit__(None, None, None)
        client.__enter__()
        check("orphan purged on restart", not orphan.exists())
        client.__exit__(None, None, None)

    # --- soil lookup caching still returns correct values (twice, same result) ---
    from app.services.external.soil_lookup import get_regional_soil_values
    r1 = get_regional_soil_values("Tamil Nadu", "Vellore")
    r2 = get_regional_soil_values("Tamil Nadu", "Vellore")
    check("soil cache idempotent", r1 == r2 and r1.get("data_resolution") in ("district", "state", "fallback"), str(r1)[:160])

    print()
    if FAILURES:
        print(f"=== {len(FAILURES)} FAILURES: {FAILURES}")
        sys.exit(1)
    print("=== ALL AUDIT CHECKS PASSED ===")


if __name__ == "__main__":
    try:
        main()
    finally:
        for suffix in ("", "-wal", "-shm"):
            p = TEST_DB + suffix
            if os.path.exists(p):
                os.remove(p)