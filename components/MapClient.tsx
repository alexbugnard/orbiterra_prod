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

interface MapClientProps {
  trips: Trip[]
  waypoints: Waypoint[]
  plannedRoutes: PlannedRoute[]
  videos: Video[]
  locale: string
  externalHover?: ExternalHover
}

export function MapClient({ trips, waypoints, plannedRoutes, videos, locale, externalHover }: MapClientProps) {
  return <Map trips={trips} waypoints={waypoints} plannedRoutes={plannedRoutes} videos={videos} locale={locale} externalHover={externalHover} />
}
