"""
Soil value resolver for GPS-only crop recommendation.

Priority:
1. Use district-level nutrient-index data when available (finer-grained
   than state, still a regional estimate — not a farm-level measurement).
2. Use state-level nutrient-index data when district data is unavailable.
3. If neither is available, use representative values from the crop
   training dataset as a prototype fallback.

IMPORTANT:
None of these are field-level soil measurements.
For production use, replace the fallback with a proper
location-based soil data source or Soil Health Card data.
"""

from pathlib import Path

import pandas as pd


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


def _training_values() -> dict:
    """
    Get representative values from the existing crop dataset.

    These values are used only as a prototype fallback when
    neither district nor state-specific soil information is available.
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


def _training_quantiles() -> dict:
    """
    Representative low / medium / high N/P/K values
    from the training dataset.
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


def _canonical_state(state: str) -> str:
    """Normalize common state-name variations."""

    aliases = {
        "orissa": "Odisha",
        "jammu and kashmir": "Jammu & Kashmir",
        "jammu & kashmir": "Jammu & Kashmir",
        "andaman and nicobar islands": "Andaman & Nicobar Islands",
        "andaman & nicobar islands": "Andaman & Nicobar Islands",
    }

    cleaned = " ".join(state.strip().split())

    return aliases.get(
        cleaned.casefold(),
        cleaned
    )


def _canonical_district(district: str) -> str:
    """Normalize whitespace/casing for district name matching."""

    return " ".join(district.strip().split())


def _district_lookup(state: str, district: str) -> dict | None:
    """
    Try to resolve soil values from the district-level index.

    Returns None if the district index file doesn't exist, the
    required columns are missing, or the district isn't found —
    the caller falls back to state-level lookup in that case.
    """

    if not district or not district.strip():
        return None

    if not DISTRICT_INDEX_PATH.exists():
        return None

    table = pd.read_csv(DISTRICT_INDEX_PATH)

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

        "state": state,
        "district": district,

        "reliability": "low",

        "nutrient_levels": nutrient_levels,

        "warning": (
            f"N/P/K are regional estimates derived from district-level "
            f"nutrient indices for {district}. These values are not "
            "field soil measurements."
        ),
    }


def get_regional_soil_values(state: str, district: str | None = None) -> dict:
    """
    Get soil values automatically from the district and/or state.

    Resolution order:
        1. district_soil_index.csv  (finest granularity)
        2. state_soil_index.csv     (existing behavior, unchanged)
        3. training-data median     (prototype fallback, unchanged)
    """

    if not state or not state.strip():
        raise ValueError("State is required for soil lookup.")

    # ---------------------------------------------------------
    # 1. Try district-level nutrient index first
    # ---------------------------------------------------------

    district_result = _district_lookup(state, district) if district else None

    if district_result is not None:
        return district_result

    # ---------------------------------------------------------
    # 2. Try state-level nutrient index
    # ---------------------------------------------------------

    if INDEX_PATH.exists():

        table = pd.read_csv(INDEX_PATH)

        required_columns = {
            "state",
            "N_index",
            "P_index",
            "K_index",
        }

        missing = required_columns - set(table.columns)

        if not missing:

            canonical = _canonical_state(state)

            row = table[
                table["state"]
                .astype(str)
                .str.strip()
                .str.casefold()
                == canonical.casefold()
            ]

            if not row.empty:

                row = row.iloc[0]

                quantiles = _training_quantiles()

                values = {}
                nutrient_levels = {}

                for nutrient in ("N", "P", "K"):

                    index_value = float(
                        row[f"{nutrient}_index"]
                    )

                    level = _level(index_value)

                    nutrient_levels[nutrient] = level

                    values[nutrient] = round(
                        quantiles[nutrient][level],
                        2
                    )

                # State nutrient index does not provide reliable pH.
                # Use training median only as a prototype fallback.
                training = _training_values()

                values["ph"] = round(
                    training["ph"],
                    2
                )

                return {
                    **values,

                    "source": "state_nutrient_index_estimate",

                    "state": state,
                    "district": district,

                    "reliability": "low",

                    "nutrient_levels": nutrient_levels,

                    "warning": (
                        "N/P/K are regional estimates derived from "
                        "state nutrient indices. pH is a prototype "
                        "training-data estimate. These values are not "
                        "field soil measurements."
                    ),
                }

    # ---------------------------------------------------------
    # 3. Neither district nor state available → prototype fallback
    # ---------------------------------------------------------

    values = _training_values()

    return {
        **values,

        "source": "training_data_fallback",

        "state": state,
        "district": district,

        "reliability": "very_low",

        "warning": (
            f"No district or state-level soil dataset is configured for "
            f"{district + ', ' if district else ''}{state}. "
            "N/P/K/pH are currently estimated from the crop training "
            "dataset median. This is only a prototype fallback and "
            "must not be treated as actual farm soil measurements."
        ),
    }


def resolve_soil_values(
    state: str,
    district: str | None = None,
    soil_nitrogen: float | None = None,
    soil_phosphorus: float | None = None,
    soil_potassium: float | None = None,
    soil_ph: float | None = None,
) -> dict:
    """
    Resolve soil values.

    Soil Health Card values are preferred when supplied.
    Otherwise automatically obtain regional/fallback values.

    This function is retained for compatibility with the rest
    of the project.
    """

    values = [
        soil_nitrogen,
        soil_phosphorus,
        soil_potassium,
        soil_ph,
    ]

    # ---------------------------------------------------------
    # Farmer provided complete Soil Health Card
    # ---------------------------------------------------------

    if all(value is not None for value in values):

        return {
            "N": float(soil_nitrogen),
            "P": float(soil_phosphorus),
            "K": float(soil_potassium),
            "ph": float(soil_ph),

            "source": "soil_health_card",

            "state": state,
            "district": district,

            "reliability": "high",

            "warning": None,
        }

    # ---------------------------------------------------------
    # Farmer provided incomplete soil data
    # ---------------------------------------------------------

    if any(value is not None for value in values):

        raise ValueError(
            "Provide all four soil values: "
            "N, P, K and pH."
        )

    # ---------------------------------------------------------
    # GPS-only mode
    # ---------------------------------------------------------

    return get_regional_soil_values(state, district)