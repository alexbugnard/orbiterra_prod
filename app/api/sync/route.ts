import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { runStravaSync } from '../cron/strava/route'

// Simple in-memory cooldown — prevents hammering Strava API on every page load
// Resets on server restart, but good enough for a personal app
let lastSyncAttempt = 0
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

export async function POST() {
  const now = Date.now()
  if (now - lastSyncAttempt < COOLDOWN_MS) {
    return NextResponse.json({ skipped: true, reason: 'cooldown' })
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

  lastSyncAttempt = now

  try {
    const result = await runStravaSync()
    return NextResponse.json({ synced: true, ...result })
  } catch (err) {
    console.error('Auto-sync error:', err)
    return NextResponse.json({ skipped: true, reason: String(err) })
  }
}
