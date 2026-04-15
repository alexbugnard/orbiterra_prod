import { decodePolylineToGeoJSON } from '@/lib/polyline'

describe('decodePolylineToGeoJSON', () => {
  it('decodes a Strava polyline string to a GeoJSON LineString', () => {
    // A known encoded polyline for a short path
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
    const result = decodePolylineToGeoJSON(encoded)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('LineString')
    expect(result!.coordinates.length).toBeGreaterThanOrEqual(2)
    // GeoJSON uses [lng, lat] order
    expect(typeof result!.coordinates[0][0]).toBe('number')
    expect(typeof result!.coordinates[0][1]).toBe('number')
  })

  it('returns null for an empty polyline', () => {
    const result = decodePolylineToGeoJSON('')
    expect(result).toBeNull()
  })
})
