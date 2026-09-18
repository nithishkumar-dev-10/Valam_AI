import os
import datetime

import httpx
from app.config import WEATHER_API_KEY, WEATHER_CACHE_TTL_SECONDS
from app.utils.ttl_cache import TTLCache

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

# Free-tier quota shield: every /predict/crop-simple and /voice/query crop
# branch would otherwise fire OpenWeather + NASA POWER per request. Cache the
# rounded coordinate pair for WEATHER_CACHE_TTL_SECONDS (default 15 min) so a
# village-full of farmers at the same farm doesn't burn N API calls back to
# back. Singleflight also collapses the concurrent duplicates.
_weather_cache: TTLCache[dict] = TTLCache()


def _weather_cache_key(latitude: float, longitude: float):
    # ~11 m resolution: farmers in the same village share a cache entry instead
    # of every tiny decimal variation generating a fresh upstream request.
    return (round(latitude, 4), round(longitude, 4))

# NASA POWER rainfall is reported as a multi-day average. For crop
# *recommendation* the meaningful signal is the long-run annual average
# (crops are selected for the climate, not this week's weather), so the
# default window is the current calendar year. Temperature/humidity remain
# live (real-time) from OpenWeather — only rainfall is an annual average
# and it is labeled as such (`avg_annual_rainfall`) so it is never
# mistaken for current conditions.
# Set RAINFALL_START/RAINFALL_END (YYYYMMDD) to override, e.g. rolling 90 days.


async def fetch_weather_features(
    latitude: float,
    longitude: float,
):
    """
    Fetch combined weather features using latitude and longitude.

    Temperature / humidity / pressure / wind come from OpenWeather.
    Rainfall comes from NASA POWER.

    API key is read from:
        WEATHER_API_KEY

    Results are cached by rounded coordinates (TTLCache) so free-tier API
    quotas are not hammered by repeated / same-village queries.
    """
    return await _weather_cache.get(
        _weather_cache_key(latitude, longitude),
        ttl=WEATHER_CACHE_TTL_SECONDS,
        factory=lambda: _fetch_weather_features(latitude, longitude),
    )


async def _fetch_weather_features(latitude: float, longitude: float) -> dict:
    if not WEATHER_API_KEY:
        raise RuntimeError(
            "Weather API key is not configured. "
            "Set WEATHER_API_KEY in your environment."
        )

    api_key = WEATHER_API_KEY

    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": api_key,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:

            response = await client.get(
                OPENWEATHER_URL,
                params=params,
            )

            response.raise_for_status()

            data = response.json()

    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"OpenWeather API request failed: "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise RuntimeError(
            f"Unable to connect to OpenWeather API: {exc}"
        ) from exc

    # Extract weather information
    main = data.get("main", {})
    wind = data.get("wind", {})
    weather = data.get("weather", [{}])[0]

    temperature = main.get("temp")
    humidity = main.get("humidity")
    pressure = main.get("pressure")
    wind_speed = wind.get("speed")
    weather_description = weather.get("description")

    if temperature is None or humidity is None:
        raise RuntimeError(
            "OpenWeather API returned incomplete weather data."
        )

    # Pull rainfall from NASA POWER and merge it into the same feature set
    nasa_data = await fetch_nasa_rainfall(latitude, longitude)
    rainfall = nasa_data["rainfall"]

    return {
        "temperature": temperature,
        "humidity": humidity,
        "pressure": pressure,
        "wind_speed": wind_speed,
        "weather_description": weather_description,
        "avg_annual_rainfall": rainfall,
        "rainfall": rainfall,
        "source": "openweather+nasa_power",
        "latitude": latitude,
        "longitude": longitude,
    }


async def fetch_nasa_rainfall(
    latitude: float,
    longitude: float,
):
    """
    Fetch the ANNUAL AVERAGE rainfall (mm/day, NASA POWER), configurable
    to any window via RAINFALL_START/RAINFALL_END env vars. The default
    window is the current calendar year.
    """

    today = datetime.date.today()
    default_start = f"{today.year:04d}0101"
    default_end = f"{today.year:04d}1231"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "community": "AG",
        "parameters": "PRECTOTCORR",
        "start": os.getenv("RAINFALL_START", default_start),
        "end": os.getenv("RAINFALL_END", default_end),
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:

            response = await client.get(
                NASA_POWER_URL,
                params=params,
            )

            response.raise_for_status()

            data = response.json()

    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"NASA POWER request failed: "
            f"{exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise RuntimeError(
            f"Unable to connect to NASA POWER API: {exc}"
        ) from exc

    try:
        rainfall_data = (
            data["properties"]
            ["parameter"]
            ["PRECTOTCORR"]
        )
    except (KeyError, TypeError):
        raise RuntimeError(
            "NASA POWER returned no usable precipitation."
        )

    valid_values = [
        value
        for value in rainfall_data.values()
        if value is not None and value > -900
    ]

    if not valid_values:
        raise RuntimeError(
            "NASA POWER returned no usable precipitation."
        )

    average_rainfall = sum(valid_values) / len(valid_values)

    return {
        "rainfall": average_rainfall,
        "source": "nasa_power",
        "latitude": latitude,
        "longitude": longitude,
    }