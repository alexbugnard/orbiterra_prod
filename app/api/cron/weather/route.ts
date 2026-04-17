import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchWeatherForPoints } from '@/lib/open-meteo'
import { verifyCronSecret } from '@/app/api/cron/strava/route'

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  const { data: points, error } = await supabase
    .from('weather_points')
    .select('id, lat, lng')
    .order('seq', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!points || points.length === 0) {
    return NextResponse.json({ message: 'No weather points seeded yet.' })
  }

  const forecasts = await fetchWeatherForPoints(points)

  const now = new Date().toISOString()

  let failedCount = 0
  for (let i = 0; i < points.length; i++) {
    const forecast = forecasts[i]
    if (!forecast) continue

    const { error: updateError } = await supabase.from('weather_points').update({
      weather_code: forecast.weather_code,
      temp_min: forecast.temp_min,
      temp_max: forecast.temp_max,
      wind_direction: forecast.wind_direction,
      wind_speed: forecast.wind_speed,
      fetched_at: now,
    }).eq('id', points[i].id)

    if (updateError) failedCount++
  }

  return NextResponse.json({ updated: points.length - failedCount, failed: failedCount })
}
