#!/usr/bin/env python3
"""
scripts/seed_farmers.py

Idempotent seed/restore of the baseline farmer accounts from a JSON file.
Used when bootstrapping a fresh database (e.g. the Oracle Cloud VM) so the
original 4 test accounts exist with their working bcrypt hashes.

Usage:
    python scripts/seed_farmers.py                # uses data/seed/farmers_seed.json
    python scripts/seed_farmers.py --file my.json
"""

import argparse
import json
import sys
from pathlib import Path

import sqlalchemy

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.database import Base, engine, SessionLocal  # noqa: E402
from app.models.farmer import Farmer                # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file",
        type=Path,
        default=ROOT / "data" / "seed" / "farmers_seed.json",
    )
    args = parser.parse_args()

    rows = json.loads(args.file.read_text())

    # Ensure tables exist (fresh DB / first boot).
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Skip already-present phone numbers so this is safe to re-run after
        # a failed partial restore.
        existing = {
            phone for (phone,) in db.query(Farmer.phone_number).all()
        }
        inserted = skipped = 0
        for row in rows:
            if row["phone_number"] in existing:
                skipped += 1
                continue
            db.add(
                Farmer(
                    name=row["name"],
                    phone_number=row["phone_number"],
                    hashed_password=row["hashed_password"],
                )
            )
            inserted += 1
        db.commit()
        print(
            f"Seeded {inserted} farmer(s) ({skipped} already present) — "
            f"table now has {db.query(Farmer).count()} rows."
        )
    except sqlalchemy.exc.SQLAlchemyError as exc:
        db.rollback()
        raise SystemExit(f"Seeding failed (rolled back): {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()