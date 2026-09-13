# Restore guide — Valam AI database

**You are probably here because production data is missing or the app 500s on DB access.
Follow this top-to-bottom. Test it once now, not at 2am for the first time.**

---
## TL;DR (if you're in a hurry)

```bash
# 1. Find the newest good snapshot
ls -lt /opt/valam-backups/*.db.gz

# 2. Extract it
gunzip -k <newest-backup>.db.gz        # creates <newest-backup>.db

# 3. Restore (one atomic move — safe even with the service running)
sudo systemctl stop valam-backend
sudo cp <newest-backup>.db /opt/valam/backend/valam.db
sudo systemctl start valam-backend

# 4. Verify
curl -s https://<your-domain>/api/v1/health          # → {"status":"ok", ...}
curl -s -o /dev/null -w '%{http_code}' <domain>      # expect 200
```

That is the entire procedure for a full restore.

---
## When to restore from a backup vs fix forward

| Symptom | Action |
|---------|--------|
| Farmers can't log in (DB *open* but looks wrong/partial) | Restore newest backup, or re-seed with `scripts/seed_farmers.py` |
| App won't start; `valam.db` corrupt / `database disk image is malformed` | **Restore** (repair-in-place is rarely worth it) |
| Data missing but no corruption (e.g. accidental DELETE) | Restore backup taken *before* the incident |
| Only a couple of accounts were deleted recently | Cheapest is `sqlite3 valam.db` manual INSERT from a backup — but if unsure, full restore |

---
## Decide which snapshot

```bash
ls -lt /opt/valam-backups/
#       ^ sort by mtime descending → newest first
# Pick the newest .db.gz that PREDATES the incident.
# If you don't know when the incident happened, pick the newest one and accept
# losing only the writes in the last ~24h (daily schedule).
```

---
## Steps (detailed)

1. **SSH in** as your normal user, then `sudo -i`.

2. **Pick a snapshot** (see above). Save its full path:
   ```bash
   SNAP=/opt/valam-backups/valam-20260913-031700.db.gz
   ```

3. **Stop the app** (avoids any in-flight writes during the swap):
   ```bash
   systemctl stop valam-backend
   ```

4. **Sanity-check the snapshot before trusting it**:
   ```bash
   gunzip -c "$SNAP" > /tmp/valam-restore.db
   sqlite3 /tmp/valam-restore.db "PRAGMA integrity_check;"          # must print: ok
   sqlite3 /tmp/valam-restore.db "SELECT COUNT(*) FROM farmers;"    # sanity row count
   ```

5. **Swap the file in** — remove WAL/SHM leftovers of the old copy too, so a
   stale `-wal` can't resurrect the broken DB:
   ```bash
   APP=/opt/valam/backend
   cp /tmp/valam-restore.db "$APP/valam.db"
   rm -f "$APP/valam.db-wal" "$APP/valam.db-shm"
   chown valamuser:valamuser "$APP/valam.db"    # match your service user
   ```

6. **Start & verify**:
   ```bash
   systemctl start valam-backend
   sleep 3
   curl -s http://127.0.0.1:8000/api/v1/health
   # expect: {"status":"ok","service":"valam-ai-backend",...,"database":"ok","database":"ok"...}
   journalctl -u valam-backend --no-pager -n 20   # no tracebacks
   ```

7. **Confirm logins work** (a real read against the DB):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST <domain>/api/v1/auth/login \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'username=<a known phone>&password=<known password>'
   # expect 200. (401 = wrong password given, but still proves DB reads fine.)
   ```

8. **Tell users / log it**: note the incident + snapshot used in `/var/log/valam-backup.log` or a runbook note for the team.

---
## If you must repair forward (no good backup)

Accounts only — the idempotent seed script recreates the original 4 test
farmers but **not** the passwords on disk (hashes are preserved):

```bash
cd /opt/valam/backend
sudo -u valamuser .venv/bin/python scripts/seed_farmers.py
```

(It won't overwrite phone numbers that already exist, so it's safe to re-run.)

---
## Testing the restore (do this once, calmly, before launch)

```bash
# Boot a scratch copy of the DB on a THROWAWAY path, run the API off it:
cd /tmp && cp /opt/valam/backend/valam.db /tmp/testrestore.db
DATABASE_URL="sqlite:////tmp/testrestore.db" \
  .venv/bin/python scripts/seed_farmers.py        # idempotent: prints "0 already present"
```
If that prints rows "already present" and counts match, your restore path is sound.

---
## Object Storage (free tier) — optional extra safety

Backups on the VM die with the VM. For crash-proofing, sync snapshots off-box:

1. Set up OCI CLI + `~/.oci/config` (standard OCI setup).
2. Create a bucket `valam-backups` (Object Storage, free tier: 20 GB standard).
3. Uncomment the `oci os object put` block in `deploy/backup/valam-backup.sh`
   and set `OCI_PROFILE`.
4. Test: `sudo /usr/local/bin/valam-backup.sh` → file lands in the bucket.
5. Restore from Object Storage:
   ```bash
   oci os object get -bn valam-backups --name valam-<TS>.db.gz --file /tmp/valam-restore.db.gz
   gunzip -k /tmp/valam-restore.db.gz
   # then continue at "Steps (detailed)" step 3 above.
   ```