export const INDIA_LAT_RANGE = [6.0, 37.5] as const;
export const INDIA_LON_RANGE = [68.0, 97.5] as const;

export interface Coords {
  latitude: number;
  longitude: number;
}

export function isGeoSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function getPosition(timeoutMs = 10_000): Promise<Coords> {
  if (!isGeoSupported()) {
    return Promise.reject(new Error("Location isn't available on this device."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export function coordsInIndia(lat: number, lon: number): boolean {
  return (
    lat >= INDIA_LAT_RANGE[0] &&
    lat <= INDIA_LAT_RANGE[1] &&
    lon >= INDIA_LON_RANGE[0] &&
    lon <= INDIA_LON_RANGE[1]
  );
}