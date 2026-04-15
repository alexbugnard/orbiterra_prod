import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

// --- Fake route: Paris → Lyon (simplified polyline as GeoJSON coordinates)
const parisLyonCoords = [
  [2.3522, 48.8566],
  [2.5, 48.6],
  [2.8, 48.2],
  [3.2, 47.8],
  [3.8, 47.4],
  [4.2, 46.9],
  [4.5, 46.4],
  [4.7, 45.9],
  [4.8317, 45.7640],
]

// --- Fake route: Lyon → Marseille
const lyonMarseilleCoords = [
  [4.8317, 45.7640],
  [4.9, 45.4],
  [5.0, 45.0],
  [5.2, 44.6],
  [5.3, 44.2],
  [5.2, 43.8],
  [5.3, 43.5],
  [5.37, 43.2965],
]

const trips = [
  {
    strava_id: 1000001,
    name: 'Paris → Lyon',
    start_date: '2024-07-01T07:00:00Z',
    end_date: '2024-07-03T18:00:00Z',
    distance_m: 465000,
    path: { type: 'LineString', coordinates: parisLyonCoords },
    visible: true,
    journal_fr: 'Belle première étape à travers la Bourgogne. Routes magnifiques, vent favorable.',
    journal_en: 'Beautiful first leg through Burgundy. Gorgeous roads, tailwind all the way.',
  },
  {
    strava_id: 1000002,
    name: 'Lyon → Marseille',
    start_date: '2024-07-05T08:00:00Z',
    end_date: '2024-07-07T17:00:00Z',
    distance_m: 314000,
    path: { type: 'LineString', coordinates: lyonMarseilleCoords },
    visible: true,
    journal_fr: 'La descente vers la mer était incroyable. Arrivée à Marseille sous le soleil.',
    journal_en: 'The descent to the sea was incredible. Arrived in Marseille under bright sunshine.',
  },
]

const waypoints = [
  {
    flickr_id: 'fake001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/800px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
    title: 'Somewhere in Burgundy',
    taken_at: '2024-07-02T10:30:00Z',
    lat: 47.4,
    lng: 3.8,
  },
  {
    flickr_id: 'fake002',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Empire_State_Building_%28aerial_view%29.jpg/800px-Empire_State_Building_%28aerial_view%29.jpg',
    title: 'Mountain pass near Valence',
    taken_at: '2024-07-06T14:00:00Z',
    lat: 44.6,
    lng: 5.0,
  },
  {
    flickr_id: 'fake003',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/800px-Camponotus_flavomarginatus_ant.jpg',
    title: 'First view of the Mediterranean',
    taken_at: '2024-07-07T11:00:00Z',
    lat: 43.5,
    lng: 5.3,
  },
]

async function seed() {
  console.log('🌱 Seeding test data...\n')

  // Insert trips
  for (const trip of trips) {
    const { error } = await supabase
      .from('trips')
      .upsert(trip, { onConflict: 'strava_id' })

    if (error) {
      console.error(`❌ Failed to insert trip "${trip.name}":`, error.message)
    } else {
      console.log(`✅ Trip: ${trip.name} (${(trip.distance_m / 1000).toFixed(0)} km)`)
    }
  }

  // Fetch trip IDs for waypoint matching
  const { data: insertedTrips } = await supabase
    .from('trips')
    .select('id, start_date, end_date')
    .in('strava_id', [1000001, 1000002])

  // Insert waypoints with trip matching
  for (const wp of waypoints) {
    const takenAt = new Date(wp.taken_at).getTime()
    const matchedTrip = (insertedTrips ?? []).find(t => {
      const start = new Date(t.start_date).getTime()
      const end = new Date(t.end_date).getTime()
      return takenAt >= start && takenAt <= end
    })

    const { error } = await supabase
      .from('waypoints')
      .upsert({ ...wp, trip_id: matchedTrip?.id ?? null }, { onConflict: 'flickr_id' })

    if (error) {
      console.error(`❌ Failed to insert waypoint "${wp.title}":`, error.message)
    } else {
      console.log(`✅ Photo: ${wp.title} → trip: ${matchedTrip ? 'matched' : 'unmatched'}`)
    }
  }

  console.log('\n✅ Done! Refresh http://localhost:3000/map to see the data.')
}

seed().catch(console.error)
