import httpx

from app.config import GEOCODE_CACHE_TTL_SECONDS
from app.utils.ttl_cache import TTLCache

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

# Nominatim enforces strict usage policy (max 1 req/s). Cache reverse geocodes
# by rounded coordinates for 24h — the state/district for a village does not
# change, so every farmer in the village reusing it is pure quota saving.
_geocode_cache: TTLCache[dict] = TTLCache()


def _geocode_cache_key(lat: float, lon: float):
    # ~11 m resolution: same village = same cache entry (mirrors weather cache).
    return (round(lat, 4), round(lon, 4))


async def reverse_geocode(lat: float, lon: float, user_agent: str) -> dict:
    return await _geocode_cache.get(
        _geocode_cache_key(lat, lon),
        ttl=GEOCODE_CACHE_TTL_SECONDS,
        factory=lambda: _reverse_geocode(lat, lon, user_agent),
    )


async def _reverse_geocode(lat: float, lon: float, user_agent: str) -> dict:
    headers = {"User-Agent": user_agent, "Accept": "application/json"}
    params = {
        "lat": lat, "lon": lon, "format": "jsonv2",
        "zoom": 10, "addressdetails": 1,
    }

    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        response = await client.get(NOMINATIM_URL, params=params)
        response.raise_for_status()
        data = response.json()

    address = data.get("address", {})
    state = address.get("state") or address.get("state_district")
    country = address.get("country")

    # District: Nominatim reports this under "state_district" for India,
    # occasionally under "county" for some areas. Optional — a missing
    # district should not break the request, soil lookup will fall
    # back to state-level data.
    district = (
        address.get("state_district")
        or address.get("county")
        or None
    )

    if not state:
        raise RuntimeError("Could not determine the state for this location.")

    return {
        "state": state,
        "district": district,
        "country": country,
        "display_name": data.get("display_name", state),
    }