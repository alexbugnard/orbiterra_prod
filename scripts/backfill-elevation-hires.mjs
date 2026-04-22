// One-time script: fetch high-res elevation for all planned routes
// Usage: node scripts/backfill-elevation-hires.mjs
// Targets 1 point per km; batches 99 pts per opentopodata request (1 req/s rate limit)

const SUPABASE_URL = 'https://ynskuvlfcozwoofffabt.supabase.co'
const SUPABASE_KEY = 'SUPABASE_SERVICE_KEY_REMOVED'
const BATCH = 99      // opentopodata max per request
const RATE_MS = 1100  // 1 req/s rate limit

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function routeLengthM(coords) {
  let d = 0
  for (let i = 1; i < coords.length; i++)
    d += haversineM(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
  return d
}

// Sample coords so there's at most 1 point per targetKm
function sampleByDistance(coords, targetDistM) {
  if (coords.length < 2) return coords
  const out = [coords[0]]
  let accumulated = 0
  for (let i = 1; i < coords.length; i++) {
    accumulated += haversineM(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
    if (accumulated >= targetDistM) {
      out.push(coords[i])
      accumulated = 0
    }
  }
  const last = coords[coords.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

async function fetchBatch(locs) {
  const locationStr = locs.map(l => `${l.lat},${l.lng}`).join('|')
  const res = await fetch('https://api.opentopodata.org/v1/mapzen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: locationStr }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`API error: ${JSON.stringify(data)}`)
  return data.results.map(r => ({ lat: r.location.lat, lng: r.location.lng, elevation: r.elevation ?? 0 }))
}

// Replace obvious voids (null/0 between valid neighbours) with linear interpolation
function fixVoids(points) {
  const out = [...points]
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].elevation <= 0) {
      // find next valid
      let j = i + 1
      while (j < out.length - 1 && out[j].elevation <= 0) j++
      const prev = out[i - 1].elevation
      const next = out[j].elevation
      for (let k = i; k < j; k++) {
        out[k] = { ...out[k], elevation: prev + (next - prev) * ((k - i + 1) / (j - i + 1)) }
      }
      i = j - 1
    }
  }
  return out
}

async function supabase(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function main() {
  const routes = await supabase('planned_routes?select=id,coordinates')
  console.log(`Found ${routes.length} route(s)`)

  for (const route of routes) {
    const coords = route.coordinates // [lng, lat][]
    const totalKm = Math.round(routeLengthM(coords) / 1000)
    const sampled = sampleByDistance(coords, 1000) // 1 point per km
    console.log(`\nRoute ${route.id}: ${totalKm} km → ${sampled.length} sample points`)

    const locs = sampled.map(([lng, lat]) => ({ lat, lng }))
    const batches = []
    for (let i = 0; i < locs.length; i += BATCH) batches.push(locs.slice(i, i + BATCH))
    console.log(`  ${batches.length} batches to fetch...`)

    const allResults = []
    for (let b = 0; b < batches.length; b++) {
      process.stdout.write(`  batch ${b + 1}/${batches.length}... `)
      let results
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          results = await fetchBatch(batches[b])
          break
        } catch (err) {
          console.warn(`attempt ${attempt} failed: ${err.message}`)
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000))
          else throw err
        }
      }
      allResults.push(...results)
      console.log(`ok (${results.length} pts)`)
      if (b < batches.length - 1) await new Promise(r => setTimeout(r, RATE_MS))
    }

    const fixed = fixVoids(allResults)

    // Build [cumDistM, altM][] array
    let cumDist = 0
    const elevation = []
    for (let i = 0; i < fixed.length; i++) {
      if (i > 0) cumDist += haversineM(fixed[i-1].lat, fixed[i-1].lng, fixed[i].lat, fixed[i].lng)
      elevation.push([Math.round(cumDist), Math.round(fixed[i].elevation)])
    }

    await supabase(`planned_routes?id=eq.${route.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ elevation }),
    })
    console.log(`  ✓ saved ${elevation.length} points to DB (${Math.round(elevation[elevation.length-1][0]/1000)} km total)`)
  }

  console.log('\nDone!')
}

main().catch(err => { console.error(err); process.exit(1) })
