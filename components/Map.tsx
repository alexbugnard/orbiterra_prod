'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { PhotoModal } from './PhotoModal'
import { WeatherLayer } from './WeatherLayer'

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  journal_fr: string | null
  journal_en: string | null
  coordinates: [number, number][] // [lng, lat] pairs
}

interface Waypoint {
  id: string
  lat: number
  lng: number
  url_large: string
  title: string | null
}

interface MapProps {
  trips: Trip[]
  waypoints: Waypoint[]
  locale: string
}

export function Map({ trips, waypoints, locale }: MapProps) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const weatherLayerRef = useRef<WeatherLayer | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Waypoint | null>(null)
  const [meteoActive, setMeteoActive] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(containerRef.current!).setView([46.2276, 2.2137], 6)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      mapRef.current = map

      const weatherLayer = new WeatherLayer()
      await weatherLayer.addTo(map)
      weatherLayerRef.current = weatherLayer

      // Draw trip polylines
      for (const trip of trips) {
        if (trip.coordinates.length < 2) continue

        // Leaflet expects [lat, lng]
        const latLngs = trip.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])

        const polyline = L.polyline(latLngs, {
          color: '#e63946',
          weight: 3,
          opacity: 0.8,
        }).addTo(map)

        const journal = locale === 'fr' ? trip.journal_fr : trip.journal_en
        const distanceKm = (trip.distance_m / 1000).toFixed(1)
        const popupContent = `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-bold mb-1">${trip.name}</h3>
            <p class="text-sm text-gray-500 mb-2">${new Date(trip.start_date).toLocaleDateString(locale)} · ${distanceKm} km</p>
            ${journal ? `<p class="text-sm mb-2">${journal}</p>` : ''}
            <a href="/trips/${trip.id}" class="text-blue-600 text-sm underline">View leg →</a>
          </div>
        `
        polyline.bindPopup(popupContent)
      }

      // Draw waypoint markers
      const cameraIcon = L.divIcon({
        html: '📷',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      for (const waypoint of waypoints) {
        const marker = L.marker([waypoint.lat, waypoint.lng], { icon: cameraIcon }).addTo(map)
        marker.on('click', () => setSelectedPhoto(waypoint))
      }

      // Fit to trip bounds if there are trips
      const allLatLngs = trips.flatMap((t) =>
        t.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      )
      if (allLatLngs.length > 0) {
        map.fitBounds(L.latLngBounds(allLatLngs))
      }
    }

    initMap()

    return () => {
      weatherLayerRef.current?.remove()
      weatherLayerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  async function toggleMeteo() {
    const map = mapRef.current
    const layer = weatherLayerRef.current
    if (!map || !layer) return

    if (!meteoActive) {
      await layer.load(map)
      layer.show(map)
    } else {
      layer.hide(map)
    }
    setMeteoActive((prev) => !prev)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {selectedPhoto && (
        <PhotoModal
          imageUrl={selectedPhoto.url_large}
          title={selectedPhoto.title ?? ''}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
      <button
        onClick={toggleMeteo}
        style={{
          position: 'absolute',
          top: '80px',
          right: '10px',
          zIndex: 1000,
          background: meteoActive ? '#1d4ed8' : 'white',
          color: meteoActive ? 'white' : '#374151',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '4px',
          padding: '6px 10px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 5px rgba(0,0,0,0.15)',
        }}
      >
        Météo
      </button>
    </div>
  )
}
