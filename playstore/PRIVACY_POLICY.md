# Valam AI — Privacy Policy (source)

**Last updated:** September 2026

> This is the markdown source. The ready-to-host file is `playstore/privacy.html`
> (upload that as your live privacy page — it is self-contained). Every claim
> below is grounded in the actual implementation in `backend/app/` and
> `frontend/src/`, not generic boilerplate. See "Code references" inline.

---

## Who we are

Valam AI ("we", "our", "us") is a voice-first agricultural assistant for Indian
farmers, delivered as an Android app (package `in.valam.app`) and an optional web
app at `https://app.valam.in`. This policy explains what we collect, why, how long
we keep it, who we share it with, and how you can delete it.

Contact: **privacy@valam.in**

---

## 1. What we collect

### 1.1 Account information — **stored**
* **Name, phone number, password (bcrypt-hashed)** — collected only when a user
  voluntarily signs up (`POST /api/v1/auth/signup`, `app/routers/auth.py`).
* Phone number is the login identifier (`app/models/farmer.py`), stored in
  plaintext (it is the username). The password is **never stored in plaintext** —
  it is hashed with bcrypt (`app/auth/jwt_handler.py`).
* Accounts are **optional**: every feature works without logging in (the voice
  query endpoint is intentionally anonymous).

### 1.2 Voice recordings — **temporarily processed, then deleted**
* Audio notes are uploaded to `POST /api/v1/voice/query` (`app/routers/voice.py`).
* The audio bytes are written to a temporary file (`app/temp_uploads/`), passed to
  **local Whisper ASR** (`app/services/dl/voice_service.py`), and **deleted in a
  `finally` block immediately after transcription.** Nothing about the audio is
  persisted. Orphaned temp files are purged at startup as well (`app/main.py`).
* **Whisper runs locally on our servers.** It performs inference on our machines
  and does **not** send your audio to OpenAI or any other party.
* Android requests the **microphone** permission to record these notes.

### 1.3 Photos — **not stored**
* Field/plant photos are uploaded to `/api/v1/voice/query`, `/api/v1/predict/disease`,
  `/api/v1/predict/deep-weed`, or `/api/v1/predict/pest`.
* Bytes are held **in memory only** (`image_bytes`), fed to local PyTorch CNNs, and
  never written to disk.
* Photos are chosen through the device's standard file/photo picker. The app does
  **not** request the Android CAMERA permission (the picker can invoke the camera
  on your behalf without granting the app direct camera access).

### 1.4 GPS location — **not stored**
* Latitude/longitude are optional query parameters (voice) or JSON body fields
  (crop-simple). They are used to (a) reverse-geocode district/state and (b) fetch
  temperature, humidity, and rainfall, then **discarded**. Nothing location-related
  is written to our database.
* Android requests the **location** permission for this optional feature only.

### 1.5 Generated audio responses (TTS) — **stored up to 30 days**
* After a query, the summary text is rendered as speech via **gTTS** and saved to
  `app/static/voice_responses/` so the app can play it back
  (`voice_service.synthesize`).
* These are auto-deleted after `VOICE_AUDIO_RETENTION_DAYS` (default 30) days: a
  background sweep in `app/main.py` runs every 6 hours and purges any clip older
  than the window (cleanup is continuous, not only on restart).
* Real transparency note: these clips are text read aloud — the text is a
  paraphrase of the user's query and the results. They are deleted after 30 days.

### 1.6 Authentication cookie — **stored in the app's WebView**
* When you sign in, the server sets one **httpOnly, Secure** cookie
  (`refresh_token`) scoped to `/api/v1/auth`. It is **not** readable by JavaScript,
  is never placed in localStorage, and is rotated on every refresh and revoked on
  logout (`app/routers/auth.py`, `app/auth/refresh_store.py`).
* The short-lived access token (15 minutes) is kept **in memory only** and is
  discarded when the app closes.

### 1.7 Server logs — **stored up to ~30 days**
* Access logs record only: method, request *path*, HTTP status, duration, client IP,
  user-agent (`app/middleware.py`). **No request bodies, no query strings, no audio,
  no photo content** are logged.
* Logs rotate automatically (5 MB × 5) at `backend/logs/backend.log`.

---

## 2. Why we collect it

| Data | Purpose |
|------|---------|
| Account info | Authenticate the user; show profile |
| Voice | Transcribe the farmer's spoken question to route it to the right model |
| Photos | Detect plant disease, weeds, and pests (local CNNs) |
| GPS | Crop recommendation: geocode to district/state + fetch local climate data |
| TTS output | Play the answer aloud (bilingual Tamil/English) |
| Cookie | Keep you signed in without re-entering your password |
| Logs | Security, debugging, abuse prevention (rate limiting) |

---

## 3. Third parties we share with

### 3.1 User-derived content sent outside our servers
**Only one flow sends user-derived content externally: TTS (gTTS).**

* When the app plays back an answer, the **summary text** (which can paraphrase the
  user's question) is sent to **Google's Text-to-Speech servers** via the `gTTS`
  library (`app/services/dl/voice_service.py`). gTTS is an undocumented client of
  Google's translate_tts endpoint — Google may process/log that text. There is no
  way to synthesize on-device Tamil speech with the current pipeline. gTTS requires
  internet at call time.
* We do **not** pass any personal identifiers (name, phone, IP claim) to Google.
* No other user content (audio, photos, coordinates) leaves our server:
  * Whisper ASR (speech→text) is **100% local** (no OpenAI API).
  * Disease/weed/pest CNNs are local PyTorch models.
  * **There is no Google Gemini / GenAI / OpenAI integration anywhere in the
    product.** (Any such surfaces were removed; none are active.)

### 3.2 Geo/weather services that receive only coordinates
These receive the user's GPS coordinates (and an API key), but **never any
personal identifiers or user content**:

| Service | What we send | Used for |
|---|---|---|
| OpenStreetMap **Nominatim** | lat/lon | reverse-geocode → district/state |
| **OpenWeatherMap** | lat/lon + API key | current temperature & humidity |
| **NASA POWER** | lat/lon | long-term average rainfall |

### 3.3 What we never share
* We do **not** sell or rent data.
* No advertising SDKs, remarketing, analytics SDKs, ad identifiers, or fingerprinting.
* We do not transfer audio or photos to any third party.

---

## 4. Cookies and tracking

The only cookie is the httpOnly `refresh_token` described in §1.6, used solely to
keep you signed in. There are no analytics, advertising, or tracking cookies, and
no web trackers or fingerpriting scripts.

---

## 5. Retention

| Data | Retention |
|------|-----------|
| Account (name, phone, password hash) | Until user requests deletion (§7) |
| Voice recordings & photos | Not stored; deleted post-processing |
| GPS coordinates | Not stored; discarded after the request |
| TTS preview audio | 30 days (continuous auto-purge, every 6 h) |
| Refresh cookie | Until logout / expiry / revocation |
| Access logs | Rotated; old files removed continuously |

---

## 6. Security

* TLS/HTTPS end-to-end (nginx + Let's Encrypt in production; `deploy/README.md`).
* Passwords bcrypt-hashed; the app refuses to start without a strong `SECRET_KEY`.
* **Access JWTs live 15 minutes; refresh JWTs live 28 days but are rotated on every
  refresh and revoked server-side on logout, account deletion, and refresh-token
  reuse** (`app/auth/refresh_store.py`).
* The refresh token is an **httpOnly + Secure + SameSite=Lax cookie** — it never
  touches JavaScript or localStorage.
* Rate limiting per IP on auth, voice, and prediction endpoints.
* Uploaded media never lands on disk (images) or is removed immediately (audio).
* The Android build blocks cleartext (HTTP) traffic at the OS level
  (`network_security_config.xml`).

---

## 7. Data deletion — how users can request it

Farmers can delete their own account **in the app, at any time**: the account
screen offers **"Delete my account"**, which calls `DELETE /api/v1/auth/me` with
the logged-in token. This permanently removes the farmer's row (name, phone
number, and password hash) from the database — no email request needed.

For completeness, deletion can also be requested by email:

1. The user emails **privacy@valam.in** from/with their registered phone number.
2. We verify the phone number (the account's login identifier).
3. Within **30 days** we permanently delete all matching rows in `farmers`.
4. We reply to confirm deletion.

Either way the account record is gone; voice/photo data is never tied to an account
(those inputs are processed and discarded, and any generated TTS clips are purged by
the 30-day retention sweep), so no further data remains.

---

## 8. Children

Not directed to children under 13; we don't knowingly collect their data.

---

## 9. Changes to this policy

We may update this policy from time to time. Changes are posted at this URL with a
new "Last updated" date; continued use constitutes acceptance.

---

## 10. Contact

**privacy@valam.in** · https://valam.in
