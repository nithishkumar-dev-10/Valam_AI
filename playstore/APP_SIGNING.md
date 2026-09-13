# Play App Signing — backend impact assessment

**Short answer: Play App Signing is purely a Flutter/Android-side concern. The
Valam AI backend needs zero changes for it.** Details below so you can defend this
claim in any review or handoff.

---

## What Play App Signing actually is

- One of two keys matters for *your* Android build:
  - **Upload key** (kept by you) — used to sign the `.aab` you upload.
  - **App signing key** (managed & backed up by **Google**) — uses Google's copy to
    re-sign the app for users, and enables key rotation/broken-key recovery.
- This is entirely resolved inside Play Console + `key.properties`/Flutter build config.
  It tells the OS a release APK belongs to your package. **It has nothing to do with
  our HTTP API.**

## Why the backend is not affected

1. **Our API uses phone-number + password auth with JWT** (`/api/v1/auth/login` → access
   & refresh tokens). There is no API secret bound to an app binary signature.
2. **No Google API keys are used server-side.** We call OpenWeatherMap, NASA POWER,
   Nominatim, and gTTS/Google TTS — none of those keys relate to the Android app
   signature. (gTTS uses an undocumented public endpoint, not a keyed Android API.)
3. **CORS does not apply to mobile apps.** CORS is a *browser* protection. Flutter's
   `http`/`dio` clients ignore it. Our `CORS_ORIGINS` config is only relevant to a
   web-based frontend, so signing the app doesn't change anything about it.
4. **We don't use Google OAuth / Sign in with Google**, the one Google feature where
   app signing *can* matter (that's configured in Google Cloud Console per
   **package name + SHA-1 of the signing cert**, and would live there, not in this repo).

## What the Flutter team must do (their side only)

- Create a **keystore** and `android/key.properties`.
- Enable **Play App Signing** in Play Console (default for new apps) and upload the
  upload key cert.
- Keep the **upload keystore** backed up (Google can re-sign users' devices, but the
  upload key is still yours to store safely).
- Optionally set up **SHA-1 pinning per flavor** later if they add Google APIs.

## Backend team action items

| Action | Needed? |
|---|---|
| Backend code changes | **None** |
| `.env` changes for mobile launch | Only `CORS_ORIGINS` when a *web* build of the app ships (not needed for native) |
| Provide any cert/SHA-1 to backend | No |
| New API keys to hand to Flutter team | No — tokens are per-farmer JWTs obtained by logging in |

## When this conclusion would change (future watch-items)

- If we later add **Google Sign-In** ⇒ Flutter configures the OAuth client ID
  (package + SHA-1); backend would need to accept Google-issued ID tokens, not
  signature checks.
- If we later add an **Android Maps SDK / Firebase Messaging** ⇒ Google Cloud keys
  restricted by package+SHA-1 live in Google Cloud Console, not our code.
- If the backend ever exposes **per-app API keys** (e.g. to stop curl/Postman scraping),
  we could restrict them by package name — a possible follow-up, **not required for launch**.

## TL;DR
Hand the Flutter team this: *"Play App Signing is configured entirely in Play Console
and the Flutter build. Set up `key.properties`, enable Play App Signing, back up your
upload key. Nothing is needed from the API."*