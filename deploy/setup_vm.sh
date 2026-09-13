#!/usr/bin/env bash
#
# setup_vm.sh — bootstraps an Oracle Cloud "Always Free" Ampere A1 VM
# (Ubuntu 24.04 Linux/ARM64) with everything the Valam AI backend needs:
#
#   system packages  → python venv → pip deps → Whisper weight cache
#
# WHAT IT DOES NOT DO (deliberately — needs your input, see deploy/README.md):
#   * copy the app code        (rsync from your machine or git clone)
#   * create backend/.env      (secrets + domain)
#   * install the systemd unit / nginx / certbot HTTPS
#
# RUN:  sudo bash deploy/setup_vm.sh
#
set -euo pipefail

APP_USER="${VALAM_USER:-valamuser}"
APP_DIR="${APP_DIR:-/opt/valam/backend}"
WHISPER_MODEL="${WHISPER_MODEL_SIZE:-base}"

echo "==> apt packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    python3 python3-venv python3-pip \
    ffmpeg flac               \
    sqlite3                  \
    nginx certbot python3-certbot-nginx \
    git curl ca-certificates unzip

echo "==> app user $APP_USER with deploy dir"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash --home-dir /home/"$APP_USER" "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$(dirname "$APP_DIR")"

echo "==> python venv (Linux/ARM64 wheels — requirements.txt covers torch CPU)"
if [ ! -d "$APP_DIR/venv" ]; then
    sudo -u "$APP_USER" python3 -m venv "$APP_DIR/venv"
fi
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --upgrade pip wheel
# requirements.txt pins everything incl. the torch CPU extra-index-url.
# NOTE: python3.12+ → torch version from requirements (2.13.0) has aarch64
# manylinux wheels, so this resolves from the pinned extra index as-is.
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

echo "==> whisper model cache (download the base weights once, as $APP_USER)"
sudo -u "$APP_USER" bash -c "$APP_DIR/venv/bin/python -c 'import whisper; whisper.load_model(\"$WHISPER_MODEL\")'"

echo ""
echo "==> DONE. Next steps (deploy/README.md):"
echo "    1. copy app code  → $APP_DIR    (rsync or git)"
echo "    2. create backend/.env            (SECRET_KEY etc. — REQUIRED)"
echo "    3. install systemd unit + start service"
echo "    4. nginx site + certbot HTTPS"
echo "    5. seed DB (scripts/seed_farmers.py) + test /health"