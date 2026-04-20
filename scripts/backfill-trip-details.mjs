import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
const STRAVA_BASE = 'https://www.strava.com'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function refreshToken() {
  const { data } = await supabase.from('tokens').select('*').eq('id', 1).single()
  if (!data) throw new Error('No tokens found')
  if (new Date(data.expires_at) > new Date()) return data.access_token
  const res = await fetch(`${STRAVA_BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: data.refresh_token })
  })
  const refreshed = await res.json()
  await supabase.from('tokens').update({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: new Date(refreshed.expires_at * 1000).toISOString() }).eq('id', 1)
  return refreshed.access_token
}

function detectBreaks(streams, minGapSeconds = 600) {
  const { time, latlng, distance } = streams
  const breaks = []
  for (let i = 1; i < time.length; i++) {
    const gap = time[i] - time[i - 1]
    if (gap >= minGapSeconds) {
      breaks.push({ lat: latlng[i-1][0], lng: latlng[i-1][1], duration_min: Math.round(gap/60), distance_m: Math.round(distance[i-1] ?? 0) })
    }
  }
  return breaks
}

const accessToken = await refreshToken()

const { data: trips } = await supabase.from('trips').select('id, strava_id').not('strava_id', 'is', null)
console.log(`Backfilling ${trips.length} trips…`)

for (const trip of trips) {
  // Skip fake test trips (strava_id > 9999999000 are seeds)
  if (trip.strava_id > 9999999000) {
    console.log(`  [${trip.strava_id}] skipping test trip`)
    continue
  }

  const actRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!actRes.ok) { console.log(`  [${trip.strava_id}] activity fetch failed: ${actRes.status}`); await sleep(1100); continue }
  const activity = await actRes.json()

  await sleep(1100)
  const streamRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}/streams?keys=time,latlng,distance&key_by_type=true`, { headers: { Authorization: `Bearer ${accessToken}` } })
  let breaks = null
  if (streamRes.ok) {
    const data = await streamRes.json()
    const streams = { time: data.time?.data ?? [], latlng: data.latlng?.data ?? [], distance: data.distance?.data ?? [] }
    if (streams.time.length > 0) {
      const detected = detectBreaks(streams)
      breaks = detected.length > 0 ? detected : null
    }
  }

  await supabase.from('trips').update({
    max_speed_ms: activity.max_speed ?? null,
    elev_high: activity.elev_high ?? null,
    breaks,
  }).eq('id', trip.id)

  console.log(`  [${trip.strava_id}] max_speed=${activity.max_speed?.toFixed(1) ?? 'null'} elev_high=${activity.elev_high ?? 'null'} breaks=${breaks?.length ?? 0}`)
  await sleep(1100)
}
console.log('Backfill complete.')
