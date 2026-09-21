# Backend review findings — open judgment calls & dispositions

Status ledger for the production-readiness review. Each open judgment call lists
what was decided, where it landed, and (where relevant) the trigger to revisit.

## 1. Rate limit on `/predict/*`

**Decision: IMPLEMENT** at 25/min per IP (inside the agreed 20–30 window), via
the same slowapi mechanism the voice endpoint already uses.

- Source: `app/config.py` → `PREDICT_RATE_PER_MINUTE` (default `25/minute`),
  overridable with `PREDICT_RATE_PER_MINUTE` env.
- Applied in `app/routers/crop.py`, `disease.py`, `deep_weed.py`, `pest.py`.
- Note: the CNN inference endpoints share a bucket with the cheap
  `crop-manual` endpoint because they all live under `/predict/*`. If the two
  manual-override endpoints ever get hammered by scripts, split them onto a
  separate limit.

## 2. Rate-limit (429) response body

**Decision: IMPLEMENT** as JSON `{"detail": "Too many requests. Please slow
down and try again."}` — consistent with the API's documented error convention.

- Source: `app/main.py` → `rate_limit_exceeded_handler` (replaces slowapi's
  plain-text default). Rate-limit headers (`Retry-After`, `X-RateLimit-*`) are
  preserved.

## 3. Refresh-token revocation

**Decision: DEFER — should-fix before scaling, not a pre-launch blocker.**

Refresh tokens are stateless (signed JWT, 28-day life). A stolen token stays
valid until expiry; there is no server-side way to kill it. Docs in
`app/routers/auth.py` already call this out. Safe to defer pre-launch at <100
users because:
- breach surface is tiny at this scale,
- Play Store account-deletion (`DELETE /auth/me`) already deletes the user row.

**Revisit BEFORE** scaling (multi-hundred users / real accounts with financial
data). Options, cheapest first:
1. DB-backed refresh-token allowlist (one table, revoke rows on misuse) —
   fits the single-worker SQLite model.
2. Fixed short refresh TTL + aggressive rotation.
3. Redis-backed jti denylist once the deployment is multi-worker.

## 4. Swagger/Redoc exposure in production

**Decision: IMPLEMENT** — `/docs` and `/redoc` are disabled when
`ENVIRONMENT=production` (`app/main.py` sets `docs_url=None, redoc_url=None`).

- The `ENVIRONMENT` var is documented in `.env.example` and the deploy runbook.
- UptimeRobot monitors `/api/v1/health` (not `/docs`), so disabling docs does
  not break monitoring.

## 5. Weather / geocoding cache (TTL)

**Decision: IMPLEMENT** — in-process TTL cache + singleflight in front of
OpenWeather, NASA POWER, and Nominatim to protect free-tier quotas.

- `app/utils/ttl_cache.py` — small asyncio TTL cache with in-flight dedup.
- `app/services/external/weather_fetch.py` — `fetch_weather_features()` cached
  15 min (`WEATHER_CACHE_TTL_SECONDS`, default 900) keyed on coords rounded to 4
  decimals (~11 m): same-village farmers share an entry.
- `app/services/external/geocoding.py` — `reverse_geocode()` cached 24 h
  (`GEOCODE_CACHE_TTL_SECONDS`, default 86400), keyed the same way.
- Failures are never cached; singleflight collapses concurrent duplicates.
- Valid for single-worker uvicorn by design (see `deploy/README.md`); swap for
  a shared Redis cache if the backend ever runs multi-worker.

## 6. Audio duration cap (ffprobe)

**Decision: IMPLEMENT** — reject voice notes longer than
`MAX_AUDIO_DURATION_SECONDS` (default 300 s / 5 min) BEFORE Whisper decodes.

- `app/validation.py` → `_probe_audio_duration()` runs `ffprobe -i pipe:0` on
  the uploaded bytes (header-only, no decode, no temp file); frees/open-skip if
  ffprobe is missing (dev machines without ffmpeg still work).
- Over-limit uploads get `413` with a clear message. Normal farmer notes are
  <30 s, so the cap is generous.
- Note: gTTS output dir retention already caps stored clips; this cap prevents
  the CPU/ASR DoS (a 60-min low-bitrate file that slips the 15 MB size check
  would otherwise force a very long Whisper decode).

## 7. Old TTS clips in git history

**Decision: DEFER** — repo is private; audio clips lingering in history are not
a public leak.

**Revisit ONLY if** the repository is ever made public: `git filter-repo` (or
`filter-branch`) to purge `app/static/voice_responses/*.mp3` + `*.wav` from
history, then rotate any secrets/tokens that were also present in old commits.
Do NOT attempt history rewrites while collaborators share the same clone unless
you can coordinate a forced-push.

---

## Go-live state summary

| # | Item | State |
|---|------|-------|
| 1 | `/predict/*` rate limit | Done (25/min, configurable) |
| 2 | 429 JSON body | Done |
| 3 | Refresh-token revocation | Deferred (revisit before scaling) |
| 4 | Docs off in prod | Done (`ENVIRONMENT=production`) |
| 5 | Weather/geocode TTL cache | Done |
| 6 | Audio duration cap | Done (ffprobe, 300 s default) |
| 7 | TTS clips history cleanup | Deferred (private repo) |