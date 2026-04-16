import { createSupabaseClient } from '@/lib/supabase'
import { getLocale, getTranslations } from 'next-intl/server'
import { MapClient } from '@/components/MapClient'
import { SyncTrigger } from '@/components/SyncTrigger'
import { computeElevationGain } from '@/lib/strava'

// Americas longitude band — excludes Europe/Africa/Asia rides
const AMERICAS_LNG_MIN = -170
const AMERICAS_LNG_MAX = -34

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function plannedRouteKm(coords: [number, number][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    total += haversineKm(lat1, lng1, lat2, lng2)
  }
  return total
}

async function getMapData() {
  const supabase = createSupabaseClient()

  const [{ data: trips }, { data: waypoints }, { data: plannedRoutes }, { data: videos }] = await Promise.all([
    supabase
      .from('trips')
      .select('id, name, start_date, distance_m, coordinates, journal_fr, journal_en, start_lat, start_lng, elevation, country')
      .eq('visible', true)
      .order('start_date', { ascending: true }),
    supabase
      .from('waypoints')
      .select('id, lat, lng, url_large, title'),
    supabase
      .from('planned_routes')
      .select('id, name, coordinates, color'),
    supabase
      .from('videos')
      .select('id, youtube_id, title, published_at')
      .order('published_at', { ascending: false }),
  ])

  const formattedTrips = (trips ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    distance_m: t.distance_m,
    journal_fr: t.journal_fr,
    journal_en: t.journal_en,
    coordinates: t.coordinates ?? [],
    start_lat: t.start_lat as number | null,
    start_lng: t.start_lng as number | null,
    elevation: (t.elevation ?? null) as [number, number][] | null,
    country: (t.country ?? null) as string | null,
  }))

  const formattedPlannedRoutes = (plannedRoutes ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    coordinates: r.coordinates as [number, number][],
    color: r.color,
  }))

  const formattedVideos = (videos ?? []).map((v: any) => ({
    id: v.id as string,
    youtube_id: v.youtube_id as string,
    title: v.title as string,
    published_at: v.published_at as string | null,
  }))

  return {
    trips: formattedTrips,
    waypoints: waypoints ?? [],
    plannedRoutes: formattedPlannedRoutes,
    videos: formattedVideos,
  }
}

function computeAmericasProgress(
  trips: { start_lat: number | null; start_lng: number | null }[],
  plannedCoords: [number, number][]
) {
  if (plannedCoords.length === 0) return null

  const lats = plannedCoords.map(([, lat]) => lat)
  const maxLat = Math.max(...lats) // northernmost (Alaska)
  const minLat = Math.min(...lats) // southernmost (Ushuaia)
  const latSpan = maxLat - minLat

  // Find southernmost latitude reached among Americas trips
  const americasTrips = trips.filter(
    (t) =>
      t.start_lat !== null &&
      t.start_lng !== null &&
      t.start_lng >= AMERICAS_LNG_MIN &&
      t.start_lng <= AMERICAS_LNG_MAX
  )

  if (americasTrips.length === 0) return null

  const southernmost = Math.min(...americasTrips.map((t) => t.start_lat!))
  const pct = Math.min(100, Math.max(0, ((maxLat - southernmost) / latSpan) * 100))

  const totalKm = plannedRouteKm(plannedCoords)
  const kmDone = totalKm * (pct / 100)
  const kmLeft = Math.round(totalKm - kmDone)

  return { pct: Math.round(pct * 10) / 10, kmLeft, totalKm: Math.round(totalKm) }
}

export default async function MapPage() {
  const { trips, waypoints, plannedRoutes, videos } = await getMapData()
  const locale = await getLocale()
  const t = await getTranslations('map')

  const totalKm = Math.round(trips.reduce((sum, t) => sum + (t.distance_m ?? 0), 0) / 1000)
  const totalElevationGain = trips.reduce((sum, t) =>
    sum + (t.elevation ? computeElevationGain(t.elevation) : 0), 0)
  const countries = [...new Set(trips.map(t => t.country).filter(Boolean))]

  const mainPlannedRoute = plannedRoutes[0] ?? null
  const progress = mainPlannedRoute
    ? computeAmericasProgress(trips, mainPlannedRoute.coordinates)
    : null

  const stats = trips.length > 0 ? {
    rides: trips.length,
    totalKm,
    totalElevationGain,
    countries: countries.length,
    progress,
    labels: {
      rides: t('rides'),
      distance: t('distance'),
      km: t('km'),
      elevation: t('elevation'),
      countries: t('countries'),
      americasCrossing: t('americasCrossing'),
      left: t('left'),
    },
  } : null

  return (
    <div className="relative h-[calc(100vh-57px)]">
      <SyncTrigger />
      <MapClient trips={trips} waypoints={waypoints} plannedRoutes={plannedRoutes} videos={videos} locale={locale} stats={stats} />
    </div>
  )
}
