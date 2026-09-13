# Valam AI — Privacy Policy (source)

**Last updated:** September 2026

> This is the markdown source. The ready-to-host file is `playstore/privacy.html`
> (upload that as your live privacy page — it's self-contained and looks
> professional when linked from the Play Console). Every claim below is grounded
> in the actual implementation in `backend/app/`, not generic boilerplate. Where a
> behaviour could go either way, we verified the code first (see "Code references").

---

## Who we are

Valam AI ("we", "our", "us") is a voice-first agricultural assistant for Indian
farmers. This policy explains what we collect, why, how long we keep it, who we
share it with, and how you can delete it.

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

### 1.2 Voice recordings — **not stored**
* Audio notes are uploaded to `POST /api/v1/voice/query` (`app/routers/voice.py`).
* The audio bytes are written to a temporary file (`app/temp_uploads/`), passed to
  **local Whisper ASR** (`app/services/dl/voice_service.py`), and **deleted in a
  `finally` block immediately after transcription. Nothing about the audio is
  persisted.
* **Whisper runs locally on our servers.** The `whisper` package we use is the
  open-source model — it performs inference on our machines and does **not** send
  your audio to OpenAI or any other party.

### 1.3 Photos — **not stored**
* Field/plant photos are uploaded to `/api/v1/voice/query`, `/api/v1/predict/disease`,
  `/api/v1/predict/deep-weed`, or `/api/v1/predict/pest`.
* Bytes are held **in memory only** (`image_bytes`), fed to local PyTorch CNNs, and
  never written to disk.

### 1.4 GPS location — **not stored**
* Latitude/longitude are optional query parameters (voice) or JSON body fields
  (crop-simple). They are used to (a) reverse-geocode district/state and (b) fetch
  temperature, humidity, and rainfall, then **discarded**. Nothing location-related
  is written to our database.

### 1.5 Generated audio responses (TTS) — **stored up to 30 days**
* After a query, the summary text is rendered as speech via **gTTS** and saved to
  `app/static/voice_responses/` so the app can play it back (`voice_service.synthesize`).
* These are auto-deleted after `VOICE_AUDIO_RETENTION_DAYS` (default 30) days:
  a background sweep in `app/main.py` runs every 6 hours and purges any clip
  older than the window (cleanup is continuous, not only on restart).
* ⚠️ **Real transparency note:** these clips are text read aloud — the text is a
  paraphrase of the user's query and the results. They are deleted after 30 days and
  are not linked to account identity unless a logged-in token was used.

### 1.6 Server logs — **stored up to ~30 days of activity**
* Access logs record only: method, request *path*, HTTP status, duration, client IP,
  user-agent (`app/middleware.py`). **No request bodies, no query strings, no audio,
  no photo content** are logged.
* Logs rotate automatically (5 MB × 5) at `backend/logs/backend.log` (`app/utils/logger.py`).

---

## 2. Why we collect it

| Data | Purpose |
|------|---------|
| Account info | Authenticate the user; show profile; future per-farmer history |
| Voice | Transcribe the farmer's spoken question so we can route it to the right model |
| Photos | Detect plant disease, weeds, and pests (local CNNs) |
| GPS | Crop recommendation: geocode to district/state + fetch local climate data |
| TTS output | Play the answer aloud (bilingual Tamil/English) |
| Logs | Security, debugging, abuse prevention (rate limiting) |

---

## 3. Third parties we share with

This is the section that matters. Two kinds of "sharing" exist here, and we report
both honestly.

### 3.1 User-derived content sent outside our servers
**Only one flow sends user-derived content externally: TTS (gTTS).**

* When the app plays back an answer, the **summary text** (which can paraphrase the
  user's question) is sent to **Google's Text-to-Speech servers** via the `gTTS`
  library (`app/services/dl/voice_service.py:85`). gTTS is an undocumented client to
  Google's translate_tts endpoint — Google may process/log that text. There is no way
  to synthesize on-device speech in Tamil with the current pipeline.
* We do **not** pass any personal identifiers (name, phone, IP claim) to Google.
* No other user content (audio, photos, coordinates) leaves our server:
  * ✅ Whisper ASR (speech→text) is **100% local** (no OpenAI API).
  * ✅ Disease/weed/pest CNNs are local PyTorch models.
  * ⚠️ `deep_translator` is imported in the codebase but **not called on any active
    code path** (verified — only defined in `voice_service.py`, never invoked by the
    pipeline), so no text is sent to Google Translate at runtime today.

### 3.2 Geo/weather services that receive only coordinates
These receive the user's GPS coordinates (and an API key), but **never any
personal identifiers or user content**:

| Service | What we send | Used for | Code |
|---|---|---|---|
| OpenStreetMap **Nominatim** | lat/lon | reverse-geocode → district/state | `app/services/external/geocoding.py` |
| **OpenWeatherMap** | lat/lon + API key | current temperature & humidity | `app/services/external/weather_fetch.py` |
| **NASA POWER** | lat/lon | long-term average rainfall | `app/services/external/weather_fetch.py` |

### 3.3 What we never share
* We do **not** sell or rent data.
* No advertising SDKs, remarketing, analytics SDKs, ad identifiers, fingerprinting.
* We do not transfer audio or photos to any third party.

---

## 4. Retention

| Data | Retention |
|------|-----------|
| Account (name, phone, password hash) | Until user requests deletion (§5) |
| Voice recordings & photos | Not stored; deleted post-processing |
| GPS coordinates | Not stored; discarded after the request |
| TTS preview audio | 30 days (continuous auto-purge, every 6 h) |
| Access logs | Rotated; old files removed continuously |

---

## 5. Data deletion — how users can request it

Farmers can delete their own account **in the app, at any time**: the app's
account screen offers **"Delete my account"**, which calls
`DELETE /api/v1/auth/me` with the logged-in token. This permanently removes the
farmer's row (name, phone number, and password hash) from the database —
no email request needed.

For completeness, deletion can also be requested by email:

1. The user emails **privacy@valam.in** from/with their registered phone number.
2. We verify the phone number (the account's login identifier).
3. Within **30 days** we permanently delete all matching rows in `farmers` in the
   production database.
4. We reply to confirm deletion.

Either way the account record is gone; voice/photo data is never tied to an
account (those inputs are processed in memory and discarded, and any generated
TTS clips are purged by the 30-day retention sweep), so no further data remains.

---

## 6. Security

* TLS/HTTPS end-to-end (nginx + Let's Encrypt in production; `deploy/README.md`).
* Passwords bcrypt-hashed; JWTs (access 7 days / refresh 28 days) with no plaintext
  secrets in code.
* Rate limiting per IP on all write/voice endpoints (5/min auth, 10/min voice).
* Uploaded media never lands on disk (images) or is removed after use (audio).
* No secrets in the repo; `SECRET_KEY` required at boot (app refuses to start without it).

---

## 7. Cookies / tracking
Not applicable. No cookies, no web trackers, no analytics scripts. (If the Flutter
frontend later adds Firebase Analytics, this section and §3 must be revisited.)

---

## 8. Children
Not directed to children under 13; we don't knowingly collect their data.

---

## 9. Contact
**privacy@valam.in** · https://valam.in