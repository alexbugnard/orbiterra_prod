import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

function extractYoutubeId(input: string): string | null {
  // Accept bare ID or any youtube URL format
  const patterns = [
    /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ]
  for (const re of patterns) {
    const m = input.match(re)
    if (m) return m[1]
  }
  return null
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, title } = await request.json()
  const youtubeId = extractYoutubeId(url ?? '')
  if (!youtubeId) return NextResponse.json({ error: 'Invalid YouTube URL or ID' }, { status: 400 })

  const supabase = createSupabaseClient()
  const { error } = await supabase.from('videos').insert({
    youtube_id: youtubeId,
    title: title || youtubeId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, youtube_id: youtubeId })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const supabase = createSupabaseClient()
  const { error } = await supabase.from('videos').delete().eq('id', id)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
