import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { runStravaSync } from '../cron/strava/route'
import { auth } from '@/lib/auth'

export async function GET() { return handler() }
export async function POST() { return handler() }

async function handler() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Strava is connected at all
  const supabase = createSupabaseClient()
  const { data: tokenRow } = await supabase
    .from('tokens')
    .select('id')
    .eq('id', 1)
    .single()

  if (!tokenRow) {
    return NextResponse.json({ skipped: true, reason: 'not_connected' })
  }

  try {
    const result = await runStravaSync()
    return NextResponse.json({ synced: true, ...result })
  } catch (err) {
    console.error('Auto-sync error:', err)
    return NextResponse.json({ skipped: true, reason: 'sync_error' })
  }
}
