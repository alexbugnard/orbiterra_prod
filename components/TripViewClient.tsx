'use client'

import { useState } from 'react'
import { MapClient } from '@/components/MapClient'
import { ElevationProfile } from '@/components/ElevationProfile'

interface Waypoint {
  id: string
  lat: number
  lng: number
  url_large: string
  title: string | null
}

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  journal_fr: string | null
  journal_en: string | null
  coordinates: [number, number][]
  elevation: [number, number][] | null
  start_lat: number | null
  start_lng: number | null
}

interface TripViewClientProps {
  trip: Trip
  waypoints: Waypoint[]
  locale: string
  distanceKm: string
  date: string
  journal: string | null
}

export function TripViewClient({
  trip,
  waypoints,
  locale,
  distanceKm,
  date,
  journal,
}: TripViewClientProps) {
  const [hoveredDistance, setHoveredDistance] = useState<number | null>(null)

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-slate-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800" style={{ background: 'rgba(15,23,42,0.95)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight truncate">{trip.name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{date}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xl font-bold text-orange-400">{distanceKm}</div>
              <div className="text-xs text-slate-500">km</div>
            </div>
            {waypoints && waypoints.length > 0 && (
              <>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-right">
                  <div className="text-xl font-bold text-white">{waypoints.length}</div>
                  <div className="text-xs text-slate-500">photos</div>
                </div>
              </>
            )}
          </div>
        </div>

        {journal && (
          <p className="mt-3 text-sm text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
            {journal}
          </p>
        )}

        {trip.elevation && trip.elevation.length > 1 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <ElevationProfile
              points={trip.elevation}
              hoveredDistance={hoveredDistance}
              onHoverDistance={setHoveredDistance}
            />
          </div>
        )}
      </div>

      <div className="flex-1">
        <MapClient
          trips={[trip]}
          waypoints={waypoints ?? []}
          plannedRoutes={[]}
          videos={[]}
          locale={locale}
          externalHover={{ distance: hoveredDistance, onDistance: setHoveredDistance }}
        />
      </div>
    </div>
  )
}
