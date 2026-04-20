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

function findPeakLocations(streams) {
  const { time, latlng, distance, altitude } = streams
  let maxSpeed = 0, maxSpeedIdx = -1
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0 || dt > 60) continue
    const speed = (distance[i] - distance[i - 1]) / dt
    if (speed > maxSpeed) { maxSpeed = speed; maxSpeedIdx = i }
  }
  let maxAlt = -Infinity, maxAltIdx = -1
  for (let i = 0; i < altitude.length; i++) {
    if (altitude[i] > maxAlt) { maxAlt = altitude[i]; maxAltIdx = i }
  }
  return {
    max_speed_lat: maxSpeedIdx >= 0 ? latlng[maxSpeedIdx][0] : null,
    max_speed_lng: maxSpeedIdx >= 0 ? latlng[maxSpeedIdx][1] : null,
    elev_high_lat: maxAltIdx >= 0 ? latlng[maxAltIdx][0] : null,
    elev_high_lng: maxAltIdx >= 0 ? latlng[maxAltIdx][1] : null,
  }
}

function detectBreaks(streams, minGapSeconds = 600) {
  const { time, latlng, distance, altitude } = streams
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
  // Skip fake test trips
  if (trip.strava_id === 9999999999) {
    console.log(`  [${trip.strava_id}] skipping test trip`)
    continue
  }

  const actRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!actRes.ok) { console.log(`  [${trip.strava_id}] activity fetch failed: ${actRes.status}`); await sleep(1100); continue }
  const activity = await actRes.json()

  await sleep(1100)
  const streamRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}/streams?keys=time,latlng,distance,altitude&key_by_type=true`, { headers: { Authorization: `Bearer ${accessToken}` } })
  let breaks = null
  let peaks = {}
  if (streamRes.ok) {
    const data = await streamRes.json()
    const streams = { time: data.time?.data ?? [], latlng: data.latlng?.data ?? [], distance: data.distance?.data ?? [], altitude: data.altitude?.data ?? [] }
    if (streams.time.length > 0) {
      const detected = detectBreaks(streams)
      breaks = detected.length > 0 ? detected : null
      peaks = findPeakLocations(streams)
    }
  }

  await supabase.from('trips').update({
    max_speed_ms: activity.max_speed ?? null,
    elev_high: activity.elev_high ?? null,
    breaks,
    ...peaks,
  }).eq('id', trip.id)

  console.log(`  [${trip.strava_id}] max_speed=${activity.max_speed?.toFixed(1) ?? 'null'} elev_high=${activity.elev_high ?? 'null'} breaks=${breaks?.length ?? 0} peaks=${JSON.stringify(peaks)}`)
  await sleep(1100)
}
console.log('Backfill complete.')
