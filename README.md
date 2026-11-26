# Valam AI

AI farmer assistant — a FastAPI backend plus a React/Vite frontend:

- **`backend/`** — FastAPI service (ML/DL models, voice pipeline, auth, and the
  built web app). Listens on `$PORT` (default `8080`; docker compose maps that
  to host `127.0.0.1:8000`). Config + deploy: `backend/.env.example`
  and [`docs/DEPLOY_RUNBOOK.md`](docs/DEPLOY_RUNBOOK.md).
- **`frontend/`** — React + Vite web app. Runs on `localhost:5173` via `npm run dev`
  (Vite proxies `/api` to `localhost:8000`). `npm run build` writes `frontend/dist`,
  which FastAPI serves at `/` with an SPA fallback for client-side routes.

In production the API and web app share one origin, e.g.
`https://valam-ai.onrender.com`: the bundle calls relative `/api/v1` paths, so
no CORS preflight or `VITE_API_BASE_URL` is needed. `CORS_ORIGINS` is still used
for genuinely cross-origin clients (Capacitor/WebView, separate admin app).
To deploy on Render, run the build from the **repo root**:
`npm --prefix frontend ci && npm --prefix frontend run build && pip install -r backend/requirements.txt`,
then start with `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

The `backend/Dockerfile` uses `backend/` alone as its build context and does not
bake in `frontend/dist`; for a single-origin image deploy, copy/mount the built
`frontend/dist` into the container and point `FRONTEND_DIST_DIR` at it (or use
the Render steps above). Without a build, the backend still serves `/api/*`
and a small liveness response at `/`.
