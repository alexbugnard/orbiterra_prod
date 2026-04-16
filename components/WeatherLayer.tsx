'use client'

import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import type { WeatherPointResponse } from '@/app/api/weather-points/route'

const ICON_EMOJI: Record<string, string> = {
  'sun': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'rain': '🌧️',
  'snow': '❄️',
  'storm': '⛈️',
}

/**
 * Build the HTML string for a weather marker.
 * Wind arrow rotates via inline style; ▲ points up (north = 0°, clockwise).
 */
function buildMarkerHtml(point: WeatherPointResponse): string {
  const icon = point.icon ? (ICON_EMOJI[point.icon] ?? '☁️') : '—'
  const tempLine =
    point.temp_min !== null && point.temp_max !== null
      ? `<div style="font-size:10px;line-height:1.2;text-align:center;white-space:nowrap">${Math.round(point.temp_min)}°&thinsp;/&thinsp;${Math.round(point.temp_max)}°</div>`
      : ''
  const windLine =
    point.wind_direction !== null
      ? `<div style="font-size:14px;transform:rotate(${point.wind_direction}deg);line-height:1">▲</div>`
      : ''

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1px;background:rgba(255,255,255,0.9);border-radius:6px;padding:4px 6px;box-shadow:0 1px 4px rgba(0,0,0,0.25);cursor:default">
      <div style="font-size:20px;line-height:1">${icon}</div>
      ${tempLine}
      ${windLine}
    </div>
  `
}

export class WeatherLayer {
  private layerGroup: LayerGroup | null = null
  private loaded = false

  async addTo(map: LeafletMap): Promise<void> {
    const L = (await import('leaflet')).default
    this.layerGroup = L.layerGroup().addTo(map)
  }

  async load(map: LeafletMap): Promise<void> {
    if (this.loaded) return
    this.loaded = true

    const res = await fetch('/api/weather-points')
    if (!res.ok) return

    const points: WeatherPointResponse[] = await res.json()
    const L = (await import('leaflet')).default

    for (const point of points) {
      if (point.icon === null) continue

      const icon = L.divIcon({
        html: buildMarkerHtml(point),
        className: '',
        iconAnchor: [0, 0],
      })

      const marker = L.marker([point.lat, point.lng], { icon })

      if (point.label) {
        marker.bindTooltip(point.label, { permanent: false, direction: 'top' })
      }

      this.layerGroup?.addLayer(marker)
    }
  }

  show(map: LeafletMap): void {
    if (this.layerGroup && !map.hasLayer(this.layerGroup)) {
      this.layerGroup.addTo(map)
    }
  }

  hide(map: LeafletMap): void {
    if (this.layerGroup && map.hasLayer(this.layerGroup)) {
      map.removeLayer(this.layerGroup)
    }
  }

  remove(): void {
    this.layerGroup?.clearLayers()
    this.layerGroup = null
    this.loaded = false
  }
}
