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

const GPX_FILES = [
  'ORBITERRA_NA_1.gpx',
  'ORBITERRA_NA_2.gpx',
  'ORBITERRA_SA_1.gpx',
  'ORBITERRA_SA_2.gpx',
]

const TARGET_POINTS = 10000

function parseGpxCoords(xml) {
  const coords = []
  const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
  let m
  while ((m = re.exec(xml)) !== null) {
    coords.push([parseFloat(m[2]), parseFloat(m[1])]) // [lng, lat]
  }
  return coords
}

const allCoords = []

for (const file of GPX_FILES) {
  const filePath = resolve(__dirname, '../public/planned route', file)
  console.log(`Parsing ${file}...`)
  const xml = readFileSync(filePath, 'utf8')
  const coords = parseGpxCoords(xml)
  console.log(`  → ${coords.length} trackpoints`)
  allCoords.push(...coords)
}

console.log(`Total trackpoints: ${allCoords.length}`)

const stride = Math.max(1, Math.floor(allCoords.length / TARGET_POINTS))
const sampled = allCoords.filter((_, i) => i % stride === 0 || i === allCoords.length - 1)
console.log(`Sampled to ${sampled.length} points (stride ${stride})`)

const { error: delError } = await supabase.from('planned_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (delError) { console.error('Delete error:', delError); process.exit(1) }

const { error } = await supabase
  .from('planned_routes')
  .insert({ name: 'Alaska → Ushuaia (GPX)', coordinates: sampled, color: '#22d3ee' })

if (error) {
  console.error('Supabase error:', error)
  process.exit(1)
}

console.log('Done — planned route upserted successfully.')
