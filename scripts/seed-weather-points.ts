import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually
const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/\\(\$)/g, '$1')
}

function createSupabaseClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

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

export function interpolatePoints(
  coords: [number, number][],
  intervalMetres: number
): { lat: number; lng: number }[] {
  const results: { lat: number; lng: number }[] = []
  let accumulated = 0
  if (coords.length === 0) return results
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=8`
    const res = await fetch(url, { headers: { 'User-Agent': 'BikeTrip/1.0 seed-script' } })
    if (!res.ok) return null
    const data: any = await res.json()
    const a = data.address ?? {}
    return a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? null
  } catch {
    return null
  }
}

async function fetchElevations(points: { lat: number; lng: number }[]): Promise<number[]> {
  const CHUNK = 100
  const results: number[] = []
  for (let i = 0; i < points.length; i += CHUNK) {
    const chunk = points.slice(i, i + CHUNK)
    const lats = chunk.map((p) => p.lat.toFixed(4)).join(',')
    const lngs = chunk.map((p) => p.lng.toFixed(4)).join(',')
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`)
    if (!res.ok) { results.push(...chunk.map(() => 0)); continue }
    const data: any = await res.json()
    const elevs = Array.isArray(data.elevation) ? data.elevation : [data.elevation]
    results.push(...elevs)
  }
  return results
}

async function main() {
  const supabase = createSupabaseClient()

  const { data: routes, error } = await supabase
    .from('planned_routes')
    .select('coordinates')
    .limit(1)

  if (error) throw error
  if (!routes || routes.length === 0) {
    console.error('No planned routes found.')
    process.exit(1)
  }

  const allCoords: [number, number][] = (routes[0].coordinates as [number, number][]) ?? []
  const points = interpolatePoints(allCoords, 50_000) // one point every 50 km

  console.log(`Interpolated ${points.length} points. Fetching elevations…`)
  const elevations = await fetchElevations(points)

  console.log('Reverse geocoding (1 req/s)…')
  const labels: (string | null)[] = []
  for (let i = 0; i < points.length; i++) {
    const city = await reverseGeocode(points[i].lat, points[i].lng)
    const elev = elevations[i] != null ? Math.round(elevations[i]) : null
    const label = city && elev != null ? `${city} • ${elev} m` : city ?? (elev != null ? `${elev} m` : null)
    labels.push(label)
    process.stdout.write(`  [${i + 1}/${points.length}] ${label ?? '—'}\n`)
    await sleep(1100) // Nominatim rate limit: 1 req/s
  }

  await supabase.from('weather_points').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const rows = points.map((p, seq) => ({ seq, lat: p.lat, lng: p.lng, label: labels[seq] }))
  const { error: insertError } = await supabase.from('weather_points').insert(rows)
  if (insertError) throw insertError

  console.log(`\nSeeded ${rows.length} weather points with labels.`)
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
