import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export interface RoutePoi {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  wiki_slug: string
  type: 'mountain' | 'pass' | 'lake'
}

export async function GET() {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('route_pois')
    .select('id, name, country, lat, lng, wiki_slug, type')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
