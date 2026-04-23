import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export interface RouteCity {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  wiki_slug: string
}

export async function GET() {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('route_cities')
    .select('id, name, country, lat, lng, wiki_slug')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
