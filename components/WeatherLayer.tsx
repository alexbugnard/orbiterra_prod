'use client'

import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet'
import type { WeatherPointResponse } from '@/app/api/weather-points/route'

const ICON_EMOJI: Record<string, string> = {
  'sun': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'rain': '🌧️',
  'snow': '❄️',
  'storm': '⛈️',
}

const WEATHER_ZOOM_THRESHOLD = 7

function windColor(speed: number): string {
  if (speed < 15) return '#22d3ee'
  if (speed < 30) return '#84cc16'
  if (speed < 50) return '#f59e0b'
  if (speed < 70) return '#f97316'
  return '#ef4444'
}

function windAnimDuration(speed: number): number {
  if (speed < 15) return 2.5
  if (speed < 30) return 1.8
  if (speed < 50) return 1.2
  if (speed < 70) return 0.8
  return 0.5
}

function buildIconHtml(point: WeatherPointResponse, theme: 'dark' | 'topo' = 'dark'): string {
  const emoji = point.icon ? (ICON_EMOJI[point.icon] ?? '☁️') : '☁️'
  const bg = theme === 'topo' ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.88)'
  const border = theme === 'topo' ? '1px solid rgba(30,41,59,0.35)' : '1px solid rgba(34,211,238,0.4)'
  const shadow = theme === 'topo' ? '0 2px 6px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.5)'
  const circle = `<div style="font-size:18px;line-height:1;background:${bg};border:${border};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:${shadow};cursor:default;">${emoji}</div>`

  if (point.wind_direction === null || point.wind_speed === null) return circle

  const color = windColor(point.wind_speed)
  const dur = windAnimDuration(point.wind_speed)
  const anim = `wba${point.seq}`

  return `
    <style>
      @keyframes ${anim} {
        0%,100%{transform:rotate(${point.wind_direction}deg) translateY(0);opacity:.65;}
        50%{transform:rotate(${point.wind_direction}deg) translateY(-5px);opacity:1;}
      }
    </style>
    <div style="display:flex;flex-direction:column;align-items:center;cursor:default;gap:3px;">
      ${circle}
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
        <svg width="14" height="18" viewBox="0 0 14 18"
          style="animation:${anim} ${dur}s ease-in-out infinite;filter:drop-shadow(0 0 5px ${color});">
          <polygon points="7,0 12,14 7,11 2,14" fill="${color}"/>
        </svg>
        <span style="font-size:9px;font-weight:700;color:${color};font-family:system-ui,sans-serif;line-height:1;">${Math.round(point.wind_speed)} km/h</span>
      </div>
    </div>`
}

function buildTooltipHtml(point: WeatherPointResponse): string {
  const emoji = point.icon ? (ICON_EMOJI[point.icon] ?? '☁️') : '☁️'

  const tempHtml = point.temp_min !== null && point.temp_max !== null
    ? `<div style="display:flex;align-items:baseline;gap:4px;margin-top:3px">
        <span style="font-size:13px;font-weight:600;color:#f1f5f9">${Math.round(point.temp_min)}°</span>
        <span style="font-size:11px;color:#475569">/</span>
        <span style="font-size:13px;font-weight:600;color:#f1f5f9">${Math.round(point.temp_max)}°</span>
       </div>`
    : ''

  const labelHtml = point.label
    ? `<div style="font-size:10px;color:#64748b;margin-top:4px;border-top:1px solid rgba(51,65,85,0.6);padding-top:4px">${point.label}</div>`
    : ''

  return `<div style="
    display:flex;flex-direction:column;align-items:center;
    background:rgba(15,23,42,0.96);
    border:1px solid rgba(34,211,238,0.35);
    border-radius:8px;
    padding:6px 10px;
    box-shadow:0 4px 12px rgba(0,0,0,0.6);
    min-width:60px;
    font-family:system-ui,sans-serif;
  ">
    <div style="font-size:22px;line-height:1">${emoji}</div>
    ${tempHtml}
    ${labelHtml}
  </div>`
}

export class WeatherLayer {
  private layerGroup: LayerGroup | null = null
  private markers: Marker[] = []
  private points: WeatherPointResponse[] = []
  private loaded = false
  private theme: 'dark' | 'topo' = 'dark'

  async addTo(map: LeafletMap): Promise<void> {
    const L = (await import('leaflet')).default
    this.layerGroup = L.layerGroup()
  }

  async load(map: LeafletMap): Promise<void> {
    if (this.loaded) return
    this.loaded = true

    const res = await fetch('/api/weather-points')
    if (!res.ok) return

    const points: WeatherPointResponse[] = await res.json()
    const L = (await import('leaflet')).default

    this.points = points

    for (const point of points) {
      if (point.icon === null) continue

      const icon = L.divIcon({
        html: buildIconHtml(point, this.theme),
        className: '',
        iconSize: [48, 70],
        iconAnchor: [24, 16],
      })

      const marker = L.marker([point.lat, point.lng], { icon })

      marker.bindTooltip(buildTooltipHtml(point), {
        permanent: false,
        direction: 'top',
        offset: [0, -18],
        opacity: 1,
        className: 'weather-tooltip',
      })

      this.markers.push(marker)
    }

    this._updateVisibility(map)

    map.on('zoomend', () => this._updateVisibility(map))
  }

  private _updateVisibility(map: LeafletMap): void {
    if (!this.layerGroup) return
    const zoom = map.getZoom()
    if (zoom >= WEATHER_ZOOM_THRESHOLD) {
      if (!map.hasLayer(this.layerGroup)) this.layerGroup.addTo(map)
    } else {
      if (map.hasLayer(this.layerGroup)) map.removeLayer(this.layerGroup)
    }
  }

  show(map: LeafletMap): void {
    if (!this.layerGroup) return
    this.markers.forEach((m) => this.layerGroup!.addLayer(m))
    this._updateVisibility(map)
    map.on('zoomend', () => this._updateVisibility(map))
  }

  hide(map: LeafletMap): void {
    if (this.layerGroup && map.hasLayer(this.layerGroup)) {
      map.removeLayer(this.layerGroup)
    }
    map.off('zoomend')
  }

  async restyle(theme: 'dark' | 'topo'): Promise<void> {
    this.theme = theme
    if (!this.loaded) return
    const L = (await import('leaflet')).default
    this.markers.forEach((marker, i) => {
      const point = this.points.filter(p => p.icon !== null)[i]
      if (!point) return
      marker.setIcon(L.divIcon({
        html: buildIconHtml(point, theme),
        className: '',
        iconSize: [48, 70],
        iconAnchor: [24, 16],
      }))
    })
  }

  remove(): void {
    this.markers = []
    this.layerGroup?.clearLayers()
    this.layerGroup = null
    this.loaded = false
  }
}
