import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { wmoToIcon, WeatherIcon } from '@/lib/wmo-codes'

interface WeatherPointRow {
  id: string
  seq: number
  lat: number
  lng: number
  label: string | null
  weather_code: number | null
  temp_min: number | null
  temp_max: number | null
  wind_direction: number | null
  wind_speed: number | null
}

export interface WeatherPointResponse {
  id: string
  seq: number
  lat: number
  lng: number
  label: string | null
  icon: WeatherIcon | null
  temp_min: number | null
  temp_max: number | null
  wind_direction: number | null
  wind_speed: number | null
}

export function formatWeatherPoint(row: WeatherPointRow): WeatherPointResponse {
  return {
    id: row.id,
    seq: row.seq,
    lat: row.lat,
    lng: row.lng,
    label: row.label,
    icon: row.weather_code !== null ? wmoToIcon(row.weather_code) : null,
    temp_min: row.temp_min,
    temp_max: row.temp_max,
    wind_direction: row.wind_direction,
    wind_speed: row.wind_speed,
  }
}

export async function GET() {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase
    .from('weather_points')
    .select('id, seq, lat, lng, label, weather_code, temp_min, temp_max, wind_direction, wind_speed')
    .order('seq', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(formatWeatherPoint))
}
