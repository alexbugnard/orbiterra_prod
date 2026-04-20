# Trip Details (Max Speed, Max Altitude, Breaks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show max speed, max altitude, and break points (pauses >10 min) in the trip detail panel when a ride is clicked on the map.

**Architecture:** Add three nullable columns to `trips` (`max_speed_ms`, `elev_high`, `breaks`). The Strava cron fetches `max_speed`/`elev_high` from the activity payload and detects breaks from the `time` stream. A backfill script updates existing trips. The trip panel UI renders the new stats and break markers on the map.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Leaflet.js, Strava API v3

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/008_trip_details.sql` | CREATE — adds 3 columns to `trips` |
| `lib/strava.ts` | MODIFY — add `max_speed`/`elev_high` to `StravaActivity`, add `fetchStravaStreams()`, add `detectBreaks()` |
| `app/api/cron/strava/route.ts` | MODIFY — use new fields during upsert |
| `scripts/backfill-trip-details.mjs` | CREATE — one-shot script to fill existing trips |
| `app/map/page.tsx` | MODIFY — add new fields to select + Trip type |
| `components/Map.tsx` | MODIFY — add fields to Trip interface, render stats + break markers |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/008_trip_details.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/008_trip_details.sql
alter table trips add column if not exists max_speed_ms float;
alter table trips add column if not exists elev_high float;
-- breaks: array of {lat, lng, duration_min, distance_m} objects
alter table trips add column if not exists breaks jsonb;
```

- [ ] **Step 2: Apply the migration via Supabase REST**

In the Supabase dashboard SQL editor (or via `psql`), run the migration SQL above.

Verify with:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'trips' and column_name in ('max_speed_ms','elev_high','breaks');
```
Expected: 3 rows returned.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_trip_details.sql
git commit -m "feat: add max_speed_ms, elev_high, breaks columns to trips"
```

---

## Task 2: Update Strava lib — new fields + stream fetch + break detection

**Files:**
- Modify: `lib/strava.ts`

- [ ] **Step 1: Add `max_speed` and `elev_high` to `StravaActivity` interface**

In `lib/strava.ts`, update the interface:

```typescript
export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  elapsed_time: number
  distance: number
  map: { summary_polyline: string }
  max_speed: number | null        // m/s
  elev_high: number | null        // metres
}
```

- [ ] **Step 2: Add `fetchStravaStreams()` function**

Add after `fetchStravaElevation`:

```typescript
export interface StravaStreams {
  time: number[]       // elapsed seconds at each GPS point
  latlng: [number, number][]  // [lat, lng] at each point
  distance: number[]   // metres from start at each point
}

export async function fetchStravaStreams(
  accessToken: string,
  activityId: number
): Promise<StravaStreams | null> {
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/activities/${activityId}/streams?keys=time,latlng,distance&key_by_type=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const time: number[] = data.time?.data ?? []
  const latlng: [number, number][] = data.latlng?.data ?? []
  const distance: number[] = data.distance?.data ?? []
  if (time.length === 0 || latlng.length === 0) return null
  return { time, latlng, distance }
}
```

- [ ] **Step 3: Add `detectBreaks()` function**

Add after `fetchStravaStreams`:

```typescript
export interface TripBreak {
  lat: number
  lng: number
  duration_min: number
  distance_m: number
}

export function detectBreaks(streams: StravaStreams, minGapSeconds = 600): TripBreak[] {
  const { time, latlng, distance } = streams
  const breaks: TripBreak[] = []
  for (let i = 1; i < time.length; i++) {
    const gap = time[i] - time[i - 1]
    if (gap >= minGapSeconds) {
      breaks.push({
        lat: latlng[i - 1][0],
        lng: latlng[i - 1][1],
        duration_min: Math.round(gap / 60),
        distance_m: Math.round(distance[i - 1] ?? 0),
      })
    }
  }
  return breaks
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/strava.ts
git commit -m "feat: add fetchStravaStreams and detectBreaks to strava lib"
```

---

## Task 3: Update Strava cron to store new fields

**Files:**
- Modify: `app/api/cron/strava/route.ts`

- [ ] **Step 1: Import new functions**

Update the import at the top:

```typescript
import { refreshStravaToken, fetchStravaActivitiesSince, fetchStravaElevation, fetchStravaStreams, detectBreaks, fetchStravaPhotos, reverseGeocodeCountry } from '@/lib/strava'
```

- [ ] **Step 2: Fetch streams and detect breaks per activity**

In the activity loop, after `fetchStravaElevation`, add:

```typescript
    const streams = await fetchStravaStreams(accessToken, activity.id)
    const breaks = streams ? detectBreaks(streams) : null
```

- [ ] **Step 3: Add new fields to the upsert**

In the `.upsert({...})` call, add:

```typescript
      max_speed_ms: activity.max_speed ?? null,
      elev_high: activity.elev_high ?? null,
      breaks: breaks && breaks.length > 0 ? breaks : null,
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/strava/route.ts
git commit -m "feat: sync max_speed, elev_high, breaks during strava cron"
```

---

## Task 4: Backfill script for existing trips

**Files:**
- Create: `scripts/backfill-trip-details.mjs`

- [ ] **Step 1: Write the backfill script**

```javascript
// scripts/backfill-trip-details.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
const STRAVA_BASE = 'https://www.strava.com'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function refreshToken() {
  const { data } = await supabase.from('tokens').select('*').eq('id', 1).single()
  if (!data) throw new Error('No tokens found')
  if (new Date(data.expires_at) > new Date()) return data.access_token
  const res = await fetch(`${STRAVA_BASE}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: data.refresh_token })
  })
  const refreshed = await res.json()
  await supabase.from('tokens').update({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: new Date(refreshed.expires_at * 1000).toISOString() }).eq('id', 1)
  return refreshed.access_token
}

function detectBreaks(streams, minGapSeconds = 600) {
  const { time, latlng, distance } = streams
  const breaks = []
  for (let i = 1; i < time.length; i++) {
    const gap = time[i] - time[i - 1]
    if (gap >= minGapSeconds) {
      breaks.push({ lat: latlng[i-1][0], lng: latlng[i-1][1], duration_min: Math.round(gap/60), distance_m: Math.round(distance[i-1] ?? 0) })
    }
  }
  return breaks
}

const accessToken = await refreshToken()

// Fetch all trips that have a strava_id and are missing the new fields
const { data: trips } = await supabase.from('trips').select('id, strava_id').not('strava_id', 'is', null)
console.log(`Backfilling ${trips.length} trips…`)

for (const trip of trips) {
  // Fetch detailed activity (has max_speed + elev_high)
  const actRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!actRes.ok) { console.log(`  [${trip.strava_id}] activity fetch failed: ${actRes.status}`); await sleep(1100); continue }
  const activity = await actRes.json()

  // Fetch streams for break detection
  await sleep(1100) // Strava rate limit
  const streamRes = await fetch(`${STRAVA_BASE}/api/v3/activities/${trip.strava_id}/streams?keys=time,latlng,distance&key_by_type=true`, { headers: { Authorization: `Bearer ${accessToken}` } })
  let breaks = null
  if (streamRes.ok) {
    const data = await streamRes.json()
    const streams = { time: data.time?.data ?? [], latlng: data.latlng?.data ?? [], distance: data.distance?.data ?? [] }
    if (streams.time.length > 0) {
      const detected = detectBreaks(streams)
      breaks = detected.length > 0 ? detected : null
    }
  }

  await supabase.from('trips').update({
    max_speed_ms: activity.max_speed ?? null,
    elev_high: activity.elev_high ?? null,
    breaks: breaks,
  }).eq('id', trip.id)

  console.log(`  [${trip.strava_id}] max_speed=${activity.max_speed?.toFixed(1)} elev_high=${activity.elev_high} breaks=${breaks?.length ?? 0}`)
  await sleep(1100)
}
console.log('Backfill complete.')
```

- [ ] **Step 2: Run it**

```bash
node scripts/backfill-trip-details.mjs
```

Expected output: one line per trip showing the fetched values. Skip test trips (strava_id 9999999999) — they'll show a 404 from Strava, which is handled gracefully.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-trip-details.mjs
git commit -m "chore: add backfill script for trip max_speed, elev_high, breaks"
```

---

## Task 5: Update map/page.tsx — query + Trip type

**Files:**
- Modify: `app/map/page.tsx`

- [ ] **Step 1: Add new fields to the Supabase select**

Find the trips select:
```typescript
.select('id, name, start_date, distance_m, coordinates, journal_fr, journal_en, start_lat, start_lng, elevation, country')
```

Replace with:
```typescript
.select('id, name, start_date, distance_m, coordinates, journal_fr, journal_en, start_lat, start_lng, elevation, country, max_speed_ms, elev_high, breaks')
```

- [ ] **Step 2: Add new fields to `formattedTrips`**

In the `.map()` call, add:
```typescript
    max_speed_ms: (t.max_speed_ms ?? null) as number | null,
    elev_high: (t.elev_high ?? null) as number | null,
    breaks: (t.breaks ?? null) as { lat: number; lng: number; duration_min: number; distance_m: number }[] | null,
```

- [ ] **Step 3: Commit**

```bash
git add app/map/page.tsx
git commit -m "feat: pass max_speed_ms, elev_high, breaks to map client"
```

---

## Task 6: Update Map.tsx — Trip interface + panel UI + break markers

**Files:**
- Modify: `components/Map.tsx`

- [ ] **Step 1: Update the Trip interface**

Find the `interface Trip` block and add:
```typescript
  max_speed_ms: number | null
  elev_high: number | null
  breaks: { lat: number; lng: number; duration_min: number; distance_m: number }[] | null
```

- [ ] **Step 2: Add a break markers ref**

After `const plannedLinesRef = useRef<any[]>([])`, add:
```typescript
  const breakMarkersRef = useRef<any[]>([])
```

- [ ] **Step 3: Add break markers to the map when a trip is selected**

Find the `function selectTrip(index: number)` block. After the polyline highlight code (after `mapRef.current.fitBounds(...)`), add:

```typescript
    // Remove previous break markers
    const Lmap = (window as any)._L
    breakMarkersRef.current.forEach(m => m.remove())
    breakMarkersRef.current = []

    // Add break markers for selected trip
    const trip = trips[index]
    if (Lmap && mapRef.current && trip.breaks) {
      trip.breaks.forEach((b) => {
        const icon = Lmap.divIcon({
          html: `<div style="background:rgba(15,23,42,0.9);border:2px solid #f59e0b;border-radius:6px;padding:2px 6px;font-size:11px;font-weight:600;color:#f59e0b;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${b.duration_min} min</div>`,
          className: '',
          iconAnchor: [20, 12],
        })
        const marker = Lmap.marker([b.lat, b.lng], { icon }).addTo(mapRef.current!)
        breakMarkersRef.current.push(marker)
      })
    }
```

Also clear break markers when deselecting a trip. Find the `closePanel` / deselect logic (where `selectedTripIndexRef.current = null`) and add:
```typescript
    breakMarkersRef.current.forEach(m => m.remove())
    breakMarkersRef.current = []
```

- [ ] **Step 4: Update the stats grid to show new fields**

Find the stats grid (currently 3 columns: km, elevation gain, country). Replace it with a 2-row layout:

```tsx
{/* Stats row 1 */}
<div className="grid grid-cols-3 gap-px bg-slate-700/30 border-b border-slate-700/50">
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">{(selectedTrip.distance_m / 1000).toFixed(1)}</div>
    <div className="text-xs text-slate-500 mt-0.5">{t('km')}</div>
  </div>
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">
      {selectedTrip.elevation ? `↑ ${computeElevationGain(selectedTrip.elevation).toLocaleString()}` : '—'}
    </div>
    <div className="text-xs text-slate-500 mt-0.5">m gain</div>
  </div>
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">{selectedTrip.country ?? '—'}</div>
    <div className="text-xs text-slate-500 mt-0.5 truncate">{t('country') || 'pays'}</div>
  </div>
</div>
{/* Stats row 2 */}
<div className="grid grid-cols-3 gap-px bg-slate-700/30 border-b border-slate-700/50">
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">
      {selectedTrip.max_speed_ms != null ? `${Math.round(selectedTrip.max_speed_ms * 3.6)}` : '—'}
    </div>
    <div className="text-xs text-slate-500 mt-0.5">km/h max</div>
  </div>
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">
      {selectedTrip.elev_high != null ? `${Math.round(selectedTrip.elev_high)}` : '—'}
    </div>
    <div className="text-xs text-slate-500 mt-0.5">m alt. max</div>
  </div>
  <div className="px-4 py-3 bg-slate-900/50">
    <div className="text-lg font-bold text-white">
      {selectedTrip.breaks != null ? selectedTrip.breaks.length : '—'}
    </div>
    <div className="text-xs text-slate-500 mt-0.5">pauses</div>
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add components/Map.tsx
git commit -m "feat: show max speed, max altitude, breaks in trip detail panel"
```

---

## Self-Review

- ✅ All 3 stats covered: max speed (from Strava `max_speed`), max altitude (`elev_high`), breaks (time stream gap detection)
- ✅ DB migration covers all 3 columns
- ✅ Backfill script handles existing trips
- ✅ New cron logic matches interface defined in lib/strava.ts
- ✅ Break markers cleaned up on panel close
- ✅ `max_speed_ms * 3.6` converts m/s → km/h correctly
- ✅ Null-safe everywhere (new trips may not have data yet)
- ✅ `detectBreaks` duplicated in backfill script (no shared module between .mjs and .ts) — acceptable for a one-shot script
