"""
Soil value resolver for GPS-only crop recommendation.

Priority (explicit data resolution chain, Issue 2):
1. district nutrient-index data, when available (finest granularity).
2. state nutrient-index data, when district data is unavailable.
3. training-data median (prototype fallback), when neither matches.

The chain is surfaced to the caller/API as ``data_resolution``
("district" / "state" / "fallback") and ``input_confidence``
("high" / "medium" / "low") so a degraded lookup is never silent.

IMPORTANT:
None of these are field-level soil measurements. Even the best
district-level path only turns a nutrient *index* into representative
training-data quantiles. For production use, replace this with a proper
location-based soil data source or Soil Health Card data.
"""

import logging
from functools import lru_cache
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[3]

INDEX_PATH = BASE_DIR / "data" / "state_soil_index.csv"
DISTRICT_INDEX_PATH = BASE_DIR / "data" / "district_soil_index.csv"
TRAINING_DATA_PATH = BASE_DIR / "data" / "crop_recommendation.csv"


def _level(value: float) -> str:
    """Convert nutrient index into low / medium / high."""

    if value < 1.67:
        return "low"

    if value <= 2.33:
        return "medium"

    return "high"


@lru_cache(maxsize=1)
def _training_values() -> dict:
    """
    Get representative values from the existing crop dataset.

    These values are used only as a prototype fallback when
    neither district nor state-specific soil information is available.

    The input CSV is a static asset, so the parsed result is cached
    (this used to re-read the file on EVERY request — a major cost under
    load, since it runs on the crop-recommendation hot path).
    """

    df = pd.read_csv(TRAINING_DATA_PATH)

    required_columns = {"N", "P", "K", "ph"}

    missing = required_columns - set(df.columns)

    if missing:
        raise RuntimeError(
            "crop_recommendation.csv is missing columns: "
            + ", ".join(sorted(missing))
        )

    return {
        "N": float(df["N"].median()),
        "P": float(df["P"].median()),
        "K": float(df["K"].median()),
        "ph": float(df["ph"].median()),
    }


@lru_cache(maxsize=1)
def _training_quantiles() -> dict:
    """
    Representative low / medium / high N/P/K values
    from the training dataset. Cached (see _training_values docstring).
    """

    df = pd.read_csv(TRAINING_DATA_PATH)

    return {
        feature: {
            "low": float(df[feature].quantile(0.25)),
            "medium": float(df[feature].quantile(0.50)),
            "high": float(df[feature].quantile(0.75)),
        }
        for feature in ("N", "P", "K")
    }


# ---------------------------------------------------------------------------
# State name canonicalization (Issue 3)
#
# Nominatim returns many spellings of the same Indian state / union
# territory. All variants below map to the exact name used in
# data/state_soil_index.csv. If a returned string still doesn't match
# after normalization, the caller must fall back (data_resolution=
# "fallback") instead of failing silently.
# ---------------------------------------------------------------------------
_STATE_ALIASES = {
    # States
    "andhra pradesh": "Andhra Pradesh",
    "ap": "Andhra Pradesh",
    "arunachal pradesh": "Arunachal Pradesh",
    "assam": "Assam",
    "bihar": "Bihar",
    "chhattisgarh": "Chhattisgarh",
    "cg": "Chhattisgarh",
    "goa": "Goa",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "himachal pradesh": "Himachal Pradesh",
    "hp": "Himachal Pradesh",
    "jharkhand": "Jharkhand",
    "karnataka": "Karnataka",
    "kerala": "Kerala",
    "kerela": "Kerala",
    "madhya pradesh": "Madhya Pradesh",
    "mp": "Madhya Pradesh",
    "maharashtra": "Maharashtra",
    "manipur": "Manipur",
    "meghalaya": "Meghalaya",
    "mizoram": "Mizoram",
    "nagaland": "Nagaland",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "orrisa": "Odisha",
    "punjab": "Punjab",
    "rajasthan": "Rajasthan",
    "sikkim": "Sikkim",
    "tamil nadu": "Tamil Nadu",
    "tamilnadu": "Tamil Nadu",
    "telangana": "Telangana",
    "tripura": "Tripura",
    "uttar pradesh": "Uttar Pradesh",
    "up": "Uttar Pradesh",
    "uttarakhand": "Uttarakhand",
    "uttaranchal": "Uttarakhand",
    "west bengal": "West Bengal",
    "bengal": "West Bengal",
    # Union territories
    "andaman and nicobar islands": "Andaman & Nicobar Islands",
    "andaman & nicobar islands": "Andaman & Nicobar Islands",
    "andaman & nicobar": "Andaman & Nicobar Islands",
    "andaman and nicobar": "Andaman & Nicobar Islands",
    "chandigarh": "Chandigarh",
    "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "dadra & nagar haveli & daman & diu": "Dadra and Nagar Haveli and Daman and Diu",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "delhi": "Delhi",
    "national capital territory of delhi": "Delhi",
    "nct of delhi": "Delhi",
    "nct delhi": "Delhi",
    "new delhi": "Delhi",
    "jammu and kashmir": "Jammu & Kashmir",
    "jammu & kashmir": "Jammu & Kashmir",
    "kashmir": "Jammu & Kashmir",
    "ladakh": "Ladakh",
    "lakshadweep": "Lakshadweep",
    "laccadive": "Lakshadweep",
    "puducherry": "Puducherry",
    "pondicherry": "Puducherry",
    "pondichery": "Puducherry",
}


def _canonical_state(state: str) -> str:
    """Normalize common state-name variations to the CSV spelling."""
    cleaned = " ".join(state.strip().split())
    return _STATE_ALIASES.get(cleaned.casefold(), cleaned)


def _canonical_district(district: str) -> str:
    """Normalize whitespace/casing for district name matching."""
    return " ".join(district.strip().split())


@lru_cache(maxsize=1)
def _district_table() -> pd.DataFrame | None:
    """Load the district-nutrient index once (static asset). None if absent."""
    if not DISTRICT_INDEX_PATH.exists():
        return None
    return pd.read_csv(DISTRICT_INDEX_PATH)


@lru_cache(maxsize=1)
def _state_table() -> pd.DataFrame | None:
    """Load the state-nutrient index once (static asset). None if absent."""
    if not INDEX_PATH.exists():
        return None
    return pd.read_csv(INDEX_PATH)


def _district_lookup(state: str, district: str) -> dict | None:
    """
    Try to resolve soil values from the district-level index.

    Returns None if the district index file doesn't exist, the
    required columns are missing, or the district isn't found —
    the caller falls back to state-level lookup in that case.
    """

    if not district or not district.strip():
        return None

    table = _district_table()
    if table is None:
        return None

    required_columns = {"district", "state", "N_index", "P_index", "K_index"}

    missing = required_columns - set(table.columns)

    if missing:
        return None

    canonical_district = _canonical_district(district)
    canonical_state = _canonical_state(state)

    row = table[
        (
            table["district"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == canonical_district.casefold()
        )
        & (
            table["state"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == canonical_state.casefold()
        )
    ]

    if row.empty:
        return None

    row = row.iloc[0]

    quantiles = _training_quantiles()

    values = {}
    nutrient_levels = {}

    for nutrient in ("N", "P", "K"):

        index_value = float(row[f"{nutrient}_index"])

        level = _level(index_value)

        nutrient_levels[nutrient] = level

        values[nutrient] = round(quantiles[nutrient][level], 2)

    # District table carries its own pH estimate when available —
    # more accurate than the generic training-data median.
    if "ph_estimate" in table.columns and not pd.isna(row.get("ph_estimate")):
        values["ph"] = round(float(row["ph_estimate"]), 2)
    else:
        values["ph"] = round(_training_values()["ph"], 2)

    return {
        **values,
        "source": "district_nutrient_index_estimate",
        "state": canonical_state,
        "district": canonical_district,
        "reliability": "medium",
        "data_resolution": "district",
        "input_confidence": "medium",
        "nutrient_levels": nutrient_levels,
        "warning": (
            f"N/P/K are regional estimates derived from district-level "
            f"nutrient indices for {canonical_district}. These values are not "
            "field soil measurements."
        ),
    }


def _state_lookup(state: str) -> dict | None:
    """
    Try to resolve soil values from the state-level index.
    Returns None when no row matches after canonicalization.
    """

    if not INDEX_PATH.exists():
        return None

    table = _state_table()
    if table is None:
        return None

    required_columns = {"state", "N_index", "P_index", "K_index"}

    missing = required_columns - set(table.columns)

    if missing:
        return None

    canonical = _canonical_state(state)

    row = table[
        table["state"]
        .astype(str)
        .str.strip()
        .str.casefold()
        == canonical.casefold()
    ]

    if row.empty:
        return None

    row = row.iloc[0]

    quantiles = _training_quantiles()

    values = {}
    nutrient_levels = {}

    for nutrient in ("N", "P", "K"):

        index_value = float(row[f"{nutrient}_index"])

        level = _level(index_value)

        nutrient_levels[nutrient] = level

        values[nutrient] = round(quantiles[nutrient][level], 2)

    # State nutrient index does not provide reliable pH.
    # Use training median only as a prototype fallback.
    training = _training_values()

    values["ph"] = round(training["ph"], 2)

    return {
        **values,
        "source": "state_nutrient_index_estimate",
        "state": canonical,
        "district": None,
        "reliability": "low",
        "data_resolution": "state",
        "input_confidence": "medium",
        "nutrient_levels": nutrient_levels,
        "warning": (
            "N/P/K are regional estimates derived from state nutrient "
            "indices. pH is a prototype training-data estimate. These "
            "values are not field soil measurements."
        ),
    }


# Plain-language message surfaced whenever the full fallback chain produced
# no regional signal at all. Kept here so routers/CLI can reuse it literally.
GENERIC_FALLBACK_WARNING = (
    "Recommendation based on generic averages — soil data unavailable "
    "for your exact location."
)


def get_regional_soil_values(state: str, district: str | None = None) -> dict:
    """
    Get soil values automatically from the district and/or state.

    Resolution order (always reported back to the caller):
        1. district_soil_index.csv   -> data_resolution="district"
        2. state_soil_index.csv      -> data_resolution="state"
        3. training-data median      -> data_resolution="fallback"
    """

    if not state or not state.strip():
        raise ValueError("State is required for soil lookup.")

    # ---------------------------------------------------------
    # 1. Try district-level nutrient index first
    # ---------------------------------------------------------

    district_result = _district_lookup(state, district) if district else None

    if district_result is not None:
        logger.info(
            "Soil lookup: district-level match for %s/%s",
            district_result["state"],
            district_result["district"],
        )
        return district_result

    # ---------------------------------------------------------
    # 2. Try state-level nutrient index
    # ---------------------------------------------------------

    state_result = _state_lookup(state)

    if state_result is not None:
        logger.info(
            "Soil lookup: state-level match for %s (no district match)",
            state_result["state"],
        )
        return state_result

    # ---------------------------------------------------------
    # 3. Neither district nor state available -> prototype fallback.
    #    Explicitly flagged so the caller never treats this as real data.
    # ---------------------------------------------------------

    logger.warning(
        "Soil lookup: FALLBACK to training-data median — state '%s' "
        "not found after canonicalization (district=%r)",
        state,
        district,
    )

    values = _training_values()

    return {
        **values,
        "source": "training_data_fallback",
        "state": state,
        "district": district,
        "reliability": "very_low",
        "data_resolution": "fallback",
        "input_confidence": "low",
        "warning": GENERIC_FALLBACK_WARNING,
    }