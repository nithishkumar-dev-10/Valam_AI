"""
app/routers/admin.py

Protected utility endpoints for the deployment VM. Gated on ADMIN_ACCESS_KEY:
if the env var is unset the router simply isn't mounted (404).

Usage (on the VM):
    curl -H 'X-Admin-Key: <ADMIN_ACCESS_KEY>' http://localhost:8000/api/v1/admin/logs?lines=100

"""

import os
import re
from collections import deque

from fastapi import APIRouter, Header, HTTPException, Query

from app.config import ADMIN_ACCESS_KEY, LOG_FILE

router = APIRouter(prefix="/admin", tags=["Admin"])

_valid_level_re = re.compile(r"^(DEBUG|INFO|WARN|ERROR|CRITICAL)$", re.IGNORECASE)


def _require_admin(x_admin_key: str):
    if not ADMIN_ACCESS_KEY or x_admin_key != ADMIN_ACCESS_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get(
    "/logs",
    summary="Read recent backend log lines",
    description=(
        "Returns the most recent log lines from `backend/logs/backend.log`.\n\n"
        "Requires the `X-Admin-Key` header. If `ADMIN_ACCESS_KEY` is unset on "
        "the server the endpoint does not exist (`404`)."
    ),
    responses={403: {"description": "Missing/wrong X-Admin-Key"}},
)
def read_logs(
    x_admin_key: str = Header(..., description="Must match ADMIN_ACCESS_KEY env var on the server"),
    lines: int = Query(100, ge=1, le=2000, description="Number of tail lines to return"),
    level: str | None = Query(
        None,
        description="Optional level filter (DEBUG/INFO/WARN/ERROR/CRITICAL)",
    ),
):
    _require_admin(x_admin_key)

    if not LOG_FILE.exists():
        return {"lines": 0, "level_filter": level, "log": []}

    # Efficient tail read (deque O(n) in worst case, n=2000 max is fine)
    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
        tail = deque(f, maxlen=2000)

    if level:
        if not _valid_level_re.match(level):
            raise HTTPException(status_code=400, detail=f"Invalid level '{level}'. Use: DEBUG/INFO/WARN/ERROR/CRITICAL")
        level_upper = level.upper()
        tail = deque(line for line in tail if f"| {level_upper:<8s}" in line or f"| {level_upper} " in line)

    tail = deque(list(tail)[-lines:])  # apply lines cap *after* filtering

    return {"lines": len(tail), "level_filter": level, "log": "".join(tail)}