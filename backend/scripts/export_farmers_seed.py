#!/usr/bin/env python3
"""
scripts/export_farmers_seed.py

Export current farmer rows (with bcrypt hashes) to data/seed/farmers_seed.json.
Run after any intentional schema/data change to snapshot the deployment baseline.
Idempotent — overwrites the seed file on each run.
"""

import json
import sys
from pathlib import Path

# Allow running from any working directory.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.database import SessionLocal  # noqa: E402
from app.models.farmer import Farmer    # noqa: E402

SEED_PATH = ROOT / "data" / "seed" / "farmers_seed.json"


def main():
    db = SessionLocal()
    farmers = db.query(Farmer).all()
    data = [
        {
            "name": f.name,
            "phone_number": f.phone_number,
            "hashed_password": f.hashed_password,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in farmers
    ]
    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Exported {len(data)} farmers → {SEED_PATH}")
    db.close()


if __name__ == "__main__":
    main()
