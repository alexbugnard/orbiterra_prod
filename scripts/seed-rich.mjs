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
    .map(l => l.split('=').map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

// Helper: interpolate points along a route with slight randomness for realism
function buildTrack(waypoints, pointsPerSegment = 12) {
  const coords = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lng1, lat1] = waypoints[i]
    const [lng2, lat2] = waypoints[i + 1]
    for (let j = 0; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment
      const jitter = () => (Math.random() - 0.5) * 0.008
      coords.push([
        lng1 + (lng2 - lng1) * t + jitter(),
        lat1 + (lat2 - lat1) * t + jitter(),
      ])
    }
  }
  coords.push(waypoints[waypoints.length - 1])
  return coords
}

// ── TRIP 1: Alps crossing — Geneva → Nice ──────────────────────────────────
const alpsCoords = buildTrack([
  [6.1432, 46.2044],  // Geneva
  [6.4, 45.9],
  [6.9, 45.7],        // Chamonix area
  [7.1, 45.5],
  [7.3, 45.1],        // Aosta valley
  [7.5, 44.7],
  [7.3, 44.3],        // Col de Tende area
  [7.27, 43.70],      // Nice
])

// ── TRIP 2: Pyrenees — Biarritz → Barcelona ────────────────────────────────
const pyreneesCoords = buildTrack([
  [-1.5586, 43.4832], // Biarritz
  [-1.2, 43.3],
  [-0.5, 43.1],       // Pau
  [0.1, 42.9],
  [0.7, 42.7],        // Col du Tourmalet area
  [1.4, 42.5],
  [1.9, 42.4],        // Andorra area
  [2.2, 42.2],
  [2.18, 41.38],      // Barcelona
])

// ── TRIP 3: Loire Valley cruise ────────────────────────────────────────────
const loireCoords = buildTrack([
  [-2.7627, 47.6586], // Nantes
  [-2.0, 47.4],
  [-1.3, 47.5],
  [-0.5, 47.4],       // Angers area
  [0.1, 47.5],
  [0.7, 47.4],        // Tours area
  [1.1, 47.6],
  [1.5, 47.7],
  [2.35, 47.90],      // Orléans
])

// ── TRIP 4: Brittany coastal loop ──────────────────────────────────────────
const brittanyCoords = buildTrack([
  [-1.6778, 48.1173], // Rennes
  [-2.0, 48.5],
  [-2.8, 48.6],       // Saint-Brieuc area
  [-3.5, 48.4],
  [-4.1, 48.4],       // Brest area
  [-4.5, 48.0],
  [-4.1, 47.8],
  [-3.3, 47.7],       // Lorient area
  [-2.7, 47.6],
  [-2.1, 47.3],
  [-1.6778, 48.1173], // back to Rennes
])

// ── TRIP 5: Provence — Avignon → Marseille via Camargue ───────────────────
const provenceCoords = buildTrack([
  [4.8055, 43.9493], // Avignon
  [4.6, 43.7],
  [4.3, 43.5],       // Arles / Camargue
  [4.1, 43.4],
  [4.4, 43.3],
  [4.9, 43.2],
  [5.37, 43.2965],   // Marseille
])

const trips = [
  {
    strava_id: 2000001,
    name: 'Alps Crossing — Geneva to Nice',
    start_date: '2024-06-10T07:00:00Z',
    end_date:   '2024-06-14T18:00:00Z',
    distance_m: 620000,
    path: { type: 'LineString', coordinates: alpsCoords },
    visible: true,
    journal_fr: 'Cinq jours épiques à travers les Alpes. Les cols étaient brutaux mais la descente vers Nice valait chaque coup de pédale.',
    journal_en: 'Five epic days crossing the Alps. The mountain passes were brutal but the descent to Nice was worth every pedal stroke.',
  },
  {
    strava_id: 2000002,
    name: 'Pyrenees Traverse — Biarritz to Barcelona',
    start_date: '2024-07-20T06:30:00Z',
    end_date:   '2024-07-25T17:00:00Z',
    distance_m: 740000,
    path: { type: 'LineString', coordinates: pyreneesCoords },
    visible: true,
    journal_fr: 'La traversée des Pyrénées avec le Col du Tourmalet sous la pluie. Arrivée à Barcelone sous le soleil catalan.',
    journal_en: 'Crossing the Pyrenees with the Col du Tourmalet in the rain. Arrived in Barcelona under Catalan sunshine.',
  },
  {
    strava_id: 2000003,
    name: 'Loire Valley — Nantes to Orléans',
    start_date: '2024-05-03T08:00:00Z',
    end_date:   '2024-05-06T16:00:00Z',
    distance_m: 380000,
    path: { type: 'LineString', coordinates: loireCoords },
    visible: true,
    journal_fr: 'La Loire à vélo, entre châteaux et vignes. Route plate et reposante, parfaite après les Alpes.',
    journal_en: 'The Loire by bike, between châteaux and vineyards. Flat and relaxing — perfect after the Alps.',
  },
  {
    strava_id: 2000004,
    name: 'Brittany Coastal Loop',
    start_date: '2024-08-12T07:30:00Z',
    end_date:   '2024-08-16T15:00:00Z',
    distance_m: 490000,
    path: { type: 'LineString', coordinates: brittanyCoords },
    visible: true,
    journal_fr: 'Boucle bretonne sauvage. Vent de face la moitié du temps mais les crêpes au beurre compensaient tout.',
    journal_en: 'Wild Brittany loop. Headwind half the time but the butter crêpes made up for everything.',
  },
  {
    strava_id: 2000005,
    name: 'Provence — Avignon to Marseille via Camargue',
    start_date: '2024-09-05T08:00:00Z',
    end_date:   '2024-09-07T17:00:00Z',
    distance_m: 210000,
    path: { type: 'LineString', coordinates: provenceCoords },
    visible: true,
    journal_fr: 'Passage par la Camargue avec des flamants roses en fond de décor. Arrivée à Marseille avec 38°C.',
    journal_en: 'Through the Camargue with flamingos in the background. Arrived in Marseille at 38°C.',
  },
]

// Stunning landscape photos from Wikimedia Commons
const waypoints = [
  // Alps trip
  {
    flickr_id: 'alps001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Mont_Blanc_depuis_Prarion.jpg/1280px-Mont_Blanc_depuis_Prarion.jpg',
    title: 'Mont Blanc at dawn',
    taken_at: '2024-06-11T07:30:00Z',
    lat: 45.9, lng: 6.9,
  },
  {
    flickr_id: 'alps002',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Col_de_la_Cayolle.jpg/1280px-Col_de_la_Cayolle.jpg',
    title: 'Mountain pass in the southern Alps',
    taken_at: '2024-06-13T10:00:00Z',
    lat: 44.3, lng: 6.75,
  },
  {
    flickr_id: 'alps003',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Promenade_des_Anglais_by_night.jpg/1280px-Promenade_des_Anglais_by_night.jpg',
    title: 'Arriving in Nice — Promenade des Anglais',
    taken_at: '2024-06-14T18:00:00Z',
    lat: 43.70, lng: 7.27,
  },
  // Pyrenees trip
  {
    flickr_id: 'pyr001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Col_du_Tourmalet_2115m.jpg/1280px-Col_du_Tourmalet_2115m.jpg',
    title: 'Col du Tourmalet — 2115m',
    taken_at: '2024-07-22T11:00:00Z',
    lat: 42.87, lng: 0.14,
  },
  {
    flickr_id: 'pyr002',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Sagrada_Familia_01.jpg/800px-Sagrada_Familia_01.jpg',
    title: 'Made it to Barcelona — Sagrada Família',
    taken_at: '2024-07-25T16:30:00Z',
    lat: 41.38, lng: 2.18,
  },
  // Loire trip
  {
    flickr_id: 'loire001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Chateau_de_Chambord_1.jpg/1280px-Chateau_de_Chambord_1.jpg',
    title: 'Château de Chambord',
    taken_at: '2024-05-05T14:00:00Z',
    lat: 47.61, lng: 1.52,
  },
  // Brittany trip
  {
    flickr_id: 'brit001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Pointe_du_Raz_--_2022_--_02.jpg/1280px-Pointe_du_Raz_--_2022_--_02.jpg',
    title: 'Pointe du Raz — westernmost tip of France',
    taken_at: '2024-08-14T09:30:00Z',
    lat: 48.04, lng: -4.73,
  },
  {
    flickr_id: 'brit002',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Plage_du_Trez_Hir_a_Plougonvelin.JPG/1280px-Plage_du_Trez_Hir_a_Plougonvelin.JPG',
    title: 'Atlantic coast, Brittany',
    taken_at: '2024-08-14T15:00:00Z',
    lat: 48.34, lng: -4.67,
  },
  // Provence trip
  {
    flickr_id: 'prov001',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Flamant_rose_Camargue.jpg/1280px-Flamant_rose_Camargue.jpg',
    title: 'Flamingos in the Camargue',
    taken_at: '2024-09-06T08:30:00Z',
    lat: 43.4, lng: 4.2,
  },
  {
    flickr_id: 'prov002',
    url_large: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Vieux-Port_Marseille.jpg/1280px-Vieux-Port_Marseille.jpg',
    title: 'Vieux-Port, Marseille',
    taken_at: '2024-09-07T17:30:00Z',
    lat: 43.295, lng: 5.374,
  },
]

async function seed() {
  console.log('🌱 Seeding rich test data...\n')

  // Clear old seed data first
  await supabase.from('waypoints').delete().in('flickr_id', [
    'fake001','fake002','fake003',
    'alps001','alps002','alps003',
    'pyr001','pyr002',
    'loire001','brit001','brit002',
    'prov001','prov002',
  ])
  await supabase.from('trips').delete().in('strava_id', [
    1000001, 1000002,
    2000001, 2000002, 2000003, 2000004, 2000005,
  ])

  // Insert trips
  for (const trip of trips) {
    const { error } = await supabase
      .from('trips')
      .upsert(trip, { onConflict: 'strava_id' })

    if (error) {
      console.error(`❌ Trip "${trip.name}": ${error.message}`)
    } else {
      console.log(`✅ Trip: ${trip.name} (${(trip.distance_m / 1000).toFixed(0)} km)`)
    }
  }

  // Fetch inserted trips for waypoint matching
  const { data: insertedTrips } = await supabase
    .from('trips')
    .select('id, start_date, end_date')
    .in('strava_id', trips.map(t => t.strava_id))

  // Insert waypoints
  console.log('')
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
      console.error(`❌ Photo "${wp.title}": ${error.message}`)
    } else {
      console.log(`✅ Photo: ${wp.title} → ${matchedTrip ? 'matched' : 'unmatched'}`)
    }
  }

  console.log('\n✅ Done! Refresh http://localhost:3000/map')
}

seed().catch(console.error)
