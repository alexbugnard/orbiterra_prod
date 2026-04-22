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

// opentopodata.org ASTER dataset — global 30m coverage, 100 locations per request
async function fetchElevation(
  locations: { latitude: number; longitude: number }[],
  timeoutMs = 25000,
): Promise<{ latitude: number; longitude: number; elevation: number }[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const locationStr = locations.map((l) => `${l.latitude},${l.longitude}`).join('|')
    const res = await fetch('https://api.opentopodata.org/v1/aster30m', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: locationStr }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) throw new Error('bad response')
    return data.results.map((r: any) => ({
      latitude: r.location.lat,
      longitude: r.location.lng,
      elevation: r.elevation ?? 0,
    }))
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const coordinates: [number, number][] = body.coordinates // [lng, lat][]
  const routeId: string | undefined = body.routeId

  if (!coordinates || coordinates.length < 2) {
    return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 })
  }

  // Sample to 100 points (opentopodata limit per request)
  const MAX = 99
  const step = Math.max(1, Math.ceil(coordinates.length / MAX))
  const sampled: [number, number][] = []
  for (let i = 0; i < coordinates.length; i += step) sampled.push(coordinates[i])
  const last = coordinates[coordinates.length - 1]
  if (sampled[sampled.length - 1] !== last) sampled.push(last)

  const locations = sampled.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))

  console.log(`[elevation] fetching ${locations.length} points for route ${routeId ?? 'unknown'}`)

  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const results = await fetchElevation(locations)

      let cumDist = 0
      const elevation: [number, number][] = []
      for (let i = 0; i < results.length; i++) {
        if (i > 0) {
          cumDist += haversineM(
            results[i - 1].latitude, results[i - 1].longitude,
            results[i].latitude, results[i].longitude,
          )
        }
        elevation.push([cumDist, results[i].elevation])
      }

      if (routeId) {
        const supabase = createSupabaseClient()
        await supabase.from('planned_routes').update({ elevation }).eq('id', routeId)
      }

      console.log(`[elevation] success on attempt ${attempt}`)
      return NextResponse.json({ elevation })
    } catch (err) {
      lastError = err
      console.warn(`[elevation] attempt ${attempt} failed:`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000))
    }
  }

  console.error('[elevation] all attempts failed:', lastError)
  return NextResponse.json({ error: 'elevation fetch failed' }, { status: 502 })
}
