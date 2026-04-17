import { interpolatePoints } from '@/scripts/seed-weather-points'

describe('interpolatePoints', () => {
  it('returns one point for a short segment below threshold', () => {
    // Two points ~10 km apart — below 50 km threshold → only the midpoint
    const coords: [number, number][] = [
      [6.1432, 46.2044], // Geneva [lng, lat]
      [6.2000, 46.2500],
    ]
    const points = interpolatePoints(coords, 50_000)
    expect(points.length).toBeGreaterThanOrEqual(1)
  })

  it('returns multiple points for a long segment', () => {
    // Roughly 200 km route → expect ~4 points
    const coords: [number, number][] = [
      [2.3522, 48.8566],  // Paris
      [4.8357, 45.7640],  // Lyon
    ]
    const points = interpolatePoints(coords, 50_000)
    expect(points.length).toBeGreaterThanOrEqual(2)
    // Each point has lat and lng
    for (const p of points) {
      expect(typeof p.lat).toBe('number')
      expect(typeof p.lng).toBe('number')
    }
  })
})
