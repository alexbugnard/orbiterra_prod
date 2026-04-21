'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Polyline } from 'leaflet'
import { useTranslations } from 'next-intl'
import { PhotoModal } from './PhotoModal'
import { ElevationProfile } from './ElevationProfile'
import { useIsMobile } from '@/lib/useIsMobile'
import { computeElevationGain } from '@/lib/strava'
import { WeatherLayer } from './WeatherLayer'
import { SponsorBanner } from './SponsorBanner'

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

interface MapProps {
  trips: Trip[]
  waypoints: Waypoint[]
  plannedRoutes: PlannedRoute[]
  videos: Video[]
  locale: string
  externalHover?: ExternalHover
  stats?: Stats | null
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

function computeRiddenMask(planCoords: [number, number][], trips: { coordinates: [number, number][] }[]): boolean[] {
  const CELL = 0.005
  const riddenCells = new Set<string>()
  for (const trip of trips) {
    for (const [lng, lat] of trip.coordinates) {
      riddenCells.add(`${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`)
    }
  }
  // Smooth mask with window=3 to avoid tiny isolated ridden blips
  const raw = planCoords.map(([lng, lat]) => {
    const cLat = Math.floor(lat / CELL)
    const cLng = Math.floor(lng / CELL)
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        if (riddenCells.has(`${cLat + dLat},${cLng + dLng}`)) return true
      }
    }
    return false
  })
  // Smooth: if majority of window=5 neighbors are true, mark true
  const W = 5
  return raw.map((_, i) => {
    let count = 0
    for (let j = Math.max(0, i - W); j <= Math.min(raw.length - 1, i + W); j++) {
      if (raw[j]) count++
    }
    return count > W
  })
}

function splitRiddenSegments(
  coords: [number, number][],
  mask: boolean[]
): { coords: [number, number][]; ridden: boolean }[] {
  if (coords.length === 0) return []
  const segs: { coords: [number, number][]; ridden: boolean }[] = []
  let cur = mask[0]
  let buf: [number, number][] = [coords[0]]
  for (let i = 1; i < coords.length; i++) {
    if (mask[i] === cur) {
      buf.push(coords[i])
    } else {
      segs.push({ coords: buf, ridden: cur })
      cur = mask[i]
      buf = [coords[i - 1], coords[i]]
    }
  }
  segs.push({ coords: buf, ridden: cur })
  return segs
}

function computeRouteDistances(coords: [number, number][]): { ridden: number; total: number } {
  // Returns total distance (all) — ridden distance computed from mask elsewhere
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    total += haversineM(lat1, lng1, lat2, lng2)
  }
  return { ridden: 0, total }
}

function computeRiddenDistM(coords: [number, number][], mask: boolean[]): number {
  let lastIdx = -1
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) lastIdx = i
  }
  if (lastIdx < 0) return 0
  let d = 0
  for (let i = 1; i <= lastIdx; i++) {
    const [lng1, lat1] = coords[i - 1]
    const [lng2, lat2] = coords[i]
    d += haversineM(lat1, lng1, lat2, lng2)
  }
  return d
}

// ──────────────────────────────────────────────────────────────────────────────

export function Map({ trips, waypoints, plannedRoutes, videos, locale, externalHover, stats }: MapProps) {
  const t = useTranslations('map')
  const isMobile = useIsMobile()
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const polylinesRef = useRef<Polyline[]>([])
  const selectedTripIndexRef = useRef<number | null>(null)
  const hoverMarkerRef = useRef<any>(null)
  const cumDistsRef = useRef<number[] | null>(null)
  const weatherLayerRef = useRef<WeatherLayer | null>(null)
  const waypointMarkersRef = useRef<any[]>([])
  const [showWeather, setShowWeather] = useState(false)
  const [basemap, setBasemap] = useState<'dark' | 'topo'>('dark')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null)
  const [routeElevation, setRouteElevation] = useState<[number, number][] | null>(null)
  const [routeElevationLoading, setRouteElevationLoading] = useState(false)
  const routeElevationCache = useRef<Record<string, [number, number][]>>({})

  useEffect(() => {
    function handler(e: Event) {
      setAboutOpen((e as CustomEvent).detail.open)
    }
    window.addEventListener('aboutmodal', handler)
    return () => window.removeEventListener('aboutmodal', handler)
  }, [])
  const tileLayerRef = useRef<any>(null)
  const plannedLinesRef = useRef<{ segLines: { line: any; ridden: boolean }[]; routeColor: string }[]>([])
  const breakMarkersRef = useRef<any[]>([])
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [selectedTripIndex, setSelectedTripIndex] = useState<number | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [hoveredDistance, setHoveredDistance] = useState<number | null>(null)
  const [hoveredRouteDistance, setHoveredRouteDistance] = useState<number | null>(null)
  const hoverRouteMarkerRef = useRef<any>(null)
  const selectedRouteIndexRef = useRef<number | null>(null)
  const routeCumDistsRef = useRef<number[] | null>(null)

  // Keep setters in refs so Leaflet closures (initMap) can access current values
  const setHoveredDistanceRef = useRef(setHoveredDistance)
  const setHoveredRouteDistanceRef = useRef(setHoveredRouteDistance)
  const externalHoverRef = useRef(externalHover)
  useEffect(() => {
    setHoveredDistanceRef.current = setHoveredDistance
    setHoveredRouteDistanceRef.current = setHoveredRouteDistance
    externalHoverRef.current = externalHover
  })

  // On the trip detail page (externalHover provided), auto-select the single trip
  const effectiveTripIndex = externalHover !== undefined && trips.length === 1
    ? 0
    : selectedTripIndex

  const selectedTrip = effectiveTripIndex !== null ? trips[effectiveTripIndex] : null

  const routePanelData = useMemo(() => {
    if (selectedRouteIndex === null) return null
    const route = plannedRoutes[selectedRouteIndex]
    if (!route) return null
    const mask = computeRiddenMask(route.coordinates, trips)
    const { total } = computeRouteDistances(route.coordinates)
    const ridden = computeRiddenDistM(route.coordinates, mask)
    const totalKm = Math.round(total / 1000)
    const riddenKm = Math.round(ridden / 1000)
    const pct = total > 0 ? Math.round((ridden / total) * 100) : 0
    // Compute riddenUpToM scaled to the elevation profile distances
    let riddenUpToM: number | undefined
    if (routeElevation && routeElevation.length > 0 && total > 0) {
      const fraction = ridden / total
      riddenUpToM = fraction * routeElevation[routeElevation.length - 1][0]
    }
    return { route, totalKm, riddenKm, remainKm: totalKm - riddenKm, pct, riddenUpToM }
  }, [selectedRouteIndex, plannedRoutes, trips, routeElevation])

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

  // Effect: show/hide cyan circle marker on planned route based on hoveredRouteDistance
  useEffect(() => {
    const L = (window as any)._L
    if (!L || !mapRef.current) return
    if (hoveredRouteDistance == null || selectedRouteIndex === null) {
      if (hoverRouteMarkerRef.current) {
        hoverRouteMarkerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      }
      return
    }
    const route = plannedRoutes[selectedRouteIndex]
    if (!route || !routeCumDistsRef.current) return
    const latLng = interpolateOnPath(route.coordinates, routeCumDistsRef.current, hoveredRouteDistance)
    if (!latLng) return
    if (!hoverRouteMarkerRef.current) {
      hoverRouteMarkerRef.current = L.circleMarker(latLng, {
        radius: 6, color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.9, opacity: 1, weight: 2,
      }).addTo(mapRef.current)
    } else {
      hoverRouteMarkerRef.current.setLatLng(latLng)
      hoverRouteMarkerRef.current.setStyle({ opacity: 1, fillOpacity: 0.9 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredRouteDistance, selectedRouteIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!showWeather) {
      weatherLayerRef.current?.hide(map)
      return
    }
    if (!weatherLayerRef.current) {
      const wl = new WeatherLayer()
      weatherLayerRef.current = wl
      wl.addTo(map).then(() => wl.load(map).then(() => wl.show(map)))
    } else {
      weatherLayerRef.current.load(map).then(() => weatherLayerRef.current!.show(map))
    }
  }, [showWeather])

  useEffect(() => {
    const map = mapRef.current
    const L = (window as any)._L
    if (!map || !L || !tileLayerRef.current) return
    tileLayerRef.current.remove()
    if (basemap === 'topo') {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        maxZoom: 17,
      }).addTo(map)
    } else {
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)
    }
  }, [basemap])

  // Restyle map objects when basemap changes
  useEffect(() => {
    if (!mapRef.current) return
    const tripColor = basemap === 'topo' ? '#dc2626' : '#f97316'
    const plannedColor = basemap === 'topo' ? '#1d4ed8' : '#22d3ee'

    // Trip polylines
    polylinesRef.current.forEach((pl) => pl.setStyle({ color: tripColor }))
    const glowLines = (mapRef.current as any)._glowLines as any[]
    if (glowLines) glowLines.forEach((pl: any) => pl.setStyle({ color: tripColor }))

    // Hover marker
    if (hoverMarkerRef.current) hoverMarkerRef.current.setStyle({ color: tripColor, fillColor: tripColor })

    // Planned route lines
    plannedLinesRef.current.forEach(({ segLines, routeColor }) => {
      const unriddenColor = basemap === 'topo' ? '#1d4ed8' : routeColor
      const riddenLineColor = basemap === 'topo' ? '#dc2626' : '#f97316'
      segLines.forEach(({ line, ridden }) => {
        line.setStyle({ color: ridden ? riddenLineColor : unriddenColor })
      })
    })

    // Weather icons
    weatherLayerRef.current?.restyle(basemap)
  }, [basemap])

  function endpointIcon(L: any, type: 'start' | 'end', color: string) {
    const size = 28
    const svgIcon = type === 'start'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
    return L.divIcon({
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;pointer-events:none">${svgIcon}</div>`,
      className: '',
      iconAnchor: [size / 2, size / 2],
    })
  }

  function calloutIcon(L: any, label: string, color: string, lineHeight: number, side: 'left' | 'right' | 'center') {
    // The dot must sit exactly at the geographic coordinate.
    // iconAnchor is always the dot center: [dotCenterX, dotCenterY].
    // The label is shifted left/right via absolute positioning so the dot stays pinned.
    const dotSize = 9
    const labelW = 88
    const iconWidth = labelW + 40  // extra room for side shift without clipping
    const dotCenterX = iconWidth / 2
    const labelHeight = 26  // approx rendered height of label box
    const dotCenterY = labelHeight + lineHeight + dotSize / 2

    const labelShift = side === 'right' ? -20 : side === 'left' ? 20 : 0
    const labelLeft = dotCenterX - labelW / 2 + labelShift

    return L.divIcon({
      html: `<div style="position:relative;width:${iconWidth}px;height:${dotCenterY + dotSize}px;pointer-events:none">
        <div style="position:absolute;left:${labelLeft}px;top:0;width:${labelW}px;background:rgba(10,15,28,0.95);border:2px solid ${color};border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;color:${color};white-space:nowrap;text-align:center;box-shadow:0 3px 10px rgba(0,0,0,0.6);letter-spacing:0.3px">${label}</div>
        <div style="position:absolute;left:${dotCenterX - 1}px;top:${labelHeight}px;width:2px;height:${lineHeight}px;background:${color};opacity:0.7"></div>
        <div style="position:absolute;left:${dotCenterX - dotSize / 2}px;top:${labelHeight + lineHeight}px;width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 3px ${color}44"></div>
      </div>`,
      className: '',
      iconAnchor: [dotCenterX, dotCenterY],
    })
  }

  function snapToTrack(coords: [number, number][], lat: number, lng: number): [number, number] {
    let best: [number, number] = [lat, lng]
    let bestDist = Infinity
    const cosLat = Math.cos(lat * Math.PI / 180)
    for (const [cLng, cLat] of coords) {
      const dLat = cLat - lat
      const dLng = (cLng - lng) * cosLat
      const d = dLat * dLat + dLng * dLng
      if (d < bestDist) { bestDist = d; best = [cLat, cLng] }
    }
    return best
  }

  function addTripMarkers(trip: typeof trips[number], L: any, map: LeafletMap) {
    if (!L || !map) return
    const coords = trip.coordinates

    // Returns the index of the nearest coordinate to lat/lng
    function snapIdx(lat: number, lng: number): number {
      let bestIdx = 0, bestDist = Infinity
      const cosLat = Math.cos(lat * Math.PI / 180)
      for (let i = 0; i < coords.length; i++) {
        const [cLng, cLat] = coords[i]
        const d = (cLat - lat) ** 2 + ((cLng - lng) * cosLat) ** 2
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      return bestIdx
    }

    // Collect all markers, sorted by track position
    const pending: { lat: number; lng: number; label: string; color: string; lineH: number; side: 'left' | 'right' | 'center'; idx: number }[] = []

    if (trip.max_speed_lat != null && trip.max_speed_lng != null) {
      const spdVal = trip.max_speed_ms != null ? Math.round(trip.max_speed_ms * 3.6) : null
      const speedoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline-block;vertical-align:middle;margin-right:3px;margin-bottom:1px"><path d="M3.34 17a10 10 0 1 1 17.32 0"/><line x1="12" y1="12" x2="17" y2="7"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`
      const label = spdVal != null ? `${speedoSvg}${spdVal} km/h` : speedoSvg
      pending.push({ lat: trip.max_speed_lat, lng: trip.max_speed_lng, label, color: '#3b82f6', lineH: 28, side: 'right', idx: snapIdx(trip.max_speed_lat, trip.max_speed_lng) })
    }

    if (trip.elev_high_lat != null && trip.elev_high_lng != null) {
      const label = trip.elev_high != null ? `▲ ${Math.round(trip.elev_high)} m` : '▲'
      pending.push({ lat: trip.elev_high_lat, lng: trip.elev_high_lng, label, color: '#10b981', lineH: 36, side: 'left', idx: snapIdx(trip.elev_high_lat, trip.elev_high_lng) })
    }

    if (trip.breaks) {
      trip.breaks.forEach((b, i) => {
        pending.push({ lat: b.lat, lng: b.lng, label: `⏸ ${b.duration_min} min`, color: '#f59e0b', lineH: 24, side: i % 2 === 0 ? 'right' : 'left', idx: snapIdx(b.lat, b.lng) })
      })
    }

    // Sort by position along track then stagger overlapping markers
    pending.sort((a, b) => a.idx - b.idx)
    const overlapWindow = Math.max(4, Math.floor(coords.length / 60))
    for (let i = 1; i < pending.length; i++) {
      if (pending[i].idx - pending[i - 1].idx < overlapWindow) {
        pending[i].lineH = pending[i - 1].lineH + 20
        // Flip side to reduce label overlap
        pending[i].side = pending[i - 1].side === 'left' ? 'right' : 'left'
      }
    }

    const created: any[] = []
    for (const m of pending) {
      const [sLat, sLng] = snapToTrack(coords, m.lat, m.lng)
      const marker = L.marker([sLat, sLng], { icon: calloutIcon(L, m.label, m.color, m.lineH, m.side) }).addTo(map)
      breakMarkersRef.current.push(marker)
      created.push(marker)
    }

    // Start / end markers
    if (coords.length >= 2) {
      const [startLng, startLat] = coords[0]
      const [endLng, endLat] = coords[coords.length - 1]
      const startM = L.marker([startLat, startLng], { icon: endpointIcon(L, 'start', '#22c55e') }).addTo(map)
      const endM = L.marker([endLat, endLng], { icon: endpointIcon(L, 'end', '#ef4444') }).addTo(map)
      breakMarkersRef.current.push(startM, endM)
      created.push(startM, endM)
    }

    return created
  }

  function setupMarkerSpread(allMarkers: any[], map: LeafletMap) {
    if (allMarkers.length < 2) return
    const PIXEL_THRESHOLD = 48
    const SPREAD_PX = 52

    // Store original state once
    allMarkers.forEach((m) => {
      m._origLatLng = m.getLatLng()
      m._origIcon = m.options.icon
      m._isSpread = false
    })

    let mouseMoveCleanup: (() => void) | null = null

    // Restore all spread markers (called on zoom change or mouse-leave)
    function restoreAll() {
      if (mouseMoveCleanup) { mouseMoveCleanup(); mouseMoveCleanup = null }
      allMarkers.forEach((m) => {
        if (!m._isSpread) return
        m._isSpread = false
        if (m._icon) m._icon.style.transition = 'transform 0.15s ease'
        m.setLatLng(m._origLatLng)
        if (m._origIcon) m.setIcon(m._origIcon)
      })
    }
    map.on('zoomend', restoreAll)

    for (const marker of allMarkers) {
      marker.on('mouseover', () => {
        if (marker._isSpread) return

        // Detect overlap using original positions (stable across multiple spreads)
        const hPt = (map as any).latLngToContainerPoint(marker._origLatLng)
        const group: { marker: any; orig: any }[] = allMarkers
          .filter((m) => {
            const pt = (map as any).latLngToContainerPoint(m._origLatLng)
            return Math.sqrt((pt.x - hPt.x) ** 2 + (pt.y - hPt.y) ** 2) < PIXEL_THRESHOLD
          })
          .map((m) => ({ marker: m, orig: m._origLatLng }))

        if (group.length < 2) return

        group.forEach(({ marker: m }) => { m._isSpread = true })

        const n = group.length
        const cPt = group.reduce(
          (acc, { orig }) => {
            const pt = (map as any).latLngToContainerPoint(orig)
            return { x: acc.x + pt.x / n, y: acc.y + pt.y / n }
          },
          { x: 0, y: 0 }
        )
        const radius = SPREAD_PX * Math.ceil(n / 2)

        group.forEach(({ marker: m }, i) => {
          const angle = (2 * Math.PI * i / n) - Math.PI / 2
          if (m._icon) m._icon.style.transition = 'transform 0.2s ease'
          m.setLatLng((map as any).containerPointToLatLng([
            cPt.x + Math.cos(angle) * radius,
            cPt.y + Math.sin(angle) * radius * 0.65,
          ]))

          // Highlight waypoint (camera) markers when spread — no label, just glow
          if ((m as any)._spreadLabel !== undefined) {
            const L = (window as any)._L
            if (!L) return
            m.setIcon(L.divIcon({
              html: `<div style="width:32px;height:32px;background:#1e293b;border:2px solid #f97316;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 0 6px rgba(249,115,22,0.25);cursor:pointer">📷</div>`,
              className: '',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            }))
          }
        })

        // Restore when cursor leaves the spread circle
        if (mouseMoveCleanup) mouseMoveCleanup()
        const leaveRadius = radius + 44
        function onMouseMove(e: any) {
          const mPt = (map as any).latLngToContainerPoint(e.latlng)
          if (Math.sqrt((mPt.x - cPt.x) ** 2 + (mPt.y - cPt.y) ** 2) > leaveRadius) {
            restoreAll()
          }
        }
        map.on('mousemove', onMouseMove)
        mouseMoveCleanup = () => map.off('mousemove', onMouseMove)
      })
    }
  }

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
    // On mobile the bottom sheet covers 65vh — add bottom padding so the route
    // centres in the visible area above the sheet
    const mobile = window.innerWidth < 768
    const bottomPad = mobile ? Math.round(window.innerHeight * 0.5) : 60
    const rightPad = mobile ? 60 : 416 + 32
    mapRef.current.fitBounds(L.latLngBounds(latLngs), { paddingTopLeft: [60, 60], paddingBottomRight: [rightPad, bottomPad], maxZoom: 12 })

    // Remove previous break markers
    const Lmap = (window as any)._L
    breakMarkersRef.current.forEach(m => m.remove())
    breakMarkersRef.current = []

    const calloutMarkers = addTripMarkers(trips[index], Lmap, mapRef.current!) ?? []
    setupMarkerSpread([...waypointMarkersRef.current, ...calloutMarkers], mapRef.current!)

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
    breakMarkersRef.current.forEach(m => m.remove())
    breakMarkersRef.current = []
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

      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      mapRef.current = map

      const glowLines: Polyline[] = []

      trips.forEach((trip, index) => {
        if (trip.coordinates.length < 2) return
        const latLngs = trip.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])

        const glow = L.polyline(latLngs, { color: '#f97316', weight: 14, opacity: 0.15, smoothFactor: 0, interactive: false }).addTo(map)
        glowLines.push(glow)

        const line = L.polyline(latLngs, { color: '#f97316', weight: 4, opacity: 0.95, smoothFactor: 0, interactive: false }).addTo(map)
        polylinesRef.current.push(line)

        // Invisible wide hit zone — captures hover/click without affecting visual width
        const hitZone = L.polyline(latLngs, { color: '#f97316', weight: 20, opacity: 0, smoothFactor: 0 }).addTo(map)

        hitZone.on('click', () => selectTrip(index))

        hitZone.on('mouseover', () => {
          if (selectedTripIndexRef.current === null) line.setStyle({ weight: 6, opacity: 1 })
        })
        hitZone.on('mouseout', () => {
          if (selectedTripIndexRef.current === null) line.setStyle({ weight: 4, opacity: 0.95 })
          if (selectedTripIndexRef.current === index || externalHoverRef.current !== undefined) {
            setHoveredDistanceRef.current(null)
            externalHoverRef.current?.onDistance(null)
          }
        })

        // Map → Profile: track mouse position along polyline
        hitZone.on('mousemove', (e: any) => {
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

      // Planned routes — ridden segments orange solid, unridden dashed route color
      for (let routeIdx = 0; routeIdx < (plannedRoutes ?? []).length; routeIdx++) {
        const route = plannedRoutes[routeIdx]
        if (route.coordinates.length < 2) continue

        const mask = computeRiddenMask(route.coordinates, trips)
        const segments = splitRiddenSegments(route.coordinates, mask)
        const segLines: { line: any; ridden: boolean }[] = []

        for (const seg of segments) {
          const latLngs = seg.coords.map(([lng, lat]) => [lat, lng] as [number, number])
          const line = L.polyline(latLngs, seg.ridden
            ? { color: '#f97316', weight: 3, opacity: 0.9, interactive: false }
            : { color: route.color, weight: 2, opacity: 0.7, dashArray: '8, 10', interactive: false }
          ).addTo(map)
          segLines.push({ line, ridden: seg.ridden })
        }

        plannedLinesRef.current.push({ segLines, routeColor: route.color })

        // Invisible hit zone for click
        const hitLatLngs = route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
        const hitZone = L.polyline(hitLatLngs, { color: route.color, weight: 16, opacity: 0 }).addTo(map)
        hitZone.on('click', () => {
          setSelectedRouteIndex(routeIdx)
          selectedRouteIndexRef.current = routeIdx
          routeCumDistsRef.current = buildCumDists(route.coordinates)
          // Use DB-stored elevation if available
          if (route.elevation) {
            routeElevationCache.current[route.id] = route.elevation
            setRouteElevation(route.elevation)
            return
          }
          const cached = routeElevationCache.current[route.id]
          if (cached) {
            setRouteElevation(cached)
            return
          }
          setRouteElevation(null)
          setRouteElevationLoading(true)
          fetch('/api/elevation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: route.coordinates, routeId: route.id }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.elevation) {
                routeElevationCache.current[route.id] = data.elevation
                setRouteElevation(data.elevation)
              }
            })
            .catch(() => {})
            .finally(() => setRouteElevationLoading(false))
        })

        hitZone.on('mousemove', (e: any) => {
          if (selectedRouteIndexRef.current !== routeIdx) return
          const cd = routeCumDistsRef.current
          if (!cd) return
          const dist = closestDistOnPath(e.latlng.lat, e.latlng.lng, route.coordinates, cd)
          setHoveredRouteDistanceRef.current(dist)
        })
        hitZone.on('mouseout', () => {
          if (selectedRouteIndexRef.current !== routeIdx) return
          setHoveredRouteDistanceRef.current(null)
        })
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
      waypointMarkersRef.current = waypointMarkers

      for (const wp of waypoints) {
        const marker = L.marker([wp.lat, wp.lng], { icon: cameraIcon })
        ;(marker as any)._spreadLabel = wp.title ?? ''
        marker.on('click', () => setSelectedPhotoIndex(waypoints.indexOf(wp)))
        waypointMarkers.push(marker)
      }
      setupMarkerSpread(waypointMarkers, map)

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

      // 🥚 Easter egg: Teysachaux — only visible at zoom ≥ 14
      const EGG_ZOOM = 14
      const eggIcon = L.divIcon({
        html: `<div style="font-size:11px;opacity:0.35;cursor:pointer;user-select:none;line-height:1">🏔️</div>`,
        className: '',
        iconAnchor: [6, 11],
      })
      const eggMarker = L.marker([46.534056, 6.996306], { icon: eggIcon, zIndexOffset: -500, opacity: 0 })
      eggMarker.on('click', () => window.open('https://www.instagram.com/molechaux_sports_team/', '_blank', 'noopener'))
      eggMarker.bindTooltip(
        '🏔️ <b>Teysachaux</b><br>La plus belle montagne du monde 🥇<br><i>(juste avant Moléson 🤫)</i>',
        { direction: 'top', offset: [0, -14], className: 'egg-tooltip' }
      )
      function updateEggVisibility() {
        if (map.getZoom() >= EGG_ZOOM) {
          if (!map.hasLayer(eggMarker)) eggMarker.addTo(map)
        } else {
          if (map.hasLayer(eggMarker)) eggMarker.remove()
        }
      }
      map.on('zoomend', updateEggVisibility)
      updateEggVisibility()

      const allLatLngs = trips.flatMap((t) =>
        t.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      )
      if (allLatLngs.length > 0) {
        map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40] })
      }

      // On trip detail page, auto-show markers for the single trip
      if (externalHover !== undefined && trips.length === 1) {
        const calloutMarkers = addTripMarkers(trips[0], L, map) ?? []
        setupMarkerSpread([...waypointMarkers, ...calloutMarkers], map)
      }
    }

    initMap()
    return () => {
      cancelled = true
      weatherLayerRef.current?.remove()
      weatherLayerRef.current = null
      breakMarkersRef.current.forEach(m => m.remove())
      breakMarkersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
      polylinesRef.current = []
    }
  }, [])

  const prevIndex = selectedTripIndex !== null && selectedTripIndex > 0 ? selectedTripIndex - 1 : null
  const nextIndex = selectedTripIndex !== null && selectedTripIndex < trips.length - 1 ? selectedTripIndex + 1 : null

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Trip detail panel — hidden on trip detail page (externalHover mode) */}
      {externalHover === undefined && <div
        className={isMobile
          ? 'absolute left-0 right-0 bottom-0 z-[1000] flex flex-col rounded-t-2xl overflow-hidden transition-all duration-300'
          : 'absolute top-4 right-4 bottom-4 z-[1000] w-[416px] flex flex-col rounded-2xl overflow-hidden transition-all duration-300'
        }
        style={{
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(51,65,85,0.8)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          ...(isMobile
            ? {
                maxHeight: '65vh',
                transform: selectedTrip ? 'translateY(0)' : 'translateY(100%)',
              }
            : {
                transform: selectedTrip ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
              }
          ),
          pointerEvents: selectedTrip ? 'all' : 'none',
        }}
      >
        {selectedTrip && selectedTripIndex !== null && (
          <>
            {/* Mobile drag handle */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-600" />
              </div>
            )}

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
            <div className="grid grid-cols-3 gap-px bg-slate-700/30 border-b border-slate-700/50">
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">{(selectedTrip.distance_m / 1000).toFixed(1)}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t('km')}</div>
              </div>
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">
                  {selectedTrip.elevation ? `↑ ${computeElevationGain(selectedTrip.elevation).toLocaleString()}` : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t('mGain')}</div>
              </div>
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">{selectedTrip.country ?? '—'}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{t('country') || 'pays'}</div>
              </div>
            </div>

            {/* Stats row 2: max speed, max altitude, breaks */}
            <div className="grid grid-cols-3 gap-px bg-slate-700/30 border-b border-slate-700/50">
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">
                  {selectedTrip.max_speed_ms != null ? `${Math.round(selectedTrip.max_speed_ms * 3.6)}` : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">km/h max</div>
              </div>
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">
                  {selectedTrip.elev_high != null ? `${Math.round(selectedTrip.elev_high)}` : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">m alt. max</div>
              </div>
              <div className="px-3 py-3 bg-slate-900/50 min-w-0">
                <div className="text-base font-bold text-white truncate">
                  {selectedTrip.breaks != null ? selectedTrip.breaks.length : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">pauses</div>
              </div>
            </div>

            {/* Elevation profile — desktop only (too cramped in mobile bottom sheet) */}
            {!isMobile && selectedTrip.elevation && selectedTrip.elevation.length > 1 && (
              <div className="px-5 py-3 border-b border-slate-700/30">
                <ElevationProfile
                  points={selectedTrip.elevation}
                  hoveredDistance={hoveredDistance}
                  onHoverDistance={setHoveredDistance}
                  gainLabel={t('mGain')}
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

      {/* Top-left map controls */}
      {externalHover === undefined && !aboutOpen && (
        <div className="absolute top-4 left-4 z-[9999] flex items-center gap-2">
          <button
            onClick={() => setShowWeather((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: showWeather ? 'rgba(34,211,238,0.2)' : 'rgba(15,23,42,0.85)',
              border: showWeather ? '1px solid rgba(34,211,238,0.6)' : '1px solid rgba(51,65,85,0.8)',
              backdropFilter: 'blur(8px)',
              color: showWeather ? '#22d3ee' : '#94a3b8',
            }}
          >
            <span style={{ fontSize: 16 }}>⛅</span>
            <span className="hidden md:inline">Météo</span>
          </button>
          <button
            onClick={() => setBasemap((v) => v === 'dark' ? 'topo' : 'dark')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: basemap === 'topo' ? 'rgba(251,191,36,0.2)' : 'rgba(15,23,42,0.85)',
              border: basemap === 'topo' ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(51,65,85,0.8)',
              backdropFilter: 'blur(8px)',
              color: basemap === 'topo' ? '#fbbf24' : '#94a3b8',
            }}
          >
            <span style={{ fontSize: 16 }}>🗻</span>
            <span className="hidden md:inline">Topo</span>
          </button>
        </div>
      )}

      {selectedPhotoIndex !== null && (
        <PhotoModal
          photos={waypoints.map((wp) => ({ imageUrl: wp.url_large, title: wp.title ?? '' }))}
          initialIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}

      {/* Planned route panel */}
      {routePanelData && (
        <div
          className="absolute top-4 left-4 right-4 md:left-[222px] z-[1000] rounded-2xl overflow-hidden"
          style={{ background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(12px)', border: '1px solid rgba(51,65,85,0.8)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-700/50">
            <div>
              <div className="text-sm font-bold text-white">{routePanelData.route.name}</div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span style={{ display: 'inline-block', width: 10, height: 3, background: '#f97316', borderRadius: 1 }} />
                  {routePanelData.riddenKm.toLocaleString()} km parcourus
                </span>
                <span className="flex items-center gap-1">
                  <span style={{ display: 'inline-block', width: 10, height: 0, borderTop: '2px dashed #22d3ee' }} />
                  {routePanelData.remainKm.toLocaleString()} km restants
                </span>
                <span className="text-cyan-400 font-semibold">{routePanelData.pct}%</span>
              </div>
            </div>
            <button
              onClick={() => { setSelectedRouteIndex(null); setRouteElevation(null); setHoveredRouteDistance(null); selectedRouteIndexRef.current = null; routeCumDistsRef.current = null }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          {/* Elevation profile */}
          <div className="px-4 py-3">
            {routeElevationLoading ? (
              <div className="text-xs text-slate-500 text-center py-4">Chargement du profil d&apos;altitude…</div>
            ) : routeElevation ? (
              <ElevationProfile
                points={routeElevation}
                riddenUpToM={routePanelData.riddenUpToM}
                hoveredDistance={hoveredRouteDistance}
                onHoverDistance={setHoveredRouteDistance}
                gainLabel="m dénivelé+"
                showStats={false}
              />
            ) : (
              <div className="text-xs text-slate-500 text-center py-3">Profil d&apos;altitude non disponible</div>
            )}
          </div>
        </div>
      )}

      {/* Stats overlay — hidden on mobile when a trip panel is open */}
      {stats && !(isMobile && selectedTripIndex !== null) && (
        <div
          className="absolute bottom-8 left-2 right-2 md:left-4 md:right-auto z-[1000] rounded-xl px-4 md:px-5 py-3 flex items-center gap-4 md:gap-6 overflow-x-auto"
          style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(51,65,85,0.8)', scrollbarWidth: 'none' }}
        >
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{stats.labels.rides}</div>
            <div className="text-lg font-bold text-white">{stats.rides}</div>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{stats.labels.distance}</div>
            <div className="text-lg font-bold text-white">{stats.totalKm.toLocaleString()} {stats.labels.km}</div>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{stats.labels.elevation}</div>
            <div className="text-lg font-bold text-white">↑ {stats.totalElevationGain.toLocaleString()} {stats.labels.km === 'km' ? 'm' : 'm'}</div>
          </div>
          {stats.countries > 0 && (
            <>
              <div className="w-px h-8 bg-slate-700" />
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">{stats.labels.countries}</div>
                <div className="text-lg font-bold text-white">{stats.countries}</div>
              </div>
            </>
          )}
          {stats.progress && (
            <>
              <div className="w-px h-8 bg-slate-700" />
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{stats.labels.americasCrossing}</div>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${stats.progress.pct}%`, background: '#22d3ee' }} />
                  </div>
                  <div className="text-sm font-bold text-cyan-400">{stats.progress.pct}%</div>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">{stats.labels.left}</div>
                <div className="text-lg font-bold text-white">{stats.progress.kmLeft.toLocaleString()} {stats.labels.km}</div>
              </div>
            </>
          )}
        </div>
      )}

      <SponsorBanner
        panelOpen={!isMobile && (selectedTrip !== null || selectedRouteIndex !== null)}
        hidden={isMobile && selectedTrip !== null}
      />

    </div>
  )
}
