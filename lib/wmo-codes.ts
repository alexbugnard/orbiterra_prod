export type WeatherIcon = 'sun' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'storm'

export function wmoToIcon(code: number): WeatherIcon {
  if (code === 0 || code === 1) return 'sun'
  if (code === 2) return 'partly-cloudy'
  if (code === 3 || (code >= 45 && code <= 48)) return 'cloudy'
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95 && code <= 99) return 'storm'
  return 'cloudy'
}
