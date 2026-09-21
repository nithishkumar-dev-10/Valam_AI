# Pre-Hosting Readiness Checklist

Scope: verify the repo is safe and self-consistent to deploy, without touching the
already-shipped security / auth code. Work was done on the working tree on top of
commit `b5834bd4` (which contains the hardening + httpOnly-cookie migration).

Legend: `[x]` verified or fixed this pass · `[ ]` needs a manual decision.

Baseline after this pass:
- Backend: `23 passed, 2 warnings` (`backend/venv/bin/pytest -q`).
- Frontend: `npm run typecheck` exit 0; `npm run build` exit 0 (495.53 kB / 159.85 kB gzip).
- Locales: `en.json` and `ta.json` are at full key parity (342 = 342, zero diff).

---

## 1. Config completeness

- [x] Every env var the code reads is documented in `backend/.env.example`.
  - [x] Removed dead `LOG_DIR` / `LOG_FILE` (these are constants in `config.py:25-26`, never env-read).
  - [x] Added `REFRESH_COOKIE_NAME` (read by the cookie config, previously undocumented).
  - [x] Added commented `RAINFALL_START` / `RAINFALL_END` (used by `services/.../weather_fetch.py`).
- [x] CORS is env-driven, no hardcoded origins. Prod template in `deploy/README.md` sets
      `CORS_ORIGINS=https://app.valam.in,https://admin.valam.in,http://localhost:5173`.
- [x] `.gitignore` covers secrets and local DBs: added `frontend/.env`, generic
      `*.db` / `*.db-wal` / `*.db-shm` / `*.sqlite` / `*.sqlite3` (backend already ignores
      `venv`, `.env`, `data/`).
- [x] Git-history secret scan is clean. The only `.env` ever committed was `frontend/.env`
      (`VITE_API_BASE_URL=http://localhost:8000`, harmless), introduced in `9f448c98` and
      removed in `68e3b31b`. `backend/.env` was never tracked. No key-like patterns in history.
- [x] No tracked `*.db`, `*.sqlite`, or `venv` artifacts.
- [ ] Decision: confirm the production `backend/.env` values on the host
      (`CORS_ORIGINS`, `SECRET_KEY`, `REFRESH_COOKIE_SECURE=true`, `WHISPER_MODEL_SIZE`, `WEATHER_API_KEY`).

## 2. Model file integrity

- [x] All model artifacts present and tracked since `9f448c98`, sizes sane:
      `crop_recommender.pkl` (7.28 MB), `disease_cnn.pt` (9.33 MB), `deepweeds_model.pt` (44.8 MB),
      `pest_model.onnx` (8.91 MB), `label_encoder.pkl` (830 B), class JSONs.
- [x] Load + dummy-inference passed for all four models:
      crop -> `rice` (0.52); disease -> `Tomato___Tomato_Yellow_Leaf_Curl_Virus` (0.089, 38 classes);
      deep_weed -> `Lantana` (0.874, 9 classes); pest -> `mites` (0.18, 9 classes).
- [x] Whisper loads lazily via `whisper.load_model(size)` (`voice_service.py:40`) and is warmed in the
      app lifespan; `WHISPER_MODEL_SIZE` is env-configurable (`.env.example` default is `base`).
- [ ] Decision: `ml_models/pest_model.pt` (9.18 MB) is unused — the pest router serves `pest_model.onnx`.
      Delete it, or keep it as a training artifact? (Not deleted this pass.)
- [ ] Decision: Whisper downloads its weights to `~/.cache/whisper` on first load. Pre-bake the weights
      into the image / host it, or allow the first-boot download?

## 3. Graceful failure

- [x] All four predict endpoints return `503` with a clear message when a model is unavailable.
  - [x] Fixed `routers/disease.py` and `routers/deep_weed.py` (previously a `RuntimeError` became a 500):
        added `try/except RuntimeError -> HTTPException(503)` + logger + 503 in the documented responses.
  - [x] Fixed `routers/crop.py` `predict_crop_manual`: generic `except Exception` was swallowing the 503;
        added `except HTTPException: raise` first.
- [x] Upload rejection behaves: `.txt` renamed `.jpg` -> 415; 0-byte -> 400; 11 MB -> 413; corrupt JPEG -> 415.
- [x] Voice path has no Gemini anywhere (grep clean); `PipelineInputError -> 400`; a gTTS failure degrades
      gracefully. Runtime is local Whisper + gTTS only.

## 4. Frontend UX

- [x] i18n key parity: `en.json` / `ta.json` at 342 = 342 keys, no en-only or ta-only leftovers.
  - [x] Root cause fixed: the runtime `tValue()` normalizes model outputs (lowercase, `_` -> space,
        collapse) and keeps punctuation / plant prefixes, while the authored keys had stripped them.
        Added the missing 38 disease + weather keys (en) and 12 punctuated disease keys (ta), then
        removed the now-unreachable duplicates.
- [x] No hardcoded user-facing English in JSX/TSX. The one literal (`lib/geo.ts` location error) is
      intentionally routed through `tValue()` and has translations in both locales.
- [x] Every network call site has a loading state and an error state:
  - [x] `components/Shell.tsx` health probe: grey (unknown) / green (ok) / red (down) with translated titles.
  - [x] `components/CropForm.tsx`: phase `input | loading | result | error`.
  - [x] `pages/HomePage.tsx`: phase `input | working | done | error` + progress ticker + toast guards.
  - [x] `pages/ScanPage.tsx`: phase `input | analyzing | result | error` + progress ticker.
  - [x] `pages/VoicePage.tsx`: `processing | idle` recorder state + error + `locating`.
  - [x] `pages/AuthPage.tsx`: phase `form | submitting | done`, field-level errors + toast.
  - [x] `pages/ProfilePage.tsx`: `status === "loading"` skeleton, `saving` / `deleting` states + toasts.
- [ ] Decision: none outstanding (locale leftovers were removed rather than left as dead keys).

## 5. Dev / debug cleanup

- [x] No ad-hoc `print` / `console.log` / `debugger` / commented-out code blocks in `backend/app` or
      `frontend/src`. Only `logger.py:14` carries an intentional `TODO(launch)` comment.
- [x] No hardcoded test users, dummy data, or leftover debug routes.
- [x] Removed 26 dead files (unstaged deletions). Backend suite still green afterward.
  - Empty routers: `community`, `expense`, `farmer`, `land`, `market`, `pesticide`, `schemes`, `tutorials`, `weather`.
  - Superseded DL modules: `dl/intent_router.py`, `dl/voice_pipeline.py`, `dl/weed_pest_model.py`, `dl/disease_model.py`.
  - Dead GenAI tree: `services/genai/` (entire directory).
  - Dead external clients: `external/agmarknet_client.py`, `external/weather_client.py`.
  - Orphans / empties: `schemas/expense.py`, `schemas/land.py`, `tests/test_expense.py`.
- [x] No dangling references to any deleted module (grep over `backend/app` + `backend/tests` is clean).

## 6. Router scope

- [x] `main.py` mounts only what is needed: `auth`, `crop`, `disease`, `deep_weed`, `voice`, `pest`, plus
      `admin` (gated behind `ADMIN_ACCESS_KEY`).
- [x] The 9 unused routers are not imported or mounted.
- [x] No GenAI / RAG surface is exposed.

---

## Manual decisions required before hosting

1. Production `backend/.env` values (Section 1).
2. Fate of the unused `ml_models/pest_model.pt` (Section 2).
3. Whisper first-boot model download strategy (Section 2).

## Verification commands

```sh
# Backend
cd backend && ./venv/bin/pytest -q        # -> 23 passed, 2 warnings

# Frontend
cd frontend && npm run typecheck && npm run build

# Locale parity (expect zero en-only / ta-only)
node -e 'const en=require("./frontend/src/locales/en.json"),ta=require("./frontend/src/locales/ta.json");const f=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?f(v,p+k+"."):[p+k]);const E=f(en),T=f(ta);console.log("en-only",E.filter(k=>!T.includes(k)),"ta-only",T.filter(k=>!E.includes(k)))'
```

## Working-tree note

These sweep changes are **not committed** and sit on top of `b5834bd4`:
- modified: `.gitignore`, `backend/.env.example`, `frontend/src/locales/{en,ta}.json`,
  `backend/app/routers/{crop,disease,deep_weed}.py`
- deleted (unstaged): the 26 files listed in Section 5
- added: this file (`PRE_HOSTING_CHECKLIST.md`)

The two remaining pytest warnings are dependency-level and not actionable here:
Starlette's `httpx` -> `httpx2` deprecation, and passlib's use of the deprecated `crypt` module.
