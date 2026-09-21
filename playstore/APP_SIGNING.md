# Play App Signing — what it is and exactly what to run

**Short answer: Play App Signing is purely an Android-side concern. The Valam AI
backend needs zero changes for it.** The app is a Capacitor (Android) build that
wraps the React frontend; nothing about the signing key is known to the API.

---

## 1. What Play App Signing is

Two keys matter:

- **Upload key** (yours) — signs the `.aab` you upload to the Play Console.
- **App signing key** (managed and backed up by **Google**) — Google re-signs the
  app with this before shipping to users, and it enables key rotation / recovery
  if your upload key is ever lost.

For a new app, **Play App Signing is on by default**. It has nothing to do with
the HTTP API — it only tells Android/Play which binary belongs to package
`in.valam.app`.

## 2. How the Gradle signing works in this repo

- `frontend/android/app/build.gradle` loads `frontend/android/key.properties`
  (if it exists) and, when present, wires a `release` `signingConfig`.
- `key.properties` is **git-ignored** (see `frontend/android/.gitignore`), as are
  `*.jks` / `*.keystore`.
- If `key.properties` is absent, release builds are simply **unsigned** — debug
  builds and `npx cap sync` still work, so a fresh clone is never blocked.

## 3. Generate the keystore (one command)

```bash
./scripts/gen_android_keystore.sh
```

It prompts for a password (min 12 chars, never echoed), then:

- writes the keystore to `~/valam-keystore/valam-upload.jks` (**outside the repo**;
  the script refuses to write inside the repo),
- writes `frontend/android/key.properties` (mode 600, git-ignored),
- refuses to overwrite an existing keystore.

The raw equivalent, if you prefer to run keytool by hand:

```bash
keytool -genkeypair -v \
  -keystore ~/valam-keystore/valam-upload.jks \
  -storetype PKCS12 \
  -alias valam-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Valam AI, OU=Mobile, O=Valam AI, L=Chennai, ST=Tamil Nadu, C=IN" \
  -storepass '<PASSWORD>' -keypass '<PASSWORD>'
```

> RSA-2048, 10000-day validity is the standard Play requirement (Play requires the
> cert to be valid past 2033). Google recommends exactly this shape.

## 4. Build a signed release bundle

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
Upload **that file** to Play Console → Production → Create release.

Android Studio alternative: **Build → Generate Signed App Bundle / APK →
Android App Bundle → Release**, then point it at the same
`~/valam-keystore/valam-upload.jks` and alias `valam-upload`.

**Do NOT upload an APK.** Play requires AAB for new apps.

## 5. Back this up — it is unrecoverable

Lose the upload key and you must file a Play Console key-reset request (slow, and
you may need a new app listing in the worst case). Back up, offline and separately:

- `~/valam-keystore/valam-upload.jks`
- the keystore password
- the `valam-upload` alias password (same value with PKCS12)
- `frontend/android/key.properties` (contains the password in plaintext — treat it
  as a secret, never commit, never paste in chat/screenshots)

## 6. Why the backend is unaffected

1. **Auth is phone-number + password → JWTs** (`/api/v1/auth/*`). No API secret is
   bound to the app-signing certificate.
2. **No server-side Google API keys tied to the signature.** External calls
   (OpenWeatherMap, NASA POWER, Nominatim, gTTS) do not depend on the Android cert.
3. **No Google Sign-In / OAuth.** This is the one Google feature where package name
   + signing-cert SHA-1 matters (configured in Google Cloud Console if ever added),
   and it is not used.
4. **CORS is unrelated to signing.** Capacitor's WebView *is* a browser context, so
   `CORS_ORIGINS` matters (we already allow `https://app.valam.in`), but the signing
   key never enters the CORS picture.

## 7. When this would change (future watch-items)

- Adding **Google Sign-In** ⇒ register a Google Cloud OAuth client (package +
  SHA-1 of the **app signing** cert from Play Console) and have the backend accept
  Google-issued ID tokens.
- Adding **Firebase Messaging / Maps SDK / Play Integrity** ⇒ those keys live in
  Google Cloud Console, restricted by package + SHA-1, still not in our code.
- Adding per-app API keys to deter scripted abuse ⇒ possible follow-up, **not
  required for launch**.

## TL;DR

Run `./scripts/gen_android_keystore.sh`, back the keystore up offline, build
`app-release.aab` with `./gradlew bundleRelease` (or Android Studio), and upload it.
Nothing is needed from the API.
