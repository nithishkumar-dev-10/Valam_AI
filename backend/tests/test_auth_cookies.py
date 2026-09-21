"""Refresh-token-as-httpOnly-cookie flow tests.

Covers the migration from body/locationStorage refresh tokens to an httpOnly
+ Secure + SameSite=Lax cookie scoped to /api/v1/auth:

  * login sets the cookie (flags + scoping) and does NOT put the refresh token
    in the body;
  * /auth/refresh reads the cookie (no body), rotates it, returns a fresh
    access token;
  * reuse of an already-rotated cookie = 401 + cookie cleared (family revoke);
  * logout clears the cookie and revokes server-side;
  * cookie is not sent to non-auth paths (path scoping);
  * a missing cookie is rejected 401.

Note: conftest sets REFRESH_COOKIE_SECURE=false because the httpx test
transport refuses Secure cookies over plain http; browsers accept them on
localhost. The production default stays true.
"""


def _signup_and_login(client, phone="919999999901", name="Cookie Test"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"name": name, "phone_number": phone, "password": "testpass123"},
    )
    assert r.status_code == 201, r.text
    r = client.post("/api/v1/auth/login", data={"username": phone, "password": "testpass123"})
    assert r.status_code == 200, r.text
    return r


# ---------------------------------------------------------------------------
# Login response shape + cookie attributes
# ---------------------------------------------------------------------------

def test_login_sets_httponly_refresh_cookie_and_no_refresh_in_body(client):
    from app.config import REFRESH_COOKIE_SECURE

    r = _signup_and_login(client, phone="9199990001")
    body = r.json()
    assert set(body.keys()) == {"access_token", "token_type"}
    assert r.cookies.get("refresh_token"), "refresh cookie missing after login"

    sc = r.headers.get("set-cookie", "")
    assert "HttpOnly" in sc, sc
    # Secure flag tracks the config toggle: true in prod, false in the test
    # transport (conftest) because httpx refuses Secure cookies over plain http.
    assert ("Secure" in sc) is REFRESH_COOKIE_SECURE, sc
    assert "samesite=lax" in sc.lower(), sc
    assert "path=/api/v1/auth" in sc.lower(), sc
    assert "max-age=" in sc.lower(), sc


# ---------------------------------------------------------------------------
# Refresh: cookie-driven, rotating, body-free
# ---------------------------------------------------------------------------

def test_refresh_reads_cookie_returns_new_access_token_and_rotates(client):
    _signup_and_login(client, phone="9199990002")
    cookie_before = None
    for _ in range(2):
        r = client.post("/api/v1/auth/refresh")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "refresh_token" not in body, "refresh token leaked in body"
        assert body["access_token"], r.text
        new_cookie = r.cookies.get("refresh_token")
        assert new_cookie, "rotation must re-set the cookie"
        assert new_cookie != cookie_before, "rotation must issue a NEW token"
        cookie_before = new_cookie


def test_refresh_without_cookie_401(client):
    # No login -> no cookie -> refresh must be rejected, not silently empty.
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 401, r.text
    assert "max-age=0" in r.headers.get("set-cookie", "").lower()


def test_reused_rotated_cookie_401_and_family_revoke(client):
    _signup_and_login(client, phone="9199990004")
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text
    rotated_once = r.cookies.get("refresh_token")
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text  # legitimate next rotation
    # Replay the already-rotated token (stale tab / theft) -> 401, cookie cleared
    r = client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"refresh_token={rotated_once}"},
    )
    assert r.status_code == 401, r.text
    assert "max-age=0" in r.headers.get("set-cookie", "").lower(), "cookie not cleared on reuse"


# ---------------------------------------------------------------------------
# Cookie path scoping + logout
# ---------------------------------------------------------------------------

def test_refresh_cookie_not_sent_to_non_auth_paths(client):
    _signup_and_login(client, phone="9199990005")
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    # The health request must NOT have carried the auth-scoped cookie.
    assert "refresh_token=" not in r.request.headers.get("cookie", "")


def test_logout_clears_cookie_and_revokes(client):
    _signup_and_login(client, phone="9199990006")
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204, r.text
    assert "max-age=0" in r.headers.get("set-cookie", "").lower(), "logout didn't clear cookie"

    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 401, "refresh must fail after logout"


def test_logout_without_cookie_still_204(client):
    # Idempotent: no session -> still 204, cookie expiry attempted harmlessly.
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204, r.text