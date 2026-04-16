import { createSupabaseClient } from '@/lib/supabase'

/**
 * Haversine distance in metres between two [lng, lat] points.
 */
function haversineMetres(a: [number, number], b: [number, number]): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const a2 =
    sinDLat * sinDLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2))
}

/**
 * Walk the LineString coordinates and emit one point every `intervalMetres`.
 * Coordinates are GeoJSON [lng, lat] pairs.
 */
export function interpolatePoints(
  coords: [number, number][],
  intervalMetres: number
): { lat: number; lng: number }[] {
  const results: { lat: number; lng: number }[] = []
  let accumulated = 0

  if (coords.length === 0) return results

  // Always include a point near the start
  results.push({ lat: coords[0][1], lng: coords[0][0] })

  for (let i = 1; i < coords.length; i++) {
    const segDist = haversineMetres(coords[i - 1], coords[i])
    accumulated += segDist

    if (accumulated >= intervalMetres) {
      const ratio = (accumulated - intervalMetres) / segDist
      const lng = coords[i][0] - ratio * (coords[i][0] - coords[i - 1][0])
      const lat = coords[i][1] - ratio * (coords[i][1] - coords[i - 1][1])
      results.push({ lat, lng })
      accumulated = 0
    }
  }

  return results
}

async function main() {
  const supabase = createSupabaseClient()

  // Fetch all visible trips ordered by start_date — treat path as the planned route
  const { data: trips, error } = await supabase
    .from('trips')
    .select('path')
    .eq('visible', true)
    .order('start_date', { ascending: true })

  if (error) throw error
  if (!trips || trips.length === 0) {
    console.error('No visible trips found. Sync Strava first.')
    process.exit(1)
  }

  // Concatenate all trip coordinates into one route
  const allCoords: [number, number][] = []
  for (const trip of trips) {
    const coords: [number, number][] = trip.path?.coordinates ?? []
    allCoords.push(...coords)
  }

  const points = interpolatePoints(allCoords, 50_000) // 50 km

  // Delete existing rows and re-insert
  await supabase.from('weather_points').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const rows = points.map((p, seq) => ({ seq, lat: p.lat, lng: p.lng }))
  const { error: insertError } = await supabase.from('weather_points').insert(rows)

  if (insertError) throw insertError

  console.log(`Seeded ${rows.length} weather points.`)
}

// Only run main() when executed directly, not when imported by tests
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
