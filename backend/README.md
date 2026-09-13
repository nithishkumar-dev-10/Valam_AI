# Valam AI — Backend

FastAPI backend for **Valam AI**, an AI farmer assistant (crop recommendation, leaf-disease
detection, weed/pest detection, voice interface). The React frontend that talks to this API
lives in the sibling repo/folder: `../frontend`. The backend is a **pure API server** — it
does not serve the frontend; any client (web, or a future Flutter app) calls it over HTTP.

## Quickstart

```bash
# from this backend/ folder
cp .env.example .env            # then fill in WEATHER_API_KEY / SECRET_KEY if needed

# OpenMP/MKL/BLAS thread knobs keep Apple-Silicon torch stable (required):
KMP_DUPLICATE_LIB_OK=TRUE OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 \
  venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- The frontend dev server (`.` `npm run dev`, port 5173) is allowed by CORS via
  the `CORS_ORIGINS` env var (comma-separated). Add production domains without a code
  change: `CORS_ORIGINS=https://app.example.com venv/bin/uvicorn ...`
- Voice recognition uses OpenAI Whisper. The default is the `tiny` model (fast). For
  accurate Tamil speech set: `WHISPER_MODEL_SIZE=base`.
- `.env` is your local config (gitignored); `.env.example` documents every key.

## Main endpoint: `POST /voice/query`

One unified, multimodal pipeline that decides which models to run from intent:

| Field       | Type    | Required | Notes                                           |
|-------------|---------|----------|-------------------------------------------------|
| `audio`     | file    | no       | WAV/MP3; ASR auto-detects language              |
| `image`     | file    | no       | JPG/PNG leaf photo                              |
| `latitude`  | number  | no       | GPS, used by the crop recommender               |
| `longitude` | number  | no       | GPS                                            |
| `lang`      | string  | no       | `"ta"` / `"en"` — overrides detected language    |

Response: `text_response` (natural-language summary in the reply language),
`results[]` (one entry per model that ran, including `confidence_label`,
`data_resolution`, `data_quality_note`), `audio_url` (absolutely-addressable
gTTS MP3 under `/static/voice_responses/`), plus typed
`crop_result` / `disease_result` / `pest_result` siblings (null if not run).
No auth is required — the assistant stays zero-friction for farmers.

## Optional Auth (phone + password, JWT)

Kept optional on purpose: nothing besides `/auth/me` is gated, so farmers can
use the assistant without an account. Only when sign-up/login is used:

| Endpoint        | Body                            | Returns                               |
|-----------------|---------------------------------|---------------------------------------|
| `POST /auth/signup` | JSON `{ name, phone_number, password }` | `FarmerOut` (201; no hash/password) |
| `POST /auth/login`  | form-encoded `username` (phone) + `password` | `{ access_token, token_type }` |
| `GET /auth/me`      | `Authorization: Bearer <jwt>`   | `FarmerOut` (protected via `get_current_farmer`) |

- Passwords are bcrypt-hashed (passlib); never stored or returned in plaintext.
- Tokens are JWT (`sub` = farmer id, `exp` from `ACCESS_TOKEN_EXPIRE_MINUTES`).
- `app/auth/jwt_handler.py::get_current_farmer` protects any future route by
  dropping `farmer = Depends(get_current_farmer)` into its signature.
- To add OTP later, the model already keys on `phone_number` — an SMS gateway
  + OTP field would slot in without changing the table.

## Models

| Model             | Task                     | Artifact                  | Val. accuracy (leak-safe) |
|-------------------|--------------------------|---------------------------|---------------------------|
| `crop_recommender`| Crop suggestion (tabular)      | `app/ml_models/crop_recommender.pkl` | 99.55% (20% holdout) |
| `disease_cnn`     | Leaf disease (MobileNetV2)      | `app/ml_models/disease_cnn.pt`      | 99.00% (group split) |
| `deepweeds_model` | Weed class (ResNet18)           | `app/ml_models/deepweeds_model.pt`  | 86.77% (test split)  |
| `pest_model`      | Pest class (MobileNetV2)        | `app/ml_models/pest_model.pt`       | 89.07% (holdout)     |

Full per-class reports + confusion matrices: `reports/evaluation_summary.json`
(reproduce with `venv/bin/python scripts/evaluate.py --model all`).

### Disease metric note (honesty about earlier numbers)

The first disease training reported 99.75% validation by splitting images randomly —
but PlantVillage contains many near-duplicate pictures of the *same* plant, so that
split leaked same-plant crops across train/validation. After switching to a
**plant-group split** (`scripts/prepare_plantvillage_split.py`, images from the same
plant/session never span train and val) the retrained model reports **99.27% train /
99.00% val**, and the independent eval above reproduces the 99.00% on those held-out
groups (macro-F1 98.57%, class-accuracy floor 83% on the smallest class).

## Layout

```
app/
  main.py          FastAPI app: routers, CORS (env-driven), /static mount
  config.py        env config incl. CORS_ORIGINS
  routers/voice.py one endpoint for the whole multimodal pipeline
  services/dl/     ASR, intent parser, model pipeline, each model service
  ml_models/       trained artifacts + class lists
  schemas/         request/response models (incl. the frontend contract)
  models/          SQLAlchemy models (farmer auth placeholder)
scripts/           training + evaluation + data-prep entrypoints
data/              raw datasets (gitignored)
reports/           evaluation_summary.json
```

Training scripts: `scripts/train_crop_model.py`, `train_disease_model.py`,
`train_deepweeds_model.py`, `train_pest_model.py`. Evaluation:
`scripts/evaluate.py [--model crop|disease|deepweeds|pest|all]`.