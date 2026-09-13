"""
app/utils/logger.py

Central logging configuration. Configures the ROOT logger so every module
(main, routers, services, SQLAlchemy, slowapi, uvicorn) writes to:

  * backend/logs/backend.log       — RotatingFileHandler (5 MB x 5 backups,
                                     so disk use stays bounded)
  * stdout                         — StreamHandler (captured by systemd/journald)

Import with: from app.utils.logger import logger
Use `logger.info(...) / .warning(...) / .exception(...)` — no bare prints.

TODO(launch): if you set up UptimeRobot-style heartbeat FAIL counting here,
instead of pinging the health endpoint, wire it to a metrics increment —
out of scope for v1.
"""

import inspect
import logging
from logging.handlers import RotatingFileHandler

from app.config import LOG_DIR, LOG_FILE

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"


def _configure_handlers() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT)

    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,   # 5 MB
        backupCount=5,              # backend.log.1 ... backend.log.5
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.INFO)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(file_handler)
    root.addHandler(stream_handler)


def get_logger() -> logging.Logger:
    """Return a child logger named after the calling module, e.g. app.routers.voice."""
    frame = inspect.currentframe()
    try:
        module = inspect.getmodule(frame.f_back).__name__
    except Exception:  # noqa: BLE001
        module = "valam_ai"
    finally:
        del frame
    return logging.getLogger(module)


# Configure once at import.
_configure_handlers()

logger = get_logger()