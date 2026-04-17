# Météo Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable daily weather forecast layer to the BikeTrip Tracker map, showing WMO weather icons, min/max temperatures, and a dominant wind arrow every ~50 km along the planned route.

**Architecture:** New `weather_points` table in Supabase holds pre-seeded geographic points along the route. A new Vercel Cron job hits Open-Meteo once per day at midnight and updates weather columns for each point. A new public API route exposes the data. A Leaflet LayerGroup toggled by a "Météo" button renders custom markers on the map.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (PostGIS), Open-Meteo API (no key needed), Leaflet.js, existing `lib/supabase.ts` and `verifyCronSecret` from `app/api/cron/strava/route.ts`

---

## Task 1: Database migration — `weather_points` table

**Files:**
- Create: `supabase/migrations/002_weather_points.sql`

- [ ] **Step 1: Create `supabase/migrations/002_weather_points.sql`**

```sql
create table if not exists weather_points (
  id uuid primary key default gen_random_uuid(),
  seq integer not null,
  lat float not null,
  lng float not null,
  label text,
  fetched_at timestamptz,
  weather_code integer,
  temp_min float,
  temp_max float,
  wind_direction integer,
  wind_speed float
);

create unique index if not exists weather_points_seq_idx on weather_points(seq);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the file contents into the Supabase dashboard → SQL Editor and execute. Verify the `weather_points` table appears in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_weather_points.sql
git commit -m "feat: add weather_points table migration"
```

---

## Task 2: Seed script — sample route points every ~50 km

**Files:**
- Create: `scripts/seed-weather-points.ts`

This script reads the planned route from the `trips` table, samples a point every ~50 km using PostGIS, and inserts rows into `weather_points`. Run it once manually after the planned route is synced from Strava.

- [ ] **Step 1: Write the failing test**

Create `__tests__/scripts/seed-weather-points.test.ts`:

```typescript
import { interpolatePoints } from '@/scripts/seed-weather-points'

describe('interpolatePoints', () => {
  it('returns one point for a short segment below threshold', () => {
    // Two points ~10 km apart — below 50 km threshold → only the midpoint
    const coords: [number, number][] = [
      [6.1432, 46.2044], // Geneva [lng, lat]
      [6.2000, 46.2500],
    ]
    const points = interpolatePoints(coords, 50_000)
    expect(points.length).toBeGreaterThanOrEqual(1)
  })

  it('returns multiple points for a long segment', () => {
    // Roughly 200 km route → expect ~4 points
    const coords: [number, number][] = [
      [2.3522, 48.8566],  // Paris
      [4.8357, 45.7640],  // Lyon
    ]
    const points = interpolatePoints(coords, 50_000)
    expect(points.length).toBeGreaterThanOrEqual(2)
    // Each point has lat and lng
    for (const p of points) {
      expect(typeof p.lat).toBe('number')
      expect(typeof p.lng).toBe('number')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/scripts/seed-weather-points.test.ts
```

Expected: FAIL — `Cannot find module '@/scripts/seed-weather-points'`

- [ ] **Step 3: Create `scripts/seed-weather-points.ts`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'

/**
 * Haversine distance in metres between two [lng, lat] points.
 */
function haversineMetres(a: [number, number], b: [number, number]): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const a2 =
    sinDLat * sinDLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2))
}

/**
 * Walk the LineString coordinates and emit one point every `intervalMetres`.
 * Coordinates are GeoJSON [lng, lat] pairs.
 */
export function interpolatePoints(
  coords: [number, number][],
  intervalMetres: number
): { lat: number; lng: number }[] {
  const results: { lat: number; lng: number }[] = []
  let accumulated = 0

  if (coords.length === 0) return results

  // Always include a point near the start
  results.push({ lat: coords[0][1], lng: coords[0][0] })

  for (let i = 1; i < coords.length; i++) {
    const segDist = haversineMetres(coords[i - 1], coords[i])
    accumulated += segDist

    if (accumulated >= intervalMetres) {
      const ratio = (accumulated - intervalMetres) / segDist
      const lng = coords[i][0] - ratio * (coords[i][0] - coords[i - 1][0])
      const lat = coords[i][1] - ratio * (coords[i][1] - coords[i - 1][1])
      results.push({ lat, lng })
      accumulated = 0
    }
  }

  return results
}

async function main() {
  const supabase = createSupabaseClient()

  // Fetch all visible trips ordered by start_date — treat path as the planned route
  const { data: trips, error } = await supabase
    .from('trips')
    .select('path')
    .eq('visible', true)
    .order('start_date', { ascending: true })

  if (error) throw error
  if (!trips || trips.length === 0) {
    console.error('No visible trips found. Sync Strava first.')
    process.exit(1)
  }

  // Concatenate all trip coordinates into one route
  const allCoords: [number, number][] = []
  for (const trip of trips) {
    const coords: [number, number][] = trip.path?.coordinates ?? []
    allCoords.push(...coords)
  }

  const points = interpolatePoints(allCoords, 50_000) // 50 km

  // Delete existing rows and re-insert
  await supabase.from('weather_points').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const rows = points.map((p, seq) => ({ seq, lat: p.lat, lng: p.lng }))
  const { error: insertError } = await supabase.from('weather_points').insert(rows)

  if (insertError) throw insertError

  console.log(`Seeded ${rows.length} weather points.`)
}

// Only run main() when executed directly, not when imported by tests
if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/scripts/seed-weather-points.test.ts
```

Expected: PASS

- [ ] **Step 5: Add `ts-node` for running the script**

```bash
npm install -D ts-node
```

Add to `package.json` scripts:
```json
"seed:weather": "ts-node --project tsconfig.json -e \"require('./scripts/seed-weather-points')\" "
```

Actually use this cleaner form — add to `package.json` scripts:
```json
"seed:weather": "ts-node scripts/seed-weather-points.ts"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-weather-points.ts __tests__/scripts/seed-weather-points.test.ts package.json
git commit -m "feat: add weather point seed script"
```

---

## Task 3: WMO weather code → icon name mapper

**Files:**
- Create: `lib/wmo-codes.ts`
- Create: `__tests__/lib/wmo-codes.test.ts`

Open-Meteo returns [WMO weather interpretation codes](https://open-meteo.com/en/docs). We map them to one of six icon names: `sun`, `partly-cloudy`, `cloudy`, `rain`, `snow`, `storm`.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/wmo-codes.test.ts
import { wmoToIcon } from '@/lib/wmo-codes'

describe('wmoToIcon', () => {
  it('maps clear sky (0) to sun', () => {
    expect(wmoToIcon(0)).toBe('sun')
  })

  it('maps mainly clear (1) to sun', () => {
    expect(wmoToIcon(1)).toBe('sun')
  })

  it('maps partly cloudy (2) to partly-cloudy', () => {
    expect(wmoToIcon(2)).toBe('partly-cloudy')
  })

  it('maps overcast (3) to cloudy', () => {
    expect(wmoToIcon(3)).toBe('cloudy')
  })

  it('maps rain showers (80) to rain', () => {
    expect(wmoToIcon(80)).toBe('rain')
  })

  it('maps moderate rain (63) to rain', () => {
    expect(wmoToIcon(63)).toBe('rain')
  })

  it('maps snow fall (71) to snow', () => {
    expect(wmoToIcon(71)).toBe('snow')
  })

  it('maps thunderstorm (95) to storm', () => {
    expect(wmoToIcon(95)).toBe('storm')
  })

  it('returns cloudy for unknown codes', () => {
    expect(wmoToIcon(999)).toBe('cloudy')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/wmo-codes.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/wmo-codes'`

- [ ] **Step 3: Create `lib/wmo-codes.ts`**

```typescript
export type WeatherIcon = 'sun' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'storm'

export function wmoToIcon(code: number): WeatherIcon {
  if (code === 0 || code === 1) return 'sun'
  if (code === 2) return 'partly-cloudy'
  if (code === 3 || (code >= 45 && code <= 48)) return 'cloudy'
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95 && code <= 99) return 'storm'
  return 'cloudy'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/lib/wmo-codes.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/wmo-codes.ts __tests__/lib/wmo-codes.test.ts
git commit -m "feat: add WMO weather code to icon mapper"
```

---

## Task 4: Open-Meteo fetch helper

**Files:**
- Create: `lib/open-meteo.ts`
- Create: `__tests__/lib/open-meteo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/open-meteo.test.ts
import { parseOpenMeteoResponse } from '@/lib/open-meteo'

describe('parseOpenMeteoResponse', () => {
  it('extracts day-1 forecast for a single location', () => {
    const raw = {
      daily: {
        weathercode: [0, 3],
        temperature_2m_min: [10, 12],
        temperature_2m_max: [18, 20],
        winddirection_10m_dominant: [270, 180],
        windspeed_10m_max: [15, 20],
      },
    }
    const result = parseOpenMeteoResponse(raw)
    expect(result.weather_code).toBe(3)
    expect(result.temp_min).toBe(12)
    expect(result.temp_max).toBe(20)
    expect(result.wind_direction).toBe(180)
    expect(result.wind_speed).toBe(20)
  })

  it('falls back to day 0 if day 1 is missing', () => {
    const raw = {
      daily: {
        weathercode: [2],
        temperature_2m_min: [8],
        temperature_2m_max: [15],
        winddirection_10m_dominant: [90],
        windspeed_10m_max: [10],
      },
    }
    const result = parseOpenMeteoResponse(raw)
    expect(result.weather_code).toBe(2)
    expect(result.temp_min).toBe(8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/open-meteo.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/open-meteo'`

- [ ] **Step 3: Create `lib/open-meteo.ts`**

```typescript
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

export interface WeatherForecast {
  weather_code: number
  temp_min: number
  temp_max: number
  wind_direction: number
  wind_speed: number
}

export interface OpenMeteoDaily {
  weathercode: number[]
  temperature_2m_min: number[]
  temperature_2m_max: number[]
  winddirection_10m_dominant: number[]
  windspeed_10m_max: number[]
}

/**
 * Parse a single-location Open-Meteo response.
 * Uses day index 1 (tomorrow) if available, otherwise day 0 (today).
 */
export function parseOpenMeteoResponse(raw: { daily: OpenMeteoDaily }): WeatherForecast {
  const d = raw.daily
  const idx = d.weathercode.length > 1 ? 1 : 0
  return {
    weather_code: d.weathercode[idx],
    temp_min: d.temperature_2m_min[idx],
    temp_max: d.temperature_2m_max[idx],
    wind_direction: d.winddirection_10m_dominant[idx],
    wind_speed: d.windspeed_10m_max[idx],
  }
}

/**
 * Fetch forecasts for multiple points in a single Open-Meteo request.
 * Open-Meteo supports comma-separated lat/lng lists.
 */
export async function fetchWeatherForPoints(
  points: { lat: number; lng: number }[]
): Promise<WeatherForecast[]> {
  if (points.length === 0) return []

  const lats = points.map((p) => p.lat.toFixed(4)).join(',')
  const lngs = points.map((p) => p.lng.toFixed(4)).join(',')

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    daily: [
      'weathercode',
      'temperature_2m_min',
      'temperature_2m_max',
      'winddirection_10m_dominant',
      'windspeed_10m_max',
    ].join(','),
    timezone: 'UTC',
    forecast_days: '2',
  })

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`)

  const data = await res.json()

  // Single point: Open-Meteo returns a plain object with `daily`
  // Multiple points: returns an array
  const items: { daily: OpenMeteoDaily }[] = Array.isArray(data) ? data : [data]

  return items.map(parseOpenMeteoResponse)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/lib/open-meteo.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/open-meteo.ts __tests__/lib/open-meteo.test.ts
git commit -m "feat: add Open-Meteo fetch and parse helpers"
```

---

## Task 5: Weather cron route

**Files:**
- Create: `app/api/cron/weather/route.ts`
- Create: `__tests__/api/cron/weather.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/cron/weather.test.ts
import { verifyCronSecret } from '@/app/api/cron/strava/route'

describe('verifyCronSecret (reused in weather cron)', () => {
  it('returns true for a matching Bearer token', () => {
    process.env.CRON_SECRET = 'test-secret'
    const headers = new Headers({ Authorization: 'Bearer test-secret' })
    expect(verifyCronSecret(headers)).toBe(true)
  })

  it('returns false for a mismatched token', () => {
    process.env.CRON_SECRET = 'test-secret'
    const headers = new Headers({ Authorization: 'Bearer wrong' })
    expect(verifyCronSecret(headers)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it passes (it reuses the already-implemented helper)**

```bash
npm test -- __tests__/api/cron/weather.test.ts
```

Expected: PASS (the helper already exists)

- [ ] **Step 3: Create `app/api/cron/weather/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchWeatherForPoints } from '@/lib/open-meteo'
import { verifyCronSecret } from '@/app/api/cron/strava/route'

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  const { data: points, error } = await supabase
    .from('weather_points')
    .select('id, lat, lng')
    .order('seq', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!points || points.length === 0) {
    return NextResponse.json({ message: 'No weather points seeded yet.' })
  }

  const forecasts = await fetchWeatherForPoints(points)

  const now = new Date().toISOString()

  for (let i = 0; i < points.length; i++) {
    const forecast = forecasts[i]
    if (!forecast) continue

    await supabase.from('weather_points').update({
      weather_code: forecast.weather_code,
      temp_min: forecast.temp_min,
      temp_max: forecast.temp_max,
      wind_direction: forecast.wind_direction,
      wind_speed: forecast.wind_speed,
      fetched_at: now,
    }).eq('id', points[i].id)
  }

  return NextResponse.json({ updated: points.length })
}
```

- [ ] **Step 4: Add weather cron to `vercel.json`**

Open `vercel.json` and add the weather cron to the existing `crons` array:

```json
{
  "crons": [
    {
      "path": "/api/cron/strava",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/flickr",
      "schedule": "30 */4 * * *"
    },
    {
      "path": "/api/cron/weather",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/weather/ __tests__/api/cron/weather.test.ts vercel.json
git commit -m "feat: add weather cron route and daily schedule"
```

---

## Task 6: Public weather-points API route

**Files:**
- Create: `app/api/weather-points/route.ts`
- Create: `__tests__/api/weather-points.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/weather-points.test.ts
// Unit test the data shape — integration tested manually
import { formatWeatherPoint } from '@/app/api/weather-points/route'

describe('formatWeatherPoint', () => {
  it('formats a DB row into the API response shape', () => {
    const row = {
      id: 'abc',
      seq: 0,
      lat: 46.2,
      lng: 6.1,
      label: 'Geneva',
      weather_code: 2,
      temp_min: 10,
      temp_max: 22,
      wind_direction: 270,
      wind_speed: 15,
    }
    const result = formatWeatherPoint(row)
    expect(result.id).toBe('abc')
    expect(result.lat).toBe(46.2)
    expect(result.icon).toBe('partly-cloudy')
    expect(result.wind_direction).toBe(270)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/api/weather-points.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/weather-points/route'`

- [ ] **Step 3: Create `app/api/weather-points/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { wmoToIcon, WeatherIcon } from '@/lib/wmo-codes'

interface WeatherPointRow {
  id: string
  seq: number
  lat: number
  lng: number
  label: string | null
  weather_code: number | null
  temp_min: number | null
  temp_max: number | null
  wind_direction: number | null
  wind_speed: number | null
}

export interface WeatherPointResponse {
  id: string
  seq: number
  lat: number
  lng: number
  label: string | null
  icon: WeatherIcon | null
  temp_min: number | null
  temp_max: number | null
  wind_direction: number | null
  wind_speed: number | null
}

export function formatWeatherPoint(row: WeatherPointRow): WeatherPointResponse {
  return {
    id: row.id,
    seq: row.seq,
    lat: row.lat,
    lng: row.lng,
    label: row.label,
    icon: row.weather_code !== null ? wmoToIcon(row.weather_code) : null,
    temp_min: row.temp_min,
    temp_max: row.temp_max,
    wind_direction: row.wind_direction,
    wind_speed: row.wind_speed,
  }
}

export async function GET() {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase
    .from('weather_points')
    .select('id, seq, lat, lng, label, weather_code, temp_min, temp_max, wind_direction, wind_speed')
    .order('seq', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(formatWeatherPoint))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/api/weather-points.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/weather-points/ __tests__/api/weather-points.test.ts
git commit -m "feat: add public weather-points API route"
```

---

## Task 7: WeatherLayer Leaflet component

**Files:**
- Create: `components/WeatherLayer.tsx`

This component is a React hook/class that manages a Leaflet `LayerGroup` for weather markers. It is controlled by the parent `Map` component.

- [ ] **Step 1: Create `components/WeatherLayer.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/WeatherLayer.tsx
git commit -m "feat: add WeatherLayer Leaflet class"
```

---

## Task 8: Wire WeatherLayer into the Map component

**Files:**
- Modify: `components/Map.tsx`

Add a "Météo" toggle button and integrate `WeatherLayer` into the existing `Map` component.

- [ ] **Step 1: Open `components/Map.tsx`**

Read the file to understand the current structure before editing.

- [ ] **Step 2: Add `WeatherLayer` import and state**

At the top of the file, add the import after the existing imports:

```typescript
import { WeatherLayer } from './WeatherLayer'
```

Inside the `Map` function, add a ref for the weather layer and a state for the toggle, after the existing `mapRef` and `selectedPhoto` declarations:

```typescript
const weatherLayerRef = useRef<WeatherLayer | null>(null)
const [meteoActive, setMeteoActive] = useState(false)
```

- [ ] **Step 3: Initialize WeatherLayer inside `initMap`**

Inside the `initMap` async function in the `useEffect`, after `mapRef.current = map`, add:

```typescript
const weatherLayer = new WeatherLayer()
await weatherLayer.addTo(map)
weatherLayerRef.current = weatherLayer
```

- [ ] **Step 4: Add toggle handler**

Inside the `Map` function body, after the `useEffect`, add:

```typescript
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
```

- [ ] **Step 5: Add the toggle button to the JSX**

In the `return` statement, after the `<div ref={containerRef} .../>` line and before the `{selectedPhoto && ...}` block, add:

```typescript
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
```

- [ ] **Step 6: Update the `return` wrapper div to use `position: relative`**

The outer `<>` fragment needs a wrapper with `position: relative` for the button to position correctly against the map. Change the return from:

```typescript
return (
  <>
    <div ref={containerRef} className="w-full h-full" />
    ...
  </>
)
```

to:

```typescript
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
```

- [ ] **Step 7: Clean up WeatherLayer on map destroy**

In the `useEffect` cleanup return function, after `mapRef.current?.remove()`, add:

```typescript
weatherLayerRef.current?.remove()
weatherLayerRef.current = null
```

- [ ] **Step 8: Verify locally**

```bash
npm run dev
```

Open `http://localhost:3000/map`. Click the "Météo" button — it should turn blue. If weather points are seeded and the cron has run, markers appear. If the table is empty, nothing breaks — the layer loads 0 markers silently.

- [ ] **Step 9: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: wire WeatherLayer toggle into Map component"
```

---

## Task 9: Run all tests and deploy

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All existing tests PASS. No regressions.

- [ ] **Step 2: Seed weather points (after Strava sync)**

After at least one visible trip is synced from Strava, run:

```bash
npx ts-node scripts/seed-weather-points.ts
```

Expected output: `Seeded N weather points.`

- [ ] **Step 3: Trigger the weather cron manually to verify**

```bash
curl -X POST https://your-domain.vercel.app/api/cron/weather \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response: `{"updated": N}`

- [ ] **Step 4: Push and deploy**

```bash
git push
```

Vercel will auto-deploy. Verify the "Météo" button appears on the live map and toggles correctly.

---

## Running tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Just meteo-related tests
npm test -- --testPathPattern="wmo-codes|open-meteo|weather-points|seed-weather"
```
