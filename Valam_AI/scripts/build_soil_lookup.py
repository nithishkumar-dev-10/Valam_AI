"""
Compatibility script.

The old coordinate-grid approach is intentionally removed. There is no
raw_district_soil_data.csv in this project, so this script must not fabricate
0.1-degree soil cells.

The new runtime reads data/state_soil_index.csv.
"""


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SOIL_INDEX = BASE_DIR / "data" / "state_soil_index.csv"


def build_lookup():
    if not SOIL_INDEX.exists():
        raise FileNotFoundError(SOIL_INDEX)
    print(f"Using state nutrient index: {SOIL_INDEX}")
    print("No guessed coordinate-grid soil values are generated.")


if __name__ == "__main__":
    build_lookup()
