import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { refreshStravaToken, fetchStravaActivitiesSince } from '@/lib/strava'
import { decodePolylineToGeoJSON } from '@/lib/polyline'

export function verifyCronSecret(headers: Headers): boolean {
  const auth = headers.get('Authorization')
  if (!auth) return false
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  // Load stored tokens
  const { data: tokenRow, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', 1)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'No tokens stored. Complete Strava OAuth first.' }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = tokenRow.access_token
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshed = await refreshStravaToken(tokenRow.refresh_token)
    accessToken = refreshed.access_token
    await supabase.from('tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at.toISOString(),
    }).eq('id', 1)
  }

  // Fetch new activities
  const since = new Date(tokenRow.last_synced_at)
  const activities = await fetchStravaActivitiesSince(accessToken, since)

  let upserted = 0
  for (const activity of activities) {
    const path = decodePolylineToGeoJSON(activity.map?.summary_polyline ?? '')
    const endDate = new Date(
      new Date(activity.start_date).getTime() + activity.elapsed_time * 1000
    )

    await supabase.from('trips').upsert({
      strava_id: activity.id,
      name: activity.name,
      start_date: activity.start_date,
      end_date: endDate.toISOString(),
      distance_m: Math.round(activity.distance),
      path: path ? JSON.stringify(path) : null,
    }, { onConflict: 'strava_id' })

    upserted++
  }

  // Update last_synced_at
  await supabase.from('tokens').update({
    last_synced_at: new Date().toISOString(),
  }).eq('id', 1)

  return NextResponse.json({ upserted })
}
