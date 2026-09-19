# Valam AI — Oracle Cloud production deployment runbook

End-to-end guide to run the backend on Oracle Cloud **Always Free** (Ampere A1,
4× ARM cores, 24 GB RAM). It assumes you already have an OCI tenancy and want
a public `https://` API with daily backups and basic monitoring.

> Where this runbook says **"you"**, it's a step you must do in the OCI Console
> (or provide me the access and I'll carry it out).

---
## 0. Architecture (one VM, one process — deliberately)

```
 Farmers (Play Store app / web)
   │  HTTPS
   ▼
 nginx (443, TLS via Let's Encrypt)      ← only 22/80/443 open in Security List
   │  proxy to 127.0.0.1:8000
   ▼
 uvicorn (1 worker)  →  FastAPI app
   ├── .env                        (secrets; never committed)
   ├── valam.db  (SQLite WAL)      ← daily VACUUM INTO backup
   └── logs/backend.log            (rotating; admin/logs endpoint)
```

**Why one worker / SQLite**: <100 users, ML inference is the real cost, and a
single process keeps rate-limit counters + the single-writer DB simple. The
code path is already PostgreSQL-ready (just change `DATABASE_URL`) when you
actually need replicas.

---
## 1. Create the VM (OCI Console — one-time, you)

1. **Region**: pick a home region or one near users (e.g. `ap-mumbai-1`).
   Always Free resources are region-locked — spawning in the home region is
   easiest.
2. **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04** (aarch64); shape: **VM.Standard.A1.Flex**
     with **4 OCPU / 24 GB**.
   - Networking: a VCN with internet access.
   - **Add your SSH public key** (`~/.ssh/id_ed25519.pub`).
3. **Security List** (VCN → your subnet → default security list):
   Add ingress for **TCP 22, 80, 443** from `0.0.0.0/0`. Nothing else.
4. Note the **public IP**. You'll use it right after boot.

Send me (a) the public IP, (b) your SSH key name / key file path, and (c) the
`ubuntu` user details, and I'll run §2–§8 for you — or follow §2–§8 yourself.

---
## 2. Connect + bootstrap the OS

```bash
ssh -i ~/.ssh/<key> ubuntu@<PUBLIC_IP>
sudo bash -c 'cd /tmp && curl -fsSL <your-repo-raw>/deploy/setup_vm.sh -o setup.sh && bash setup.sh'
```

If the repo isn't hosted anywhere, copy `deploy/setup_vm.sh` up directly:
```bash
scp -i ~/.ssh/<key> deploy/setup_vm.sh ubuntu@<PUBLIC_IP>:/tmp/ && \
ssh -i ~/.ssh/<key> ubuntu@<PUBLIC_IP> 'sudo bash /tmp/setup_vm.sh'
```

This installs ffmpeg, nginx, certbot, sqlite3, creates the `valamuser` +
`/opt/valam/backend` layout, builds the venv from `requirements.txt`, and
pre-downloads the Whisper weights.

---
## 3. Ship the code + models + seed data

From your laptop (excludes venv/db/logs/python PC noise):
```bash
rsync -av --delete --exclude='venv' --exclude='valam.db*' --exclude='logs' \
  --exclude='app/temp_uploads' --exclude='__pycache__' \
  backend/ ubuntu@<PUBLIC_IP>:/tmp/valam-upload/
ssh ubuntu@<PUBLIC_IP> 'sudo rsync -a --delete /tmp/valam-upload/ /opt/valam/backend/ &&
  sudo chown -R valamuser:valamuser /opt/valam'
```
(`--delete` keeps the VM copy mirrored to the repo; keep `valam.db*` out so a
VM DB is never clobbered by a stale local one.)

---
## 4. Secrets: backend/.env (+ .env.example reference)

Create `/opt/valam/backend/.env` **(valamuser-owned, mode 600)** — the app
refuses to start without `SECRET_KEY`. Model it on `backend/.env.example`:

```bash
sudo -u valamuser bash -c 'cat > /opt/valam/backend/.env <<EOF
SECRET_KEY=<long random — python -c "import secrets;print(secrets.token_urlsafe(64))">
WEATHER_API_KEY=<openweather api key>
CORS_ORIGINS=https://app.valam.in,https://admin.valam.in,http://localhost:5173
DATABASE_URL=
ADMIN_ACCESS_KEY=<long random string for the /admin/logs endpoint>
LOGIN_RATE_PER_MINUTE=5/minute
VOICE_RATE_PER_MINUTE=10/minute
PREDICT_RATE_PER_MINUTE=25/minute
# Disables Swagger/docs in prod; also documented in app.main docs_url.
ENVIRONMENT=production
WHISPER_MODEL_SIZE=base
DEFAULT_VOICE_LANGUAGE=ta
EOF
chmod 600 /opt/valam/backend/.env'
```
> `CORS_ORIGINS` must include your **real production origin(s)**; localhost
> entries are dev-only.

---
## 5. App as a persistent service

```bash
sudo cp deploy/valam-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now valam-backend
sudo systemctl status valam-backend            # running?
curl -s http://127.0.0.1:8000/api/v1/health    # {"status":"ok",...}
```

Survives reboots and crashes (`Restart=always`). Logs → `journalctl -u valam-backend`.

---
## 6. Seed the baseline farmer accounts

```bash
sudo -u valamuser /opt/valam/backend/venv/bin/python /opt/valam/backend/scripts/seed_farmers.py
```
Idempotent; recreates the original 4 accounts (with their bcrypt hashes) from
`data/seed/farmers_seed.json` without touching existing rows.

---
## 7. Reverse proxy + HTTPS (Let's Encrypt)

```bash
sudo cp deploy/nginx-valam.conf /etc/nginx/sites-available/valam
# edit server_name in that file to your real domain first!
sudo ln -sf /etc/nginx/sites-available/valam /etc/nginx/sites-enabled/valam
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Domain A record → <PUBLIC_IP>  (point api.valam.in at the VM)
sudo certbot --nginx -d api.valam.in          # auto-adds a TLS 443 block
# renew automatically (certbot.timer) + test:
sudo certbot renew --dry-run
```

Public URLs afterwards:
```
https://api.valam.in/api/v1/health
```
> `/docs` and `/redoc` are **intentionally disabled** in production
> (`ENVIRONMENT=production`) — the Swagger surface is for local dev only.

---
## 8. Takeaways to test from OUTSIDE your network

```bash
curl -s https://api.valam.in/api/v1/health
curl -s -o /dev/null -w '%{http_code}\n' -F image=@photo.jpg https://api.valam.in/api/v1/predict/disease
curl -s -o /dev/null -w '%{http_code}\n' -F audio=@note.m4a https://api.valam.in/api/v1/voice/query
```

---
## 9. Backups (daily, automatic)

```bash
sudo cp deploy/backup/valam-backup.sh /usr/local/bin/valam-backup.sh
sudo chmod +x /usr/local/bin/valam-backup.sh
sudo crontab -e          # add the line from deploy/backup/cron.example
sudo /usr/local/bin/valam-backup.sh        # first run / smoke test
```

- Snapshot = `VACUUM INTO` (online-safe, no downtime), gzipped,
  kept 30 days in `/opt/valam-backups/`.
- Optional: ship each snapshot to **Oracle Object Storage free tier** (see
  `deploy/backup/RESTORE.md` §Object Storage) so backups survive VM loss.
- Restore = copy one file back + `PRAGMA integrity_check` — full guide in
  **`deploy/backup/RESTORE.md`** (read it now, not at 2am).

---
## 10. Logs & monitoring

- Logs: `/opt/valam/backend/logs/backend.log` (rotated, 5 MB × 5).
  `journalctl -u valam-backend` for the systemd view (incl. stdout).
- Quick error check without SSH/root:
  ```bash
  curl -H 'X-Admin-Key: <ADMIN_ACCESS_KEY>' \
       'https://api.valam.in/api/v1/admin/logs?lines=500&level=ERROR'
  ```
- **UptimeRobot** (free tier, 50 monitors, 5-min checks, email/Telegram
  alerts): monitor `https://api.valam.in/api/v1/health` expecting HTTP 200.

---
## 11. Updating the app

```bash
# 1. rsync new code (or git pull) into /opt/valam/backend   (same as §3)
# 2. if requirements.txt changed:
sudo -u valamuser /opt/valam/backend/venv/bin/pip install -r /opt/valam/backend/requirements.txt
# 3. restart
sudo systemctl restart valam-backend
# 4. sanity
curl -s https://api.valam.in/api/v1/health
```

Rollback = re-rsync the previous tag and restart. Register both dirs in git.

---
## 12. Cost / capacity reality check

Always Free, forever, at this footprint: 4× OCPU / 24 GB ARM VM, 30 days of
DB snapshots on local disk, Object Storage bucket, 50 UptimeRobot monitors.
**Total monthly cost: ₹0 / $0.**