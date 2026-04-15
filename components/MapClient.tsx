'use client'

import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400">
      Loading map...
    </div>
  ),
})

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  journal_fr: string | null
  journal_en: string | null
  coordinates: [number, number][]
}

interface Waypoint {
  id: string
  lat: number
  lng: number
  url_large: string
  title: string | null
}

interface MapClientProps {
  trips: Trip[]
  waypoints: Waypoint[]
  locale: string
}

export function MapClient({ trips, waypoints, locale }: MapClientProps) {
  return <Map trips={trips} waypoints={waypoints} locale={locale} />
}
