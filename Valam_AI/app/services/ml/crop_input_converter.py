"""
Compatibility helper for older imports.
"""


def convert_soil_inputs(
    soil_nitrogen: float,
    soil_phosphorus: float,
    soil_potassium: float,
    soil_ph: float,
) -> dict:
    return {
        "N": float(soil_nitrogen),
        "P": float(soil_phosphorus),
        "K": float(soil_potassium),
        "ph": float(soil_ph),
    }
