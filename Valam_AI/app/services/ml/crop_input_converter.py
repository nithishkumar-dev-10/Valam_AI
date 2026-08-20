

NPK_MIDPOINTS = {
    "N": {"low": 20, "medium": 60, "high": 110},
    "P": {"low": 15, "medium": 40, "high": 80},
    "K": {"low": 15, "medium": 40, "high": 80},
}

PH_MIDPOINTS = {
    "acidic": 5.5,
    "neutral": 6.8,
    "alkaline": 8.2,
}


def convert_soil_inputs(
    soil_nitrogen: str,
    soil_phosphorus: str,
    soil_potassium: str,
    soil_ph: str,
) -> dict:
    return {
        "N": NPK_MIDPOINTS["N"][soil_nitrogen],
        "P": NPK_MIDPOINTS["P"][soil_phosphorus],
        "K": NPK_MIDPOINTS["K"][soil_potassium],
        "ph": PH_MIDPOINTS[soil_ph],
    }