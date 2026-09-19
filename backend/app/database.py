"""
app/database.py

SQLAlchemy engine + session setup.

Production default: local SQLite file with WAL mode + busy-timeout (zero
external setup, handles concurrent reads and single-worker writes fine at
<100 users).  To switch to PostgreSQL, just set DATABASE_URL in .env —
nothing else changes thanks to SQLAlchemy's dialect abstraction.

WAL pragmas are applied via an engine event listener so they fire regardless
of how the connection is created (including Alembic or CLI tools).
"""

import logging
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL

logger = logging.getLogger("valam_ai.database")

# ---------------------------------------------------------------------------
# Engine kwargs vary by dialect.
# ---------------------------------------------------------------------------
_engine_kwargs: dict = {"echo": False}

if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["pool_pre_ping"] = True
else:
    # PostgreSQL / other RDMS
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10

engine = create_engine(DATABASE_URL, **_engine_kwargs)

# ---------------------------------------------------------------------------
# SQLite-only pragmas: WAL (allows concurrent readers) + busy-timeout so
# concurrent FastAPI threads don't crash immediately on "database is locked".
# Harmless no-ops for non-SQLite dialects (they simply never fire).
# ---------------------------------------------------------------------------
if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        # WAL mode: safe concurrent reads while one writer is active.
        cursor.execute("PRAGMA journal_mode=WAL")
        # Busy-timeout: wait up to 30 s for a write lock instead of failing
        # immediately.  At <100 users writes are rare; this is more than enough.
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    @event.listens_for(engine, "connect")
    def _log_sqlite_version(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        row = cursor.execute("PRAGMA compile_options").fetchall()
        walmode = cursor.execute("PRAGMA journal_mode").fetchone()
        cursor.close()
        opts = {r[0] for r in row}
        logger.info(
            "SQLite connected — WAL mode=%s, FTS5=%s, JSON=%s",
            walmode[0] if walmode else "?",
            "ENABLE_FTS5" in opts,
            "ENABLE_JSON1" in opts,
        )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency -- yields a DB session, always closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
