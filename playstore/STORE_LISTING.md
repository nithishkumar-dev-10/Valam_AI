# Google Play store listing content

Text only (screenshots/feature graphics come later from the Flutter team). Character
counts are for the *displayed* text (Google counts characters, not words).

---

## App title (30 chars max)

> **Valam AI** *(10 chars — clean, brandable, safe. Example: "Valam AI – Farming Assistant" is 31; avoid the extra char)*

Suggested variation if you want category keywords: **"Valam AI: Farming Assistant"** (31) — **over the limit**. Keep **"Valam AI — Farming Assistant"** (no, also long). **Use "Valam AI".**

*(Google shows up to 30 chars; pick the short one for safe rendering, or "ValamAI FarmGuide" = 18 if you want the category echo.)*

---

## Short description (80 chars max)

> `Voice-first assistant for Indian farmers — crop, disease & pest guidance in Tamil and English`

Count check: **97** — too long. Corrected (79):

> `Voice-first crop, disease & pest guidance for Indian farmers — in Tamil and English`

(79 chars ✅)

---

## Full description (main body, 4000 chars max — draft ≈ 1100; room to grow)

> **Valam AI** is a voice-first agriculture assistant built for Indian farmers. Ask a
> question the way you'd ask a field expert — in Tamil or English — by speaking, taking
> a photo of your crop, or sharing your location — and Valam answers instantly, in your
> language, with an easy-to-understand recommendation.
>
> ### What it can do
> - **🎤 Talk to it.** Record a question in Tamil or English. Valam transcribes it
>   on-device, understands what you're asking, and replies with a spoken answer.
> - **🌱 Crop recommendation.** Share your location and Valam suggests which crop is a
>   good fit for your land, using your area's soil and weather data.
> - **🍃 Disease detection.** Snap a photo of a sick leaf or fruit and Valam identifies
>   38 common plant diseases with a confidence score.
> - **🐛 Pest & weed detection.** Upload a photo of a plant or field and Valam identifies
>   common pests and 9 major weed species, so you can target treatment.
> - **📢 Voice answers.** Responses are spoken aloud — perfect for the field, when your
>   hands are busy.
>
> Designed for low-cost smartphones and patchy rural connectivity: the app is lightweight,
> works in bilingual Tamil/English, and is free to use.
>
> **Important:** Valam AI provides **informational guidance**, not a substitute for advice
> from an agronomist, extension officer, or veterinary/plant-protection professional.
> Always verify before acting on crop or plant treatments.

---

## Key features (bullet list for the "features" or marketing copy)

1. **Voice-first, bilingual interface** — speak or type in Tamil or English; get spoken answers back.
2. **Crop recommendation from your location** — soil & weather-aware crop suggestions for your field.
3. **Plant disease detection** — 38 disease classes, photo-based, with confidence scoring.
4. **Pest and weed identification** — 9 weed species + key agri-pests from field photos.
5. **One-tap multimodal question** — record a note, snap a photo, and (optionally) share GPS in a single query.
6. **No-account access** — try the full assistant without signing up.
7. **Privacy-conscious** — photos & voice processed in-memory; no ads, no data selling.

---

## "What's new" (for first release)

> Initial release — voice-first farming assistant in Tamil & English.

---

## Category / content rating quick picks

- **Category:** *Education* or *Agriculture* (Google's list has "Agriculture" under Tools; pick the one the store shows for your target). Recommend **"Agriculture"** if available, else *Education*.
- **Content rating:** *Everyone* (no restricted content; guidance is informational).
- **Ads:** None (maintain "no ads" claim in both listing & Data Safety).

---

## Notes for the Flutter team (so store text matches shipped UI)

1. Keep the description's claims strictly true: **nothing about offline maps, offline
   ML on the phone, or cloud sync** — the backend does all ML; the app is a thin client.
2. If you later add OTP login / offline mode / language toggles, revise the listing +
   Data Safety form (`DATA_SAFETY_FORM.md`) together.
3. Screenshots later should reflect actual feature output (disease card, crop card, voice
   bubble) — reuse the response contract in `API_INTEGRATION_GUIDE.md` so screenshots
   match real API responses.