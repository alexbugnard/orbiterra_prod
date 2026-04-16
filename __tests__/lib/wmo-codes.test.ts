import { wmoToIcon } from '@/lib/wmo-codes'

describe('wmoToIcon', () => {
  it('maps clear sky (0) to sun', () => {
    expect(wmoToIcon(0)).toBe('sun')
  })

  it('maps mainly clear (1) to sun', () => {
    expect(wmoToIcon(1)).toBe('sun')
  })

  it('maps partly cloudy (2) to partly-cloudy', () => {
    expect(wmoToIcon(2)).toBe('partly-cloudy')
  })

  it('maps overcast (3) to cloudy', () => {
    expect(wmoToIcon(3)).toBe('cloudy')
  })

  it('maps rain showers (80) to rain', () => {
    expect(wmoToIcon(80)).toBe('rain')
  })

  it('maps moderate rain (63) to rain', () => {
    expect(wmoToIcon(63)).toBe('rain')
  })

  it('maps snow fall (71) to snow', () => {
    expect(wmoToIcon(71)).toBe('snow')
  })

  it('maps thunderstorm (95) to storm', () => {
    expect(wmoToIcon(95)).toBe('storm')
  })

  it('returns cloudy for unknown codes', () => {
    expect(wmoToIcon(999)).toBe('cloudy')
  })
})
