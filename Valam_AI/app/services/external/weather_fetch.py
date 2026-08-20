

import httpx


async def fetch_weather_features(lat: float, lon: float, api_key: str) -> dict:
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    temperature = data["main"]["temp"]
    humidity = data["main"]["humidity"]
    # OpenWeather's current-weather endpoint doesn't give rainfall totals reliably;
    # "rain" key only appears if it's currently raining (1h/3h volume in mm).
    # For production, consider a historical/seasonal average per region instead
    # of live rainfall, since crop recommendation cares about seasonal rainfall,
    # not "is it raining right now."
    rainfall = data.get("rain", {}).get("1h", 0.0)

    return {
        "temperature": temperature,
        "humidity": humidity,
        "rainfall": rainfall,
    }