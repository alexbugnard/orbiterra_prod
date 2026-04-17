import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'
import { parseTokenResponse } from '@/lib/strava'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 })
  }

  const tokens = parseTokenResponse(await res.json())
  const supabase = createSupabaseClient()

  await supabase.from('tokens').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at.toISOString(),
    last_synced_at: new Date(0).toISOString(),
  }, { onConflict: 'id' })

  return NextResponse.redirect(new URL('/admin', request.url))
}
