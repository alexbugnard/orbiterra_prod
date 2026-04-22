// One-time script: compute country transitions along planned routes
// Samples every 50km, reverse geocodes via Nominatim, stores [[distM, countryName], ...]
// Usage: node scripts/backfill-countries.mjs

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const SAMPLE_M = 50_000  // one geocode per 50km
const RATE_MS  = 1100    // Nominatim 1 req/s

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function sampleByDistance(coords, targetDistM) {
  const out = [{ coord: coords[0], distM: 0 }]
  let accumulated = 0, cumDist = 0
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
    accumulated += d
    cumDist += d
    if (accumulated >= targetDistM) {
      out.push({ coord: coords[i], distM: Math.round(cumDist) })
      accumulated = 0
    }
  }
  const last = coords[coords.length - 1]
  if (out[out.length-1].coord !== last) out.push({ coord: last, distM: Math.round(cumDist) })
  return out
}

async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`,
    { headers: { 'User-Agent': 'OrbiTerra/1.0 (orbiterra.vercel.app)' } }
  )
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = await res.json()
  return data.address?.country ?? data.display_name?.split(', ').pop() ?? '?'
}

async function supabasePatch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/planned_routes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/planned_routes?select=id,coordinates`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  const routes = await res.json()
  console.log(`Found ${routes.length} route(s)`)

  for (const route of routes) {
    const coords = route.coordinates
    const samples = sampleByDistance(coords, SAMPLE_M)
    console.log(`\nRoute ${route.id}: ${samples.length} samples every 50km`)

    const transitions = [] // [[distM, countryName], ...]
    let lastCountry = null

    for (let i = 0; i < samples.length; i++) {
      const { coord: [lng, lat], distM } = samples[i]
      process.stdout.write(`  [${i+1}/${samples.length}] ${(distM/1000).toFixed(0)}km... `)

      let country
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          country = await reverseGeocode(lat, lng)
          break
        } catch (err) {
          if (attempt === 3) throw err
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      console.log(country)
      if (country !== lastCountry) {
        transitions.push([distM, country])
        lastCountry = country
      }

      if (i < samples.length - 1) await new Promise(r => setTimeout(r, RATE_MS))
    }

    console.log(`\n  ${transitions.length} country transitions:`)
    transitions.forEach(([d, c]) => console.log(`    ${(d/1000).toFixed(0)}km — ${c}`))

    await supabasePatch(route.id, { countries: transitions })
    console.log(`  ✓ saved to DB`)
  }

  console.log('\nDone!')
}

main().catch(err => { console.error(err); process.exit(1) })
