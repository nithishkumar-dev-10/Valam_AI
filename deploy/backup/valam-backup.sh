#!/usr/bin/env bash
#
# valam-backup.sh — automated daily backup for the Valam AI SQLite database.
#
# HOW IT WORKS (and why it's safe with the app running):
#   SQLite's "VACUUM INTO" takes an atomic, consistent snapshot of the live
#   database — no downtime, no "file busy" race, no lock fights with the API.
#   We then gzip and prune old backups, keeping the newest $BACKUP_KEEP.
#
# SETUP (once, on the VM):
#   sudo cp deploy/backup/valam-backup.sh /usr/local/bin/valam-backup.sh
#   sudo chmod +x /usr/local/bin/valam-backup.sh
#   sudo crontab -e     →   add the line from deploy/backup/cron.example
#
# STORAGE OPTIONS:
#   1. Same VM disk (default). Better than nothing; not crash-proof.
#   2. Oracle Object Storage free tier — best. Uncomment the `oci os` lines
#      below after `~/.oci/config` is set up (see deploy/backup/RESTORE.md).
#   3. scp the .db.gz files off the VM occasionally (sanity check).
#
# TEST:  sudo /usr/local/bin/valam-backup.sh && ls -la /opt/valam-backups
#
set -euo pipefail

# --- configuration (overridable via env) ------------------------------------
APP_DIR="${APP_DIR:-/opt/valam/backend}"          # where valam.db lives
BACKUP_DIR="${BACKUP_DIR:-/opt/valam-backups}"    # where snapshots go
BACKUP_KEEP="${BACKUP_KEEP:-30}"                  # daily x 30 = ~1 month
OCI_BUCKET="${OCI_BUCKET:-valam-backups}"         # Object Storage bucket name

# --- snapshot ----------------------------------------------------------------
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT="$BACKUP_DIR/valam-${TIMESTAMP}.db"

mkdir -p "$BACKUP_DIR"

# Refuse to back up a corrupt database — you don't want to archive garbage.
if ! sqlite3 "$APP_DIR/valam.db" "PRAGMA integrity_check;" 2>/dev/null | grep -q "^ok$"; then
    echo "ERROR: integrity_check failed on $APP_DIR/valam.db — backup aborted." >&2
    exit 1
fi

sqlite3 "$APP_DIR/valam.db" "VACUUM INTO '$SNAPSHOT';"
gzip -f "$SNAPSHOT"
SNAPSHOT_GZ="$SNAPSHOT.gz"
echo "backup ok: $(basename "$SNAPSHOT_GZ") ($(du -h "$SNAPSHOT_GZ" | cut -f1))"

# --- prune local copies (keep newest $BACKUP_KEEP) --------------------------
cd "$BACKUP_DIR"
ls -1t valam-*.db.gz 2>/dev/null | sed -n "$((BACKUP_KEEP + 1)),\$p" | while read -r old; do
    rm -f "$BACKUP_DIR/$old"
done

# --- optional: ship a copy to Oracle Object Storage (free tier) --------------
# Requires the OCI CLI + ~/.oci/config. Set OCI_BUCKET above.
if command -v oci >/dev/null 2>&1 && [ -n "${OCI_PROFILE:-}" ]; then
    oci --profile "$OCI_PROFILE" os object put \
        -bn "$OCI_BUCKET" --file "$SNAPSHOT_GZ" --force \
        || echo "WARNING: Object Storage upload failed — snapshot kept locally" >&2
fi

echo "latest backups:"; ls -1t valam-*.db.gz | head -5