import { formatWeatherPoint } from '@/app/api/weather-points/route'

describe('formatWeatherPoint', () => {
  it('formats a DB row into the API response shape', () => {
    const row = {
      id: 'abc',
      seq: 0,
      lat: 46.2,
      lng: 6.1,
      label: 'Geneva',
      weather_code: 2,
      temp_min: 10,
      temp_max: 22,
      wind_direction: 270,
      wind_speed: 15,
    }
    const result = formatWeatherPoint(row)
    expect(result.id).toBe('abc')
    expect(result.lat).toBe(46.2)
    expect(result.icon).toBe('partly-cloudy')
    expect(result.wind_direction).toBe(270)
  })
})
