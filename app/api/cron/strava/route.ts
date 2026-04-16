import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createSupabaseClient } from '@/lib/supabase'
import { refreshStravaToken, fetchStravaActivitiesSince, fetchStravaElevation, fetchStravaPhotos } from '@/lib/strava'
import { decodePolylineToGeoJSON } from '@/lib/polyline'

// Earliest date to ever sync from — rides before this are ignored
const SYNC_EPOCH = new Date('2026-04-01T00:00:00Z')

export function verifyCronSecret(headers: Headers): boolean {
  const auth = headers.get('Authorization')
  if (!auth) return false
  const expected = `Bearer ${process.env.CRON_SECRET}`
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function runStravaSync(): Promise<{ upserted: number; since: string }> {
  const supabase = createSupabaseClient()

  const { data: tokenRow, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', 1)
    .single()

  if (tokenError || !tokenRow) {
    throw new Error('No tokens stored. Complete Strava OAuth first.')
  }

  // Refresh access token if expired
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

  // Determine sync window:
  // - If never synced (last_synced_at is null or before SYNC_EPOCH), start from SYNC_EPOCH
  // - Otherwise, start from last_synced_at to only fetch new activities
  const lastSynced = tokenRow.last_synced_at ? new Date(tokenRow.last_synced_at) : null
  const since = (!lastSynced || lastSynced < SYNC_EPOCH) ? SYNC_EPOCH : lastSynced

  const activities = await fetchStravaActivitiesSince(accessToken, since)

  let upserted = 0
  for (const activity of activities) {
    // Skip non-ride activities
    if (activity.type && !['Ride', 'VirtualRide', 'EBikeRide', 'MountainBikeRide', 'GravelRide'].includes(activity.type)) {
      continue
    }

    const path = decodePolylineToGeoJSON(activity.map?.summary_polyline ?? '')
    const firstCoord = path?.coordinates[0] // [lng, lat]
    const endDate = new Date(
      new Date(activity.start_date).getTime() + activity.elapsed_time * 1000
    )
    const elevation = await fetchStravaElevation(accessToken, activity.id)

    const { data: tripRow } = await supabase.from('trips').upsert({
      strava_id: activity.id,
      name: activity.name,
      start_date: activity.start_date,
      end_date: endDate.toISOString(),
      distance_m: Math.round(activity.distance),
      path: path ?? null,
      start_lng: firstCoord ? firstCoord[0] : null,
      start_lat: firstCoord ? firstCoord[1] : null,
      elevation: elevation ?? null,
      visible: true,
    }, { onConflict: 'strava_id' }).select('id').single()

    // Sync Strava photos for this activity
    if (tripRow?.id) {
      const photos = await fetchStravaPhotos(accessToken, activity.id)
      for (const photo of photos) {
        if (!photo.location) continue // skip photos without GPS
        const url = photo.urls['2048'] ?? photo.urls[Object.keys(photo.urls)[0]]
        if (!url) continue
        await supabase.from('waypoints').upsert({
          trip_id: tripRow.id,
          lat: photo.location[0],
          lng: photo.location[1],
          url_large: url,
          title: photo.caption,
          flickr_id: `strava_${photo.unique_id}`, // reuse flickr_id column as unique key
        }, { onConflict: 'flickr_id' })
      }
    }

    upserted++
  }

  await supabase.from('tokens').update({
    last_synced_at: new Date().toISOString(),
  }).eq('id', 1)

  return { upserted, since: since.toISOString() }
}

// Called by Vercel Cron (requires secret)
export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runStravaSync()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Strava sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
