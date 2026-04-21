/**
 * One-time script: fetches elevation for all planned routes via Open-Elevation API
 * (100 points per call, with delay between calls) and stores the result in the DB.
 *
 * Usage: node scripts/fetch-route-elevation.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

const BATCH = 100      // points per Open-Elevation call
const DELAY_MS = 1500  // pause between calls to avoid rate-limiting

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchBatch(locations, attempt = 1) {
  const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ locations }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) throw new Error('empty results')
  return data.results
}

async function fetchAllElevations(coords) {
  // coords: [lng, lat][]
  // Returns [distanceM, altM][] for all coords
  const total = coords.length
  const allResults = []

  for (let start = 0; start < total; start += BATCH) {
    const chunk = coords.slice(start, start + BATCH)
    const locations = chunk.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
    const end = Math.min(start + BATCH, total)

    process.stdout.write(`  batch ${start}–${end - 1} / ${total - 1} ... `)

    let results
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        results = await fetchBatch(locations)
        process.stdout.write(`OK (${results.length} pts)\n`)
        break
      } catch (err) {
        process.stdout.write(`attempt ${attempt} failed: ${err.message}\n`)
        if (attempt < 3) {
          process.stdout.write(`  retrying in ${DELAY_MS * attempt}ms ...\n`)
          await sleep(DELAY_MS * attempt)
        } else {
          throw err
        }
      }
    }

    allResults.push(...results)
    if (end < total) await sleep(DELAY_MS)
  }

  // Build [distanceM, altM][] with cumulative distance
  let cumDist = 0
  return allResults.map((r, i) => {
    if (i > 0) {
      const p = allResults[i - 1]
      cumDist += haversineM(p.latitude, p.longitude, r.latitude, r.longitude)
    }
    return [Math.round(cumDist), Math.round(r.elevation)]
  })
}

async function main() {
  const { data: routes, error } = await supabase
    .from('planned_routes')
    .select('id, name, coordinates, elevation')

  if (error) { console.error('Supabase error:', error); process.exit(1) }
  if (!routes?.length) { console.log('No planned routes found.'); return }

  for (const route of routes) {
    console.log(`\nRoute: "${route.name}" (${route.coordinates.length} coords)`)

    if (route.elevation) {
      console.log(`  Already has elevation (${route.elevation.length} pts) — skipping. Delete the column value to re-fetch.`)
      continue
    }

    console.log(`  Fetching elevation in ${Math.ceil(route.coordinates.length / BATCH)} batches...`)

    try {
      const elevation = await fetchAllElevations(route.coordinates)
      console.log(`  Saving ${elevation.length} elevation points to DB...`)
      const { error: updateErr } = await supabase
        .from('planned_routes')
        .update({ elevation })
        .eq('id', route.id)
      if (updateErr) throw updateErr
      console.log(`  Done. Total distance: ${(elevation[elevation.length - 1][0] / 1000).toFixed(0)} km`)
    } catch (err) {
      console.error(`  FAILED for route "${route.name}":`, err.message)
    }
  }

  console.log('\nAll done.')
}

main()
