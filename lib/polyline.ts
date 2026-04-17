import polyline from '@mapbox/polyline'

interface GeoJSONLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export function decodePolylineToGeoJSON(encoded: string): GeoJSONLineString | null {
  if (!encoded) return null

  // @mapbox/polyline returns [[lat, lng], ...]
  const latLngPairs = polyline.decode(encoded)

  if (latLngPairs.length === 0) return null

  // GeoJSON requires [lng, lat] order
  const coordinates: [number, number][] = latLngPairs.map(([lat, lng]) => [lng, lat])

  return { type: 'LineString', coordinates }
}
