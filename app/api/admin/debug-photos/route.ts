import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { refreshStravaToken } from '@/lib/strava'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('activity_id')
  if (!activityId) return NextResponse.json({ error: 'missing activity_id' }, { status: 400 })

  const supabase = createSupabaseClient()
  const { data: tokenRow } = await supabase.from('tokens').select('*').eq('id', 1).single()
  if (!tokenRow) return NextResponse.json({ error: 'no token' }, { status: 400 })

  let accessToken = tokenRow.access_token
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshed = await refreshStravaToken(tokenRow.refresh_token)
    accessToken = refreshed.access_token
  }

  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/photos?photo_sources=true&size=2048`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const raw = await res.json()
  return NextResponse.json({ status: res.status, photos: raw })
}
