'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Polyline } from 'leaflet'
import { useTranslations } from 'next-intl'
import { PhotoModal } from './PhotoModal'
import { ElevationProfile } from './ElevationProfile'

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

interface MapProps {
  trips: Trip[]
  waypoints: Waypoint[]
  plannedRoutes: PlannedRoute[]
  videos: Video[]
  locale: string
  externalHover?: ExternalHover
}

function toDateStr(iso: string) {
  return iso.slice(0, 10) // "YYYY-MM-DD"
}

// ── Geo utilities ──────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// coords: [lng, lat][]
function buildCumDists(coords: [number, number][]): number[] {
  const dists: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    dists.push(dists[i - 1] + haversineM(lat1, lng1, lat2, lng2))
  }
  return dists
}

// Returns [lat, lng] for Leaflet
function interpolateOnPath(
  coords: [number, number][],
  cumDists: number[],
  dist: number
): [number, number] | null {
  if (coords.length === 0) return null
  const total = cumDists[cumDists.length - 1]
  if (dist <= 0) return [coords[0][1], coords[0][0]]
  if (dist >= total) {
    const last = coords[coords.length - 1]
    return [last[1], last[0]]
  }
  for (let i = 1; i < cumDists.length; i++) {
    if (cumDists[i] >= dist) {
      const t = (dist - cumDists[i - 1]) / (cumDists[i] - cumDists[i - 1])
      const [lng1, lat1] = coords[i - 1]
      const [lng2, lat2] = coords[i]
      return [lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)]
    }
  }
  return null
}

function closestDistOnPath(
  mouseLat: number,
  mouseLng: number,
  coords: [number, number][],
  cumDists: number[]
): number {
  let bestDist = Infinity
  let bestCum = 0

  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i]
    const [lng2, lat2] = coords[i + 1]

    // Project mouse onto segment [p1, p2] in lat/lng space
    const dx = lng2 - lng1
    const dy = lat2 - lat1
    const lenSq = dx * dx + dy * dy

    let t = 0
    if (lenSq > 0) {
      t = ((mouseLng - lng1) * dx + (mouseLat - lat1) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
    }

    const projLng = lng1 + t * dx
    const projLat = lat1 + t * dy
    const d = haversineM(mouseLat, mouseLng, projLat, projLng)

    if (d < bestDist) {
      bestDist = d
      bestCum = cumDists[i] + t * (cumDists[i + 1] - cumDists[i])
    }
  }

  return bestCum
}

// ──────────────────────────────────────────────────────────────────────────────

export function Map({ trips, waypoints, plannedRoutes, videos, locale, externalHover }: MapProps) {
  const t = useTranslations('map')
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const polylinesRef = useRef<Polyline[]>([])
  const selectedTripIndexRef = useRef<number | null>(null)
  const hoverMarkerRef = useRef<any>(null)
  const cumDistsRef = useRef<number[] | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Waypoint | null>(null)
  const [selectedTripIndex, setSelectedTripIndex] = useState<number | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [hoveredDistance, setHoveredDistance] = useState<number | null>(null)

  // Keep setter in a ref so Leaflet closures (initMap) can access current value
  const setHoveredDistanceRef = useRef(setHoveredDistance)
  const externalHoverRef = useRef(externalHover)
  useEffect(() => {
    setHoveredDistanceRef.current = setHoveredDistance
    externalHoverRef.current = externalHover
  })

  // On the trip detail page (externalHover provided), auto-select the single trip
  const effectiveTripIndex = externalHover !== undefined && trips.length === 1
    ? 0
    : selectedTripIndex

  const selectedTrip = effectiveTripIndex !== null ? trips[effectiveTripIndex] : null

  // Build cumulative distances whenever selected trip changes
  const cumDists = useMemo(() => {
    if (effectiveTripIndex === null) return null
    const trip = trips[effectiveTripIndex]
    if (!trip || trip.coordinates.length < 2) return null
    return buildCumDists(trip.coordinates)
  }, [effectiveTripIndex, trips])

  // Keep cumDists in a ref for use inside Leaflet closures
  useEffect(() => {
    cumDistsRef.current = cumDists
  }, [cumDists])

  // Effect: show/hide orange circle marker on the map based on hoveredDistance
  // When externalHover is provided (trip detail page), use its distance instead
  useEffect(() => {
    const L = (window as any)._L
    if (!L || !mapRef.current) return

    const effectiveDist = externalHoverRef.current !== undefined
      ? externalHoverRef.current.distance
      : hoveredDistance

    const activeTripIndex = externalHoverRef.current !== undefined && trips.length === 1
      ? 0
      : selectedTripIndex

    if (effectiveDist == null || activeTripIndex === null) {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      }
      return
    }

    const trip = trips[activeTripIndex]
    if (!trip || !cumDistsRef.current) return

    const latLng = interpolateOnPath(trip.coordinates, cumDistsRef.current, effectiveDist)
    if (!latLng) return

    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.circleMarker(latLng, {
        radius: 6,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.9,
        opacity: 1,
        weight: 2,
      }).addTo(mapRef.current)
    } else {
      hoverMarkerRef.current.setLatLng(latLng)
      hoverMarkerRef.current.setStyle({ opacity: 1, fillOpacity: 0.9 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredDistance, externalHover?.distance, selectedTripIndex, trips])

  function selectTrip(index: number) {
    setSelectedTripIndex(index)
    selectedTripIndexRef.current = index
    setActiveVideoId(null)
    setHoveredDistance(null)

    // Fly to the trip bounds
    const L = (window as any)._L
    if (!L || !mapRef.current) return
    const trip = trips[index]
    if (trip.coordinates.length < 2) return
    const latLngs = trip.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
    mapRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [60, 60], maxZoom: 12 })

    // Highlight selected, dim others
    polylinesRef.current.forEach((pl, i) => {
      pl.setStyle({
        opacity: i === index ? 1 : 0.25,
        weight: i === index ? 5 : 3,
      })
    })
    // Also dim the glow lines
    const glowLines = (mapRef.current as any)._glowLines as Polyline[]
    if (glowLines) {
      glowLines.forEach((pl, i) => {
        pl.setStyle({ opacity: i === index ? 0.2 : 0.04 })
      })
    }
  }

  function closePanel() {
    setSelectedTripIndex(null)
    setHoveredDistance(null)
    selectedTripIndexRef.current = null
    // Hide marker
    if (hoverMarkerRef.current) hoverMarkerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
    // Restore all polylines
    polylinesRef.current.forEach((pl) => pl.setStyle({ opacity: 0.95, weight: 4 }))
    const glowLines = (mapRef.current as any)?._glowLines as Polyline[]
    if (glowLines) glowLines.forEach((pl) => pl.setStyle({ opacity: 0.15 }))
    // Fit all
    const L = (window as any)._L
    if (!L || !mapRef.current) return
    const allLatLngs = trips.flatMap((t) =>
      t.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
    )
    if (allLatLngs.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current) return

      ;(window as any)._L = L

      const map = L.map(containerRef.current, { zoomControl: false }).setView([46.2276, 2.2137], 6)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      mapRef.current = map

      const glowLines: Polyline[] = []

      trips.forEach((trip, index) => {
        if (trip.coordinates.length < 2) return
        const latLngs = trip.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])

        const glow = L.polyline(latLngs, { color: '#f97316', weight: 14, opacity: 0.15 }).addTo(map)
        glowLines.push(glow)

        const line = L.polyline(latLngs, { color: '#f97316', weight: 4, opacity: 0.95 }).addTo(map)
        polylinesRef.current.push(line)

        line.on('click', () => selectTrip(index))
        glow.on('click', () => selectTrip(index))

        // Hover effect
        line.on('mouseover', () => {
          if (selectedTripIndexRef.current === null) line.setStyle({ weight: 6, opacity: 1 })
        })
        line.on('mouseout', () => {
          if (selectedTripIndexRef.current === null) line.setStyle({ weight: 4, opacity: 0.95 })
          // Clear hovered distance when leaving polyline
          if (selectedTripIndexRef.current === index || externalHoverRef.current !== undefined) {
            setHoveredDistanceRef.current(null)
            externalHoverRef.current?.onDistance(null)
          }
        })

        // Map → Profile: track mouse position along polyline
        line.on('mousemove', (e: any) => {
          const isExternalMode = externalHoverRef.current !== undefined
          if (!isExternalMode && selectedTripIndexRef.current !== index) return
          if (isExternalMode && index !== 0) return
          const cd = cumDistsRef.current
          if (!cd) return
          const { lat, lng } = e.latlng
          const dist = closestDistOnPath(lat, lng, trip.coordinates, cd)
          setHoveredDistanceRef.current(dist)
          externalHoverRef.current?.onDistance(dist)
        })
      })

      ;(map as any)._glowLines = glowLines

      // Planned routes (dashed, drawn below trip lines)
      for (const route of (plannedRoutes ?? [])) {
        if (route.coordinates.length < 2) continue
        const latLngs = route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
        // Glow
        L.polyline(latLngs, {
          color: route.color,
          weight: 10,
          opacity: 0.08,
          dashArray: undefined,
        }).addTo(map)
        // Dashed line
        L.polyline(latLngs, {
          color: route.color,
          weight: 2,
          opacity: 0.7,
          dashArray: '8, 10',
        }).addTo(map)
      }

      // Camera markers
      const cameraIcon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;background:#1e293b;
          border:2px solid #f97316;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;box-shadow:0 0 0 4px rgba(249,115,22,0.15);
          cursor:pointer;">📷</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      // Zoom threshold: show markers only when ~200km or less is visible (~zoom 9)
      const PHOTO_ZOOM_THRESHOLD = 9
      const waypointMarkers: any[] = []

      for (const wp of waypoints) {
        const marker = L.marker([wp.lat, wp.lng], { icon: cameraIcon })
        marker.on('click', () => setSelectedPhoto(wp))
        waypointMarkers.push(marker)
      }

      function updateMarkerVisibility() {
        const zoom = map.getZoom()
        if (zoom >= PHOTO_ZOOM_THRESHOLD) {
          waypointMarkers.forEach((m) => { if (!map.hasLayer(m)) m.addTo(map) })
        } else {
          waypointMarkers.forEach((m) => { if (map.hasLayer(m)) m.remove() })
        }
      }

      map.on('zoomend', updateMarkerVisibility)
      updateMarkerVisibility()

      const allLatLngs = trips.flatMap((t) =>
        t.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      )
      if (allLatLngs.length > 0) {
        map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
      }
    }

    initMap()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      polylinesRef.current = []
    }
  }, [])

  const prevIndex = selectedTripIndex !== null && selectedTripIndex > 0 ? selectedTripIndex - 1 : null
  const nextIndex = selectedTripIndex !== null && selectedTripIndex < trips.length - 1 ? selectedTripIndex + 1 : null

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />

      {/* Trip detail panel — hidden on trip detail page (externalHover mode) */}
      {externalHover === undefined && <div
        className="absolute top-4 right-4 bottom-4 z-[1000] w-80 flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51,65,85,0.8)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          transform: selectedTrip ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
          pointerEvents: selectedTrip ? 'all' : 'none',
        }}
      >
        {selectedTrip && selectedTripIndex !== null && (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-slate-700/50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                  {t('rideCount', { index: selectedTripIndex + 1, total: trips.length })}
                </div>
                <button
                  onClick={closePanel}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <h2 className="text-lg font-bold text-white leading-tight mb-1">{selectedTrip.name}</h2>
              <p className="text-sm text-slate-400">
                {new Date(selectedTrip.start_date).toLocaleDateString(locale, {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px bg-slate-700/30 border-b border-slate-700/50">
              <div className="px-5 py-3 bg-slate-900/50">
                <div className="text-xl font-bold text-white">{(selectedTrip.distance_m / 1000).toFixed(1)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('km')}</div>
              </div>
              <div className="px-5 py-3 bg-slate-900/50">
                <div className="text-xl font-bold text-white">
                  {waypoints.filter(wp => {
                    // approximate: check if waypoint is near this trip's time
                    return true
                  }).length}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t('photos')}</div>
              </div>
            </div>

            {/* Elevation profile */}
            {selectedTrip.elevation && selectedTrip.elevation.length > 1 && (
              <div className="px-5 py-3 border-b border-slate-700/30">
                <ElevationProfile
                  points={selectedTrip.elevation}
                  hoveredDistance={hoveredDistance}
                  onHoverDistance={setHoveredDistance}
                />
              </div>
            )}

            {/* Journal + Videos */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {(locale === 'fr' ? selectedTrip.journal_fr : selectedTrip.journal_en) ? (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {locale === 'fr' ? selectedTrip.journal_fr : selectedTrip.journal_en}
                </p>
              ) : (
                <p className="text-sm text-slate-600 italic">{t('noJournal')}</p>
              )}

              {/* Videos posted on the same day as this ride */}
              {(() => {
                const rideDate = toDateStr(selectedTrip.start_date)
                const dayVideos = videos.filter(
                  (v) => v.published_at && toDateStr(v.published_at) === rideDate
                )
                if (dayVideos.length === 0) return null
                return (
                  <div className="pt-2 border-t border-slate-700/50 space-y-2">
                    <div className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                      {t('videosTitle')}
                    </div>
                    {dayVideos.map((video) => (
                      <div key={video.id} className="rounded-xl overflow-hidden border border-slate-700">
                        {activeVideoId === video.youtube_id ? (
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1`}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full aspect-video"
                          />
                        ) : (
                          <button
                            className="relative w-full group"
                            onClick={() => setActiveVideoId(video.youtube_id)}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                              alt={video.title}
                              className="w-full aspect-video object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
                              </div>
                            </div>
                          </button>
                        )}
                        <div className="px-2.5 py-1.5 text-xs text-slate-400 truncate">{video.title}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Footer: navigation + link */}
            <div className="px-5 py-4 border-t border-slate-700/50 space-y-3">
              <a
                href={`/trips/${selectedTrip.id}`}
                className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {t('viewTrip')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>

              {/* Prev / Next */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => prevIndex !== null && selectTrip(prevIndex)}
                  disabled={prevIndex === null}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  {t('previous')}
                </button>
                <button
                  onClick={() => nextIndex !== null && selectTrip(nextIndex)}
                  disabled={nextIndex === null}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {t('next')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>}

      {selectedPhoto && (
        <PhotoModal
          imageUrl={selectedPhoto.url_large}
          title={selectedPhoto.title ?? ''}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </>
  )
}
