import httpx
from app.config import WEATHER_API_KEY

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"


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
    """

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
    Fetch rainfall information from NASA POWER.
    """

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "community": "AG",
        "parameters": "PRECTOTCORR",
        "start": "20260101",
        "end": "20261231",
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