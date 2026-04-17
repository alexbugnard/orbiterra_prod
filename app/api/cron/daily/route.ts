import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runStravaSync } from '../strava/route'
import { fetchChannelVideos } from '@/lib/youtube'
import { fetchWeatherForPoints } from '@/lib/open-meteo'
import { createSupabaseClient } from '@/lib/supabase'

function verifyCronSecret(headers: Headers): boolean {
  const auth = headers.get('Authorization')
  if (!auth) return false
  const expected = `Bearer ${process.env.CRON_SECRET}`
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  // 1. Strava sync
  try {
    results.strava = await runStravaSync()
  } catch (err) {
    results.strava = { error: String(err) }
  }

  // 2. YouTube sync
  try {
    const channelId = process.env.YOUTUBE_CHANNEL_ID ?? 'UCxOaBkNDFV1BRL_eUMWuQyQ'
    const videos = await fetchChannelVideos(channelId)
    const supabase = createSupabaseClient()
    let upserted = 0
    for (const video of videos) {
      const { error } = await supabase.from('videos').upsert({
        youtube_id: video.youtube_id,
        title: video.title,
        published_at: video.published_at,
      }, { onConflict: 'youtube_id' })
      if (!error) upserted++
    }
    results.youtube = { upserted }
  } catch (err) {
    results.youtube = { error: String(err) }
  }

  // 3. Weather sync
  try {
    const supabase = createSupabaseClient()
    const { data: points } = await supabase
      .from('weather_points')
      .select('id, lat, lng')
      .order('seq', { ascending: true })
    if (points && points.length > 0) {
      const forecasts = await fetchWeatherForPoints(points)
      const now = new Date().toISOString()
      let updated = 0
      for (let i = 0; i < points.length; i++) {
        const f = forecasts[i]
        if (!f) continue
        const { error } = await supabase.from('weather_points').update({
          weather_code: f.weather_code,
          temp_min: f.temp_min,
          temp_max: f.temp_max,
          wind_direction: f.wind_direction,
          wind_speed: f.wind_speed,
          fetched_at: now,
        }).eq('id', points[i].id)
        if (!error) updated++
      }
      results.weather = { updated }
    } else {
      results.weather = { skipped: 'no points seeded' }
    }
  } catch (err) {
    results.weather = { error: String(err) }
  }

  return NextResponse.json(results)
}
