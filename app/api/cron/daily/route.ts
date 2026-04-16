import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runStravaSync } from '../strava/route'
import { fetchChannelVideos } from '@/lib/youtube'
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

  return NextResponse.json(results)
}
