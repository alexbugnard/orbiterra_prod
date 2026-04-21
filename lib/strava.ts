import { randomBytes } from 'crypto'

const STRAVA_BASE = 'https://www.strava.com'

export function computeElevationGain(elevation: [number, number][]): number {
  let gain = 0
  for (let i = 1; i < elevation.length; i++) {
    const diff = elevation[i][1] - elevation[i - 1][1]
    if (diff > 0) gain += diff
  }
  return Math.round(gain)
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'OrbiTerra/1.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.address?.country ?? null
  } catch {
    return null
  }
}

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: Date
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  elapsed_time: number
  distance: number
  map: { summary_polyline: string }
  max_speed: number | null
  elev_high: number | null
}

export function buildStravaAuthUrl(redirectUri: string): { url: string; state: string } {
  const state = randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
    state,
  })
  return { url: `${STRAVA_BASE}/oauth/authorize?${params}`, state }
}

export function parseTokenResponse(raw: {
  access_token: string
  refresh_token: string
  expires_at: number
}): StravaTokens {
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: new Date(raw.expires_at * 1000),
  }
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(`${STRAVA_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`)
  }

  return parseTokenResponse(await res.json())
}

export async function fetchStravaElevation(
  accessToken: string,
  activityId: number
): Promise<[number, number][] | null> {
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/activities/${activityId}/streams?keys=altitude,distance&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null

  const data = await res.json()
  const altitudes: number[] = data.altitude?.data ?? []
  const distances: number[] = data.distance?.data ?? []

  if (altitudes.length === 0) return null

  // Sample down to ~200 points max to keep DB size reasonable
  const step = Math.max(1, Math.floor(altitudes.length / 200))
  const points: [number, number][] = []
  for (let i = 0; i < altitudes.length; i += step) {
    points.push([Math.round(distances[i] ?? 0), Math.round(altitudes[i])])
  }
  return points
}

export interface StravaStreams {
  time: number[]
  latlng: [number, number][]
  distance: number[]
  altitude: number[]
}

export async function fetchStravaStreams(
  accessToken: string,
  activityId: number
): Promise<StravaStreams | null> {
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/activities/${activityId}/streams?keys=time,latlng,distance,altitude&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const time: number[] = data.time?.data ?? []
  const latlng: [number, number][] = data.latlng?.data ?? []
  const distance: number[] = data.distance?.data ?? []
  const altitude: number[] = data.altitude?.data ?? []
  if (time.length === 0 || latlng.length === 0) return null
  return { time, latlng, distance, altitude }
}

export interface PeakLocations {
  max_speed_lat: number | null
  max_speed_lng: number | null
  max_speed_distance_m: number | null
  elev_high_lat: number | null
  elev_high_lng: number | null
}

export function findPeakLocations(streams: StravaStreams): PeakLocations {
  const { time, latlng, distance, altitude } = streams

  // Max speed: derive from distance/time derivative, skip gaps >60s (breaks)
  let maxSpeed = 0
  let maxSpeedIdx = -1
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0 || dt > 60) continue
    const speed = (distance[i] - distance[i - 1]) / dt
    if (speed > maxSpeed) { maxSpeed = speed; maxSpeedIdx = i }
  }

  // Max altitude
  let maxAlt = -Infinity
  let maxAltIdx = -1
  for (let i = 0; i < altitude.length; i++) {
    if (altitude[i] > maxAlt) { maxAlt = altitude[i]; maxAltIdx = i }
  }

  return {
    max_speed_lat: maxSpeedIdx >= 0 ? latlng[maxSpeedIdx][0] : null,
    max_speed_lng: maxSpeedIdx >= 0 ? latlng[maxSpeedIdx][1] : null,
    max_speed_distance_m: maxSpeedIdx >= 0 ? (distance[maxSpeedIdx] ?? null) : null,
    elev_high_lat: maxAltIdx >= 0 ? latlng[maxAltIdx][0] : null,
    elev_high_lng: maxAltIdx >= 0 ? latlng[maxAltIdx][1] : null,
  }
}

export interface TripBreak {
  lat: number
  lng: number
  duration_min: number
  distance_m: number
}

export function detectBreaks(streams: StravaStreams, minGapSeconds = 600): TripBreak[] {
  const { time, latlng, distance } = streams
  const breaks: TripBreak[] = []
  for (let i = 1; i < time.length; i++) {
    const gap = time[i] - time[i - 1]
    if (gap >= minGapSeconds) {
      breaks.push({
        lat: latlng[i - 1][0],
        lng: latlng[i - 1][1],
        duration_min: Math.round(gap / 60),
        distance_m: Math.round(distance[i - 1] ?? 0),
      })
    }
  }
  return breaks
}

export interface StravaPhoto {
  unique_id: string
  urls: Record<string, string>
  caption: string | null
  location: [number, number] | null // [lat, lng]
}

export async function fetchStravaPhotos(
  accessToken: string,
  activityId: number
): Promise<StravaPhoto[]> {
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/activities/${activityId}/photos?photo_sources=true&size=2048`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []

  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data
    .filter((p: any) => p.urls && (p.location || true)) // keep all, filter by location later
    .map((p: any) => ({
      unique_id: p.unique_id ?? String(p.id),
      urls: p.urls ?? {},
      caption: p.caption ?? null,
      location: Array.isArray(p.location) && p.location.length === 2 ? p.location : null,
    }))
}

export async function fetchStravaActivitiesSince(
  accessToken: string,
  since: Date
): Promise<StravaActivity[]> {
  const after = Math.floor(since.getTime() / 1000)
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    throw new Error(`Strava activities fetch failed: ${res.status}`)
  }

  return res.json()
}
