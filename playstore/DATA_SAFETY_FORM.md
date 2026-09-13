# Google Play Data Safety Form — exact answer key

Google's Data Safety form asks two things about every item: **"Collected"** (does the
app collect it?) and (where relevant) **"Shared"** (does the app share it with third
parties? specifically: advertising, analytics, or across-app/federation purposes), plus
whether each item is **required** or **optional**, and whether a **deletion mechanism**
exists.

Fill this in exactly as below. Where a *choice matters for review*, the judgement call
is explained at the bottom of each section.

---

## 1. Location

| Question | Answer |
|---|---|
| Precise location — collected? | **Yes — Optional** |
| Approximate location — collected? | **No** |
| Shared? | **No** (see note below) |

*What we collect:* exact GPS latitude/longitude only when the farmer explicitly shares
location for the crop-recommendation feature.

*Judgement call — "Shared":* the coordinates DO go to third-party services (Nominatim,
OpenWeatherMap, NASA) to fulfil the request. Google's Data Safety "Shared" definition is
aimed at *advertising, analytics, or marketing* disclosure. Functional API calls to
fulfil the service are disclosed in the privacy policy (Section 3) but are **not marked
"Shared"** on the form. If you'd rather be extra conservative, mark "Shared = Yes" and
add to the description: "sent to weather/geocoding providers to compute crop
recommendations." Our recommendation: keep it **No**, because we do not transmit it for
any of Google's listed "shared" purposes.

*Storage:* not stored at all.

---

## 2. Personal info

| Question | Answer |
|---|---|
| Name — collected? | Yes — Required only *if* the user creates an account (feature is optional, so mark **user-initiated** if asked) |
| Email address — collected? | No |
| Phone number — collected? | Yes — the login username |
| Physical address — collected? | No |
| Password — collected? | Yes (stored **bcrypt-hashed** only) |
| Other user info — collected? | No |

*Deletion,* as asked by the form: **"No" for self-serve in-app, "Yes by request"** —
users can request deletion via `privacy@valam.in` (30 days). The form's wording wants
to know if the user can request deletion — answer **Yes** (via contact), and note in the
policy that in-app self-service is coming.

---

## 3. Photos & videos

| Question | Answer |
|---|---|
| Photos — taken? From gallery? | Field/plant photos uploaded **from the device** — **Collected: Yes, Optional** |
| Shared? | No |
| Deletion mechanism? | N/A — **not stored** on our servers (processed in memory and discarded) |

*Note for the Flutter team:* the form will ask whether the app uses the **camera** to
take these photos. That's decided by the app UI (image picker vs camera), not the
backend — the app likely uses both. Whatever the app does, the backend's claim is the
same: photos are optional, not stored, not shared.

---

## 4. Audio

| Question | Answer |
|---|---|
| Audio files — collected? | **Yes — Optional** (voice notes recorded/uploaded by the user) |
| Shared? | No |
| Deletion? | N/A — **not stored** (temporary file deleted after transcription) |

---

## 5. Everything else — all "No"

These are the remaining categories; answer **No / not collected** for all of them:

- **Financial info** — No
- **Health & fitness** — No *(plant disease detection is about crops, not the user)*
- **Messages** — No
- **Files & docs** — No
- **Call log** — No
- **Contacts** — No
- **Calendar** — No
- **SMS or SMS auto-login** — No (we never read device SMS; OTP login is not implemented)
- **Web browsing history** — No
- **Device or other IDs** — No (we don't collect device IDs/ad IDs; IP address is used
  transiently for rate limiting and appears in server logs — not listed as a "Device ID"
  under Google's definition, but you may mention it in the policy, which we do)
- **App photos/videos** (in-app media) — N/A
- **In-app purchases** — No
- **App activity / app interactions / crash logs / diagnostics / other app performance** — No
  *(the backend does not ship an analytics/crash SDK; if the Flutter team adds Firebase, this becomes Yes)*
- **Installed apps** — No

---

## 3 security & compliance questions (answered truthfully)

| Question | Answer |
|---|---|
| Data encrypted in transit? | **Yes** — HTTPS/TLS (nginx + Let's Encrypt) |
| Data deletion mechanism? | **Yes** — by user request (email `privacy@valam.in`, processed ≤30 days); media auto-purged 30 days |
| Committed to Play Families policy / designed for children? | **No** — app is for adult farmers; not directed at children |

---

## How to fill the form (Play Console walk-through)

1. Play Console → your app → **Policy → Data safety** → *Start*.
2. **Data types** — tick exactly these:
   - Location → **Precise location** (Optional)
   - Personal info → **Name**, **Phone number** (both "user signs up" trigger)
   - Photos and videos → **Photos**
   - Audio files → **Audio files**
   - *(leave everything else unticked)*
3. For each: confirm it's used for **app functionality** (not advertising),
   mark "collected but **not** shared", and where the form asks, "not encrypted"
   is NOT what we claim — confirm **encrypted in transit = Yes**.
4. **Security section:** HTTPS yes, deletion-by-request yes.
5. Save. This page is part of the review, so keep this checklist until the app is approved.

---

## If the Flutter team adds SDKs (IMPORTANT — re-audit checklist)

Answers above are valid **only for the current backend + a plain Flutter app**. Before
final submission, the Flutter team must confirm they did **not** add:
- Firebase Analytics / Crashlytics / AdMob  → would flip "App activity/App info" & "Device IDs" to Yes
- Google Maps → Map usage fine (no data collected, but declare "device or other IDs" only if analytics on)
- Contacts / SMS / notifications permission (other than app-internal) → would add categories
- Third-party APMs (Sentry, Datadog) → "Crash logs" becomes Yes

If they add any of these, update `PRIVACY_POLICY.md`, `privacy.html`, and re-derive this
table from the new data flows.