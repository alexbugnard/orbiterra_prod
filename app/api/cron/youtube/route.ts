import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchChannelVideos } from '@/lib/youtube'
import { verifyCronSecret } from '@/app/api/cron/strava/route'

export async function runYoutubeSync(): Promise<{ upserted: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID ?? 'UCxOaBkNDFV1BRL_eUMWuQyQ'
  const videos = await fetchChannelVideos(channelId)
  const supabase = createSupabaseClient()

  let upserted = 0
  for (const video of videos) {
    const { error } = await supabase.from('videos').upsert(
      {
        youtube_id: video.youtube_id,
        title: video.title,
        published_at: video.published_at,
      },
      { onConflict: 'youtube_id' }
    )
    if (!error) upserted++
  }

  return { upserted }
}

// Called by Vercel Cron (requires secret)
export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runYoutubeSync()
    return NextResponse.json(result)
  } catch (err) {
    console.error('YouTube sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
