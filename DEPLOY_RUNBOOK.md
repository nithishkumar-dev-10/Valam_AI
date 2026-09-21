# Valam AI — production deploy runbook (Play Store launch)

This is the single end-to-end path from "code on my laptop" to "app live on Play
Store". It supersedes nothing — `deploy/README.md` remains the deep OCI/systemd
reference; this file is the launch-day checklist and adds the **Docker path**.

Legend: 🧑 = account-holder action (Nithish) · 💻 = can be done from this repo.

> **Verification status:** the Docker path here has **not been run** — this machine
> has no Docker daemon. Treat the compose/Dockerfile commands as reviewed-but-untested
> and smoke-test them on the VM (or locally after installing Docker) before relying
> on them. The systemd path in `deploy/README.md` was the original plan and is
> equally untested end-to-end from here.

---

## 0. Prerequisites

| Thing | Status |
|---|---|
| OCI Always Free tenancy | 🧑 needed |
| Ubuntu 24.04 ARM VM (A1.Flex 4 OCPU/24 GB) | 🧑 create (deploy/README §1) |
| Domain `valam.in` with DNS access | 🧑 needed |
| `api.valam.in` A record → VM IP | 🧑 |
| `app.valam.in` A record → VM IP (web PWA/host + Capacitor origin) | 🧑 |
| OpenWeatherMap API key | 🧑 |
| Google Play Console account ($25 one-time) | 🧑 |
| Android Studio (for the final signed AAB) | 🧑 |
| Docker installed locally to test the image | optional 💻 |

---

## 1. Provision + bootstrap the VM

Follow **`deploy/README.md` §1–§2** (create VM, open only 22/80/443, run
`deploy/setup_vm.sh`). That installs nginx, certbot, ffmpeg, creates `valamuser`
+ `/opt/valam/backend`, and pre-downloads Whisper weights.

---

## 2. Get the code onto the server

```bash
# from your laptop
rsync -av --delete \
  --exclude='venv' --exclude='valam.db*' --exclude='logs' \
  --exclude='app/temp_uploads' --exclude='__pycache__' \
  --exclude='app/static/voice_responses' \
  backend/ ubuntu@<VM_IP>:/tmp/valam-upload/
ssh ubuntu@<VM_IP> 'sudo rsync -a --delete /tmp/valam-upload/ /opt/valam/backend/ && \
  sudo chown -R valamuser:valamuser /opt/valam'
```

`frontend/` is **not** deployed to this VM unless you also want the web app
(§7). The Android app is a Play artifact, not a server file.

---

## 3. Secrets — `backend/.env`

Create `/opt/valam/backend/.env` (owner `valamuser`, mode 600). Start from
`backend/.env.example`. Production values that **must** differ from dev:

```bash
SECRET_KEY=<python -c "import secrets;print(secrets.token_urlsafe(64))">
WEATHER_API_KEY=<openweather key>
ADMIN_ACCESS_KEY=<python -c "import secrets;print(secrets.token_urlsafe(32))">  # ≥32 chars or startup fails
CORS_ORIGINS=https://app.valam.in,https://admin.valam.in
ENVIRONMENT=production          # disables /docs + /redoc
REFRESH_COOKIE_SECURE=true      # HTTPS only
REFRESH_COOKIE_SAMESITE=lax     # api.valam.in ↔ app.valam.in are same-site
WHISPER_MODEL_SIZE=base
DEFAULT_VOICE_LANGUAGE=ta
# DATABASE_URL=                 # empty = SQLite; set for Postgres (see §5B)
UVICORN_WORKERS=1               # MUST be 1 on SQLite; 2+ only on Postgres
```

```bash
sudo chmod 600 /opt/valam/backend/.env
```
> Do **not** keep `http://localhost:5173` in production `CORS_ORIGINS`.

---

## 4. Choose your runtime path

| | Path A — Docker Compose | Path B — systemd venv |
|---|---|---|
| Best for | reproducibility, Postgres, multiple workers | simplest, lowest RAM, matches original plan |
| DB | Postgres 16 container | SQLite (default) |
| Files | `backend/Dockerfile`, `docker-compose.yml` | `deploy/valam-backend.service` |
| Workers | 2 (safe w/ Postgres) | 1 (SQLite) |

Pick **one**. Do not run both against the same DB.

### Path A — Docker Compose (recommended)

```bash
# on the VM, after installing docker + compose plugin
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# copy the repo (or at least backend/, frontend/, docker-compose.yml)
cd /opt/valam
# set a REAL secret for compose (do not use the dev default)
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env.compose
WEATHER_API_KEY=<key> docker compose --env-file .env.compose up -d --build

docker compose ps
curl -s http://127.0.0.1:8000/api/v1/health
```

`docker-compose.yml` also starts Postgres and (optionally) the SPA on :8080.
In production, put nginx/TLS **in front** of the backend port; you can drop the
`frontend` service if the VM only serves the API, or keep it and reverse-proxy
:443 → :8080.

### Path B — systemd (original plan)

Follow **`deploy/README.md` §3–§5**. Summary:

```bash
sudo cp deploy/valam-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now valam-backend
curl -s http://127.0.0.1:8000/api/v1/health
```

---

## 5. Database init + seed

There are **no migrations** — the schema is created on startup by
`Base.metadata.create_all` (`backend/app/main.py:48`). Tables appear the first
time the app boots, for both SQLite and Postgres.

```bash
# Path A
docker compose exec backend python scripts/seed_farmers.py     # optional baseline accounts

# Path B
sudo -u valamuser /opt/valam/backend/venv/bin/python /opt/valam/backend/scripts/seed_farmers.py
```

Idempotent. If you later introduce schema changes, you must add Alembic or
handle `create_all`'s add-only semantics explicitly (it will **not** alter
existing columns).

---

## 6. Reverse proxy + HTTPS

```bash
sudo cp deploy/nginx-valam.conf /etc/nginx/sites-available/valam
# edit server_name → api.valam.in
sudo ln -sf /etc/nginx/sites-available/valam /etc/nginx/sites-enabled/valam
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.valam.in
sudo certbot renew --dry-run
```

If you also serve the SPA/PWA from this VM, add a second server block for
`app.valam.in` pointing at the frontend container (:8080) or `frontend/dist`,
and `certbot -d app.valam.in`.

---

## 7. Health check from outside

```bash
curl -s https://api.valam.in/api/v1/health
curl -s -o /dev/null -w '%{http_code}\n' -F image=@photo.jpg https://api.valam.in/api/v1/predict/disease
curl -s -o /dev/null -w '%{http_code}\n' -F audio=@note.m4a  https://api.valam.in/api/v1/voice/query
```
Expect `200` / `200` / `200` (the ML calls need a real image/audio). Add an
UptimeRobot monitor on `/api/v1/health` (expect 200).

---

## 8. Android build → Play upload 🧑

```bash
# 1. ONCE, on the signing machine, from the REPO ROOT. Generates
#    ~/valam-keystore/valam-upload.jks + frontend/android/key.properties
#    (both git-ignored). Skip if you already have the keystore.
./scripts/gen_android_keystore.sh

# 2. Build the web bundle, copy it into the Android project, sign the AAB.
cd frontend
npm ci
npm run build                 # bakes VITE_API_BASE_URL=https://api.valam.in
npx cap sync android
cd android && ./gradlew bundleRelease
```

Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
Upload that to **Play Console → Production → Create release**. Full detail:
`playstore/APP_SIGNING.md`. Store copy: `playstore/STORE_LISTING_DRAFT.md`.
Data safety answers: `playstore/DATA_SAFETY_FORM.md`.

🧑 Play Console tasks: create the app (`in.valam.app`), complete
App content (privacy policy URL, data safety, content rating, target audience),
upload screenshots + feature graphic, then submit for review.

---

## 9. Updating later

- **Backend:** rsync new code → `docker compose up -d --build` (or
  `pip install -r requirements.txt && systemctl restart valam-backend`).
- **App:** bump `versionCode`/`versionName` in
  `frontend/android/app/build.gradle`, `npm run build && npx cap sync android`,
  `./gradlew bundleRelease`, upload a new release. **`versionCode` must increase
  every upload.**

---

## 10. Backups & monitoring

See `deploy/README.md` §9–§10. DB snapshot (`VACUUM INTO`, 30-day retention) +
optional Object Storage copy; logs at `logs/backend.log`; UptimeRobot monitor.

---

## 11. Known gaps before you call it "live"

- [ ] Docker path is **untested** (no Docker on the build machine) — smoke-test on the VM.
- [ ] Public `privacy.html` must be hosted at a stable URL (see
      `playstore/PRIVACY_POLICY_HOSTING.md`) and pasted into Play Console.
- [ ] Real icon (512×512, no alpha), feature graphic (1024×500), and screenshots
      must replace the generated placeholders.
- [ ] `versionCode`/`versionName` still at `1` / `1.0`.
- [ ] No Alembic — schema changes are not migrated automatically.
- [ ] Secret rotation plan: `SECRET_KEY`, `ADMIN_ACCESS_KEY`, DB password.
