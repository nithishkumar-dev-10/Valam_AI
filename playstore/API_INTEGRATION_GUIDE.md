# Valam AI — Mobile App API Integration Guide

For the Flutter (or any mobile) team building the Valam AI app. **This is the single
source of truth for the HTTP contract — you do not need to read the backend source.**
Every endpoint, error case, and field below is copied from the running FastAPI
service, not from documentation prose.

---

## 0. Base URL — READ THIS FIRST

```
DEV (now):       http://localhost:8000
PRODUCTION (soon): https://api.valam.in
```

- The cloud VM is **deferred**; for now you develop against `http://localhost:8000`
  (run the backend with `uvicorn app.main:app --port 8000` from `backend/`).
- **Do not hardcode ANY base URL into the app.** Use a Dart `--dart-define`
  (`API_BASE_URL`) or a build-time constant so the URL is swapped per environment
  without a code release.
- Emulator note: `localhost` inside an Android emulator is your machine — use
  `10.0.2.2:8000` for the Android emulator, `localhost` for iOS simulator/desktop.
- All endpoints are under **`/api/v1`**.

---

## 1. Conventions

- **Content type:** `application/json` for bodies; `multipart/form-data` for uploads
  (photos/audio). Auth login uses `application/x-www-form-urlencoded`.
- **Auth header:** `Authorization: Bearer <access_token>`.
- **Upload limits:** image ≤ **15 MB** (JPEG / PNG / WebP, verified by magic bytes),
  audio ≤ **15 MB** (MP3 / WAV / WebM / OGG / FLAC / M4A).
- **Rate limits (per IP):** auth endpoints 5/min, voice 10/min. Exceed → HTTP **429**.
- **Metrics:** the API has no analytics; all fields are plain, documented JSON.

---

## 2. Auth flow (the correct mobile pattern)

```
Signup  ──▶ Login ──▶ [AccessToken(7d)+ RefreshToken(28d)]
                              │
            Every API call ───┤  header: Authorization: Bearer <access>
                              │
              401 on any call ┘
                              ├─▶ call POST /auth/refresh with refresh_token
                              │        ├─ 200 → new pair, retry original call
                              │        └─ 401 → session over → show login
```

- **Store** `access_token` + `refresh_token` securely (encrypted storage / flutter_secure_storage).
- **Do NOT** re-login on every 401 — first try **one** silent refresh (there's a
  dedicated endpoint for exactly this).
- Access tokens expire in **7 days**, refresh in **28 days**.
- If `refresh` returns **401**, drop the user to login (tokens can't be recovered).

---

## 3. Endpoint reference

### 3.1 Health check
```
GET /api/v1/health        (no auth)
```
Used for liveness/uptime monitors. Usually 200:
```json
{"status": "ok", "service": "valam-ai-backend", "version": "1.0.0", "database": "ok"}
```

---

### 3.2 Create account  (optional — app works without login)
```
POST /api/v1/auth/signup      (JSON)
Content-Type: application/json
{
  "name": "Kumar",
  "phone_number": "9876543210",
  "password": "pass123A"
}
```
Constraints:
- `name`: 2–120 chars.
- `phone_number`: 10–15 chars, digits with optional `+91` prefix.
- `password`: 6–128 chars (bcrypt-hashed server-side, never returned by the API).

Success **201** → public profile (no token — you must then login):
```json
{
  "name": "Kumar",
  "phone_number": "9876543210",
  "id": 5,
  "created_at": "2026-09-13T15:04:05+00:00"
}
```
Errors:
- **400** — phone already registered: `{"detail": "An account with this phone number already exists."}`
- **422** — schema validation (see §4).
- **429** — too many signups from this IP.

---

### 3.3 Login
```
POST /api/v1/auth/login        (form-urlencoded — NOT JSON)
Content-Type: application/x-www-form-urlencoded
username=9876543210&password=pass123A
```
Note the OAuth2 convention: `username` holds the **phone number**.

Success **200**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```
Errors:
- **401** — bad phone/password: `{"detail": "Incorrect phone number or password"}`
- **429** — too many attempts (5/min/IP).

---

### 3.4 Refresh tokens (critical for mobile UX)
```
POST /api/v1/auth/refresh      (JSON)
{ "refresh_token": "eyJhbGciOiJIUzI1NiIs..." }
```
Success **200** → new access+refresh pair (same shape as login):
```json
{
  "access_token": "eyJ...new...",
  "refresh_token": "eyJ...new...",
  "token_type": "bearer"
}
```
Errors:
- **401** — invalid/expired refresh token, or you passed an *access* token (they're
  deliberately rejected). `{"detail": "Invalid refresh token"}` or the expiry message.
- **422** — missing `refresh_token` field.

**Mobile pattern:** wrap every authenticated call with an interceptor:
1. Request with current access token.
2. On **401** → call `/auth/refresh`.
3. If refresh **200** → swap tokens, retry the original request (once).
4. If refresh **401** → show login screen.

---

### 3.5 Current profile
```
GET /api/v1/auth/me        (Bearer access token required)
Authorization: Bearer <access_token>
```
Success **200**:
```json
{
  "name": "Kumar",
  "phone_number": "9876543210",
  "id": 5,
  "created_at": "2026-09-13T15:04:05+00:00"
}
```
Errors:
- **401** — no header / expired / wrong type. `detail` distinguishes:
  - `"Not authenticated"` → token header missing
  - `"Token has expired. Please refresh or log in again."` → expired access token
  - `"Could not validate credentials"` → invalid token

Also available:
```
DELETE /api/v1/auth/me      (Bearer access token required)
```
Deletes the account (required for Play Store "Delete my account"). Success **204**.
Errors: **401** (unauthenticated) or **500** (deletion failure).

---

### 3.6 Crop recommendation (from location)
```
POST /api/v1/predict/crop-simple      (JSON)
{ "latitude": 10.08, "longitude": 76.36 }
```
Constraints: latitude within India [6.0, 37.5], longitude [68.0, 97.5].
Success **200**:
```json
{
  "predicted_crop": "rice",
  "confidence": 0.9351,
  "confidence_label": "high",
  "soil_source": "regional_estimate",
  "weather_source": "OpenWeather + NASA POWER (annual avg rainfall)",
  "location": "Ernakulam",
  "warning": null,
  "data_resolution": "district",
  "input_confidence": "medium",
  "data_quality_note": null
}
```
Field meanings for the UI:
- `confidence` 0–1; display `confidence_label` **high (≥0.80) / medium (≥0.60) / low**.
- `input_confidence`/`data_quality_note` — show the note verbatim when present (it means
  "generic soil averages were used").
- `location` is display text (district or state).
Errors: **400** (no state found), **422** (coords out of range), **500** (generic).

---

### 3.7 Alternative crop input (manual soil values — usually hidden from UI)
```
POST /api/v1/predict/crop-manual      (JSON)
{
  "N": 38, "P": 25, "K": 28,
  "temperature": 27.5, "humidity": 65.0,
  "ph": 6.5, "rainfall": 280.0
}
```
Success **200** — same `CropOutput` shape (with `input_confidence: "high"`).
Errors: **422** (out-of-range values), **500**.

---

### 3.8 Disease / Deep-weed / Pest detection (photo upload)
```
POST /api/v1/predict/disease       (multipart/form-data)
POST /api/v1/predict/deep-weed
POST /api/v1/predict/pest
field name: file
```
All three are identical in contract, only the model differs:
- `disease` → 38 classes (e.g. `"Tomato___Leaf_Mold"`)
- `deep-weed` → 9 weed classes (e.g. `"Parthenium"`)
- `pest` → 9 pest classes

Success **200**:
```json
{
  "predicted_class": "Tomato___Leaf_Mold",
  "confidence": 0.9211
}
```
Errors:
- **413** — file > 15 MB
- **415** — not a real JPEG/PNG/WebP (magic bytes verified; renaming won't pass)
- **422** — empty/malformed form
- **500** — inference failure (generic body; details server-side)

---

### 3.9 Main assistant — multimodal voice query
```
POST /api/v1/voice/query      (multipart/form-data, ALL fields optional)
  audio:     <file>     spoken question (MP3/WAV/WebM/OGG/FLAC/M4A, ≤15MB)
  image:     <file>     field photo (JPEG/PNG/WebP, ≤15MB)
  latitude:  <number>   GPS latitude   (optional)
  longitude: <number>   GPS longitude  (optional)
  lang:      "ta"|"en"  force language (optional; omitted = auto-detect)
```
At least one of audio/image/latitude/longitude is required, else **400**.

Success **200**:
```json
{
  "intent": "disease_check",
  "transcribed_text": "my tomato leaf is turning yellow",
  "detected_language": "ta",
  "language_probability": 0.93,
  "text_response": "The leaf shows Tomato___Leaf_Mold (92% confidence).",
  "response_text": "The leaf shows Tomato___Leaf_Mold (92% confidence).",
  "audio_url": "http://localhost:8000/static/voice_responses/a1b2c3.mp3",
  "audio_response_path": "/static/voice_responses/a1b2c3.mp3",
  "results": [
    {
      "model": "disease",
      "predicted_crop": null,
      "predicted_class": "Tomato___Leaf_Mold",
      "confidence": 0.9211,
      "confidence_label": "high",
      "soil_source": null,
      "weather_source": null,
      "location": null,
      "warning": null,
      "data_resolution": null,
      "input_confidence": null,
      "data_quality_note": null
    }
  ],
  "crop_result": null,
  "disease_result": {"predicted_class": "Tomato___Leaf_Mold", "confidence": 0.9211},
  "pest_result": null
}
```
Client guidance:
- **`text_response` is the primary summary** — show it as the spoken/printed answer.
- `audio_url` is an absolute URL — feed it to an audio player to speak the answer.
- `results[]` is a homogeneous array — one entry per model that ran (`model`: `"crop"` |
  `"disease"` | `"pest"`). Render a card per entry. `crop_result`/`disease_result`/
  `pest_result` are typed convenience siblings (null when that model didn't run).
- `intent` tells you what was understood: `"crop_recommendation"` | `"disease_check"` |
  `"pest_check"` | `"unclear"`.
- `language_probability` is null when language is forced via `lang`.
- No auth required for this endpoint.

Errors:
- **400** — no inputs at all, or `lang` not in `["ta","en"]`
- **413** — upload too large
- **415** — wrong file type
- **429** — > 10 queries/min from an IP
- **500** — pipeline failure (generic)

---

## 4. Error response format (consistent everywhere)

- **422 — validation.** The one "structured" error:
```json
{
  "detail": "Invalid input.",
  "errors": [
    {"field": "phone_number", "message": "too short"},
    {"field": "password", "message": "too short"}
  ]
}
```
(on image/audio endpoints this is also returned for missing form fields.)

- **400 / 401** — simple string message:
```json
{"detail": "Incorrect phone number or password"}
```

- **413 / 415** — simple string message (see per-endpoint).

- **429 — rate limited.** Custom JSON handler (not slowapi's plain-text default):
```json
{"detail": "Too many requests. Please slow down and try again."}
```
Parse `detail` like every other error.

- **500 — server error.** Always generic, never leaks internals:
```json
{"detail": "Something went wrong. Please try again."}
```

Status-code summary you'll see:

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created (signup) |
| 400 | Bad input (semantic; e.g. duplicate phone, missing inputs) |
| 401 | Unauthenticated / expired / invalid token (check `WWW-Authenticate`) |
| 413 | Upload too large |
| 415 | Unsupported file type (magic bytes) |
| 422 | Schema/validation errors (structured body) |
| 429 | Rate limit (JSON: `{"detail": "Too many requests. Please slow down and try again."}`) |
| 500 | Internal error (generic body) |

---

## 5. Rate limits recap

| Endpoint | Limit |
|---|---|
| `/auth/signup`, `/auth/login`, `/auth/refresh` | 5 / minute per IP |
| `/voice/query` | 10 / minute per IP |
| `/predict/*` | 25 / minute per IP |

All rate limits are **per IP**, not per account. A single farmer on a shared NAT
(office Wi-Fi) could hit the voice cap; the client should queue/retry with
backoff on 429.

---

## 6. Production notes for the mobile team

1. **Base URL flip** — replace `http://localhost:8000` with `https://api.valam.in`
   via build config when the VM is live. Everything else stays identical.
2. **HTTPS** — TLS terminates at nginx; all traffic is HTTPS in production.
3. **CORS** — irrelevant to native apps (browser-only). Ignore CORS errors unless you
   build a web target.
4. **Upload retry** — 15 MB is the hard limit; validate on-device before upload to save
   data.
5. **Audio playing** — `audio_url` points at the API host. On production it will be
   `https://api.valam.in/static/...`; don't strip or prepend hosts.
6. **Versioning** — targeted as `/api/v1`. Breaking changes will ship as `/api/v2`,
   so pin your client to the versioned prefix.

---

## 7. Quick check — does your client satisfy the contract?

- [ ] Base URL from build config, not hardcoded
- [ ] `Authorization: Bearer` header set with access token
- [ ] Refresh-then-retry interceptor on 401 (not a forced re-login)
- [ ] Handles 429 as JSON `detail` (rate limit)
- [ ] Handles 422 as `detail` + `errors[]`
- [ ] Signed requests to `/predict/*` use `multipart/form-data` field `file`
- [ ] `/auth/login` sends `application/x-www-form-urlencoded` (`username` = phone)
- [ ] Voice screen sends `lang` absent for auto-detect, or `"ta"`/`"en"`
- [ ] On-device size/magic checks mirror the 15 MB + image/audio format rules