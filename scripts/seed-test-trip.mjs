import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const xml = readFileSync(resolve(__dirname, '../public/test_trips/test_orbiterra.gpx'), 'utf8')

// Extract name
const nameMatch = xml.match(/<trk>\s*<name>([^<]+)<\/name>/)
const name = nameMatch ? nameMatch[1] : 'Test Trip'

// Parse trackpoints
const trkptRe = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>/g
const points = []
let m
while ((m = trkptRe.exec(xml)) !== null) {
  points.push({ lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: parseFloat(m[3]) })
}
console.log(`Parsed ${points.length} trackpoints`)

// Compute total distance
let distanceM = 0
for (let i = 1; i < points.length; i++) {
  distanceM += haversineM(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng)
}
console.log(`Distance: ${Math.round(distanceM / 1000)} km`)

// Build GeoJSON path (PostGIS LineString) — sample to 500 points
const coordStride = Math.max(1, Math.floor(points.length / 500))
const pathCoords = points
  .filter((_, i) => i % coordStride === 0 || i === points.length - 1)
  .map(p => [p.lng, p.lat])
const path = { type: 'LineString', coordinates: pathCoords }

// Sample elevation to 200 points [distanceMeters, altMeters]
let cumDist = 0
const elevStride = Math.max(1, Math.floor(points.length / 200))
const elevation = []
for (let i = 0; i < points.length; i++) {
  if (i > 0) cumDist += haversineM(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng)
  if (i % elevStride === 0 || i === points.length - 1) {
    elevation.push([Math.round(cumDist), Math.round(points[i].ele)])
  }
}

const startLat = points[0].lat
const startLng = points[0].lng

// Delete any existing test trip
await supabase.from('trips').delete().eq('strava_id', 9999999999)

const { error } = await supabase.from('trips').insert({
  strava_id: 9999999999,
  name,
  start_date: '2024-07-01T08:00:00Z',
  end_date: '2024-07-01T20:00:00Z',
  distance_m: Math.round(distanceM),
  path,
  elevation,
  start_lat: startLat,
  start_lng: startLng,
  visible: true,
  country: 'United States',
})

if (error) { console.error('Insert error:', error); process.exit(1) }
console.log(`✓ Trip "${name}" inserted (${pathCoords.length} coords, ${elevation.length} elev points)`)
