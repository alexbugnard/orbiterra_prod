import { parseOpenMeteoResponse } from '@/lib/open-meteo'

describe('parseOpenMeteoResponse', () => {
  it('extracts day-1 forecast for a single location', () => {
    const raw = {
      daily: {
        weathercode: [0, 3],
        temperature_2m_min: [10, 12],
        temperature_2m_max: [18, 20],
        winddirection_10m_dominant: [270, 180],
        windspeed_10m_max: [15, 20],
      },
    }
    const result = parseOpenMeteoResponse(raw)
    expect(result.weather_code).toBe(3)
    expect(result.temp_min).toBe(12)
    expect(result.temp_max).toBe(20)
    expect(result.wind_direction).toBe(180)
    expect(result.wind_speed).toBe(20)
  })

  it('falls back to day 0 if day 1 is missing', () => {
    const raw = {
      daily: {
        weathercode: [2],
        temperature_2m_min: [8],
        temperature_2m_max: [15],
        winddirection_10m_dominant: [90],
        windspeed_10m_max: [10],
      },
    }
    const result = parseOpenMeteoResponse(raw)
    expect(result.weather_code).toBe(2)
    expect(result.temp_min).toBe(8)
  })
})
