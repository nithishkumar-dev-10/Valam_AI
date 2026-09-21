# Google Play Data Safety — exact answer key

Answers derived from the **actual shipped implementation**: Capacitor Android
app (`in.valam.app`) wrapping the React frontend, talking to the Valam AI FastAPI
backend. Google's form asks, per data type, whether it is **collected** and
**shared** (shared = advertising / analytics / marketing / cross-app purposes),
whether it is **required or optional**, and whether a **deletion mechanism**
exists.

> There is **no Google Gemini / GenAI / OpenAI / Firebase / AdMob** integration.
> The one external processor that receives user-derived content is **Google TTS
> (gTTS)**, which receives the *generated response text* — see §3.

---

## 1. Location

| Question | Answer |
|---|---|
| Approximate location — collected? | **No** |
| Precise location — collected? | **Yes — Optional** |
| Shared? | **No** (see note) |

*What we collect:* exact GPS latitude/longitude, only when the farmer explicitly
shares location for crop recommendation / weather.

*Judgement call:* coordinates are sent to OpenWeatherMap, NASA POWER, and
Nominatim to fulfil the request. Google's "shared" definition targets
advertising/analytics/marketing/federation; functional API calls are disclosed in
the privacy policy but are **not** marked "Shared". Conservative option: mark
"Yes" and add "sent to weather/geocoding providers to compute recommendations".
Recommendation: **No**.

*Storage:* **Not stored.** Used in-request and discarded.

---

## 2. Personal info

| Question | Answer |
|---|---|
| Name — collected? | **Yes — Optional** (only if the user creates an account) |
| Phone number — collected? | **Yes — Optional** (the login identifier) |
| Email address — collected? | **No** |
| Physical address — collected? | **No** |
| Password — collected? | **Yes**, stored **bcrypt-hashed** only (report under "User IDs"/credentials; not a public data type) |
| Other personal info — collected? | **No** |

*Deletion:* **Yes** — in-app "Delete my account" (`DELETE /api/v1/auth/me`), and
by email to `privacy@valam.in` within 30 days.

---

## 3. Photos and videos

| Question | Answer |
|---|---|
| Photos — collected? | **Yes — Optional** (chosen via the device photo/file picker) |
| Shared? | **No** |
| Deletion mechanism? | N/A — **not stored** (processed in memory, discarded) |

*Note:* the app does **not** request the Android **camera** permission; photos are
picked through the OS picker, which may invoke the camera without giving the app
direct camera access. Declare "Photos" collection but **not** camera access unless
you later add a direct-camera capture flow.

---

## 4. Audio

| Question | Answer |
|---|---|
| Voice/sound recordings — collected? | **Yes — Optional** (voice notes) |
| Shared? | **No** |
| Deletion mechanism? | N/A — **not stored** (temp file deleted immediately after transcription) |

*Third-party note (important):* the app uses **Google Text-to-Speech (gTTS)** to
synthesize the spoken answer. The **generated response text** (which can paraphrase
the query) is sent to Google's TTS servers. Under Google's definitions this is
processing to provide app functionality, not "sharing" for ads/analytics — but it
IS a third-party processor and must be described in the Privacy Policy (it is).
No other audio content leaves the server.

---

## 5. Everything else — all "No"

Answer **No / not collected** for: Financial info, Health & fitness (plant
disease is about crops, not the user), Messages, Files & docs, Call log, Contacts,
Calendar, SMS (OTP login is **not** implemented), Web browsing history, **Device
or other IDs** (no advertising IDs / device IDs collected; client IP is used
transiently for rate limiting and appears in server logs — not a "Device ID"),
In-app purchases, App activity / interactions, Crash logs / diagnostics (no
analytics or crash SDK is bundled), Installed apps.

> If any SDK is added later (Firebase Analytics/Crashlytics, AdMob, Sentry,
> Maps), flip the corresponding categories to **Yes** and update
> `PRIVACY_POLICY.md` + `privacy.html` together.

---

## 6. Security & compliance questions

| Question | Answer |
|---|---|
| Data encrypted in transit? | **Yes** — HTTPS/TLS (nginx + Let's Encrypt); Android blocks cleartext traffic at OS level |
| Data deletion mechanism? | **Yes** — in-app account deletion + email; media auto-purged |
| Committed to Play Families policy? | **No** — app is for adult farmers; not directed at children |

---

## 7. How to fill the form (Play Console walk-through)

1. Play Console → your app → **Policy and programs → App content → Data safety** → *Start*.
2. **Data collection and security:**
   - Encrypted in transit: **Yes**
   - Data deletion / account deletion: **Yes**
3. **Data types** — tick exactly:
   - Location → **Precise location** (Optional)
   - Personal info → **Name**, **Phone number**
   - Photos and videos → **Photos**
   - Audio files → **Voice or sound recordings**
   - *(leave everything else unticked)*
4. For each ticked type: purpose = **App functionality** (not advertising);
   collected but **not** shared; not ephemeral.
5. Save. Keep this checklist until approval.

## 8. Re-audit triggers (do this again if…)

- The app starts using the **camera** directly, contacts, SMS, or notifications.
- Any analytics / crash / ads SDK is added.
- Google Sign-In or payments are added.
- The backend adds any new third-party processor.
