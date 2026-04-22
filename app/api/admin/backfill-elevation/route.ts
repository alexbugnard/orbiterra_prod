import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchElevation(locations: { latitude: number; longitude: number }[]) {
  const locationStr = locations.map((l) => `${l.latitude},${l.longitude}`).join('|')
  const res = await fetch('https://api.opentopodata.org/v1/aster30m', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: locationStr }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) throw new Error(`bad response: ${JSON.stringify(data)}`)
  return data.results.map((r: any) => ({
    latitude: r.location.lat,
    longitude: r.location.lng,
    elevation: r.elevation ?? 0,
  }))
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()
  const { data: routes, error } = await supabase
    .from('planned_routes')
    .select('id, coordinates')

  if (error || !routes?.length) {
    return NextResponse.json({ error: error?.message ?? 'no routes' }, { status: 500 })
  }

  const results: { id: string; status: string; points?: number }[] = []

  for (const route of routes) {
    const coordinates: [number, number][] = route.coordinates
    if (!coordinates || coordinates.length < 2) {
      results.push({ id: route.id, status: 'skipped (no coords)' })
      continue
    }

    try {
      // Sample to 100 points (opentopodata limit)
      const MAX = 99
      const step = Math.max(1, Math.ceil(coordinates.length / MAX))
      const sampled: [number, number][] = []
      for (let i = 0; i < coordinates.length; i += step) sampled.push(coordinates[i])
      const last = coordinates[coordinates.length - 1]
      if (sampled[sampled.length - 1] !== last) sampled.push(last)

      const locations = sampled.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      const elevData = await fetchElevation(locations)

      let cumDist = 0
      const elevation: [number, number][] = []
      for (let i = 0; i < elevData.length; i++) {
        if (i > 0) {
          cumDist += haversineM(
            elevData[i - 1].latitude, elevData[i - 1].longitude,
            elevData[i].latitude, elevData[i].longitude,
          )
        }
        elevation.push([cumDist, elevData[i].elevation])
      }

      await supabase.from('planned_routes').update({ elevation }).eq('id', route.id)
      results.push({ id: route.id, status: 'ok', points: elevation.length })

      // Respect opentopodata rate limit (1 req/s)
      await new Promise((r) => setTimeout(r, 1100))
    } catch (err: any) {
      results.push({ id: route.id, status: `error: ${err.message}` })
    }
  }

  return NextResponse.json({ results })
}
