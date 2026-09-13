# Valam AI

AI farmer assistant — monorepo of two separate services:

- **`backend/`** — FastAPI pure-API server (ML/DL models, voice pipeline, auth).
  Runs on `127.0.0.1:8000` by default. See [`backend/README.md`](backend/README.md).
- **`frontend/`** — React + Vite web app. Runs on `localhost:5173` via `npm run dev`.
  Talks to the backend over its REST API at `VITE_API_BASE_URL` (see
  `frontend/.env`, default `http://localhost:8000`).

The two are fully decoupled: the backend never serves the frontend, so a future
Flutter app can replace `frontend/` without touching the backend. Set
`CORS_ORIGINS` in the backend env to allow additional frontend domains.