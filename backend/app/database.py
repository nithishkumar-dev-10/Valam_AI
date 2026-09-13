"""
app/database.py

SQLAlchemy engine + session setup. Defaults to a local SQLite file
(valam.db) so there's zero external setup for development. For real
deployment, set DATABASE_URL in .env to a free-tier hosted Postgres
(e.g. Neon: https://neon.tech) -- no other code needs to change.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL

# SQLite needs this flag for use with FastAPI's threaded request handling.
# Postgres/MySQL ignore it -- harmless either way.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency -- yields a DB session, always closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
