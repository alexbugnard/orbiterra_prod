'use client'

import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#9ca3af' }}>
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

export function MapClient({ trips, waypoints, locale }: { trips: Trip[]; waypoints: Waypoint[]; locale: string }) {
  return <Map trips={trips} waypoints={waypoints} locale={locale} />
}
