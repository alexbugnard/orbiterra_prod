const STRAVA_BASE = 'https://www.strava.com'

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
}

export function buildStravaAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  })
  return `${STRAVA_BASE}/oauth/authorize?${params}`
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
