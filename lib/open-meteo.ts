const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

export interface WeatherForecast {
  weather_code: number
  temp_min: number
  temp_max: number
  wind_direction: number
  wind_speed: number
}

export interface OpenMeteoDaily {
  weathercode: number[]
  temperature_2m_min: number[]
  temperature_2m_max: number[]
  winddirection_10m_dominant: number[]
  windspeed_10m_max: number[]
}

/**
 * Parse a single-location Open-Meteo response.
 * Uses day index 1 (tomorrow) if available, otherwise day 0 (today).
 */
export function parseOpenMeteoResponse(raw: { daily: OpenMeteoDaily }): WeatherForecast {
  const d = raw.daily
  const idx = d.weathercode.length > 1 ? 1 : 0
  return {
    weather_code: d.weathercode[idx],
    temp_min: d.temperature_2m_min[idx],
    temp_max: d.temperature_2m_max[idx],
    wind_direction: d.winddirection_10m_dominant[idx],
    wind_speed: d.windspeed_10m_max[idx],
  }
}

const CHUNK_SIZE = 50

async function fetchWeatherChunk(points: { lat: number; lng: number }[]): Promise<WeatherForecast[]> {
  const lats = points.map((p) => p.lat.toFixed(4)).join(',')
  const lngs = points.map((p) => p.lng.toFixed(4)).join(',')

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    daily: [
      'weathercode',
      'temperature_2m_min',
      'temperature_2m_max',
      'winddirection_10m_dominant',
      'windspeed_10m_max',
    ].join(','),
    timezone: 'UTC',
    forecast_days: '2',
  })

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`)

  const data = await res.json()
  const items: { daily: OpenMeteoDaily }[] = Array.isArray(data) ? data : [data]
  return items.map(parseOpenMeteoResponse)
}

export async function fetchWeatherForPoints(
  points: { lat: number; lng: number }[]
): Promise<WeatherForecast[]> {
  if (points.length === 0) return []

  const results: WeatherForecast[] = []
  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const chunk = points.slice(i, i + CHUNK_SIZE)
    const forecasts = await fetchWeatherChunk(chunk)
    results.push(...forecasts)
  }
  return results
}
