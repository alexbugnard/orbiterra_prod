'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

function MapLoading() {
  const t = useTranslations('map')
  return (
    <div className="w-full h-full flex items-center justify-center text-gray-400">
      {t('loading')}
    </div>
  )
}

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => <MapLoading />,
})

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  journal_fr: string | null
  journal_en: string | null
  coordinates: [number, number][]
  elevation: [number, number][] | null
  country?: string | null
  max_speed_ms: number | null
  elev_high: number | null
  breaks: { lat: number; lng: number; duration_min: number; distance_m: number }[] | null
  max_speed_lat: number | null
  max_speed_lng: number | null
  elev_high_lat: number | null
  elev_high_lng: number | null
}

interface Waypoint {
  id: string
  lat: number
  lng: number
  url_large: string
  title: string | null
}

interface PlannedRoute {
  id: string
  name: string
  coordinates: [number, number][]
  color: string
  elevation: [number, number][] | null
  countries: [number, string][] | null
}

interface Video {
  id: string
  youtube_id: string
  title: string
  published_at: string | null
}

interface ExternalHover {
  distance: number | null
  onDistance: (d: number | null) => void
}

interface Stats {
  rides: number
  totalKm: number
  totalElevationGain: number
  countries: number
  progress: { pct: number; kmLeft: number; totalKm: number } | null
  labels: {
    rides: string
    distance: string
    km: string
    elevation: string
    countries: string
    americasCrossing: string
    left: string
  }
}

interface RouteCity {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  wiki_slug: string
}

interface RoutePoi {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  wiki_slug: string
  type: 'mountain' | 'pass' | 'lake'
}

interface MapClientProps {
  trips: Trip[]
  waypoints: Waypoint[]
  plannedRoutes: PlannedRoute[]
  currentTz?: string | null
  videos: Video[]
  locale: string
  externalHover?: ExternalHover
  stats?: Stats | null
  vincentLat?: number | null
  vincentLng?: number | null
  vincentLastDate?: string | null
  routeCities?: RouteCity[]
  routePois?: RoutePoi[]
}

export function MapClient({ trips, waypoints, plannedRoutes, videos, locale, externalHover, stats, currentTz, vincentLat, vincentLng, vincentLastDate, routeCities, routePois }: MapClientProps) {
  return <Map trips={trips} waypoints={waypoints} plannedRoutes={plannedRoutes} videos={videos} locale={locale} externalHover={externalHover} stats={stats} currentTz={currentTz} vincentLat={vincentLat} vincentLng={vincentLng} vincentLastDate={vincentLastDate} routeCities={routeCities ?? []} routePois={routePois ?? []} />
}
