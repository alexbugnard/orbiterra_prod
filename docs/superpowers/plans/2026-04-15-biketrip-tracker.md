# BikeTrip Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (FR/EN) public website that auto-syncs a cyclist's Strava rides and geotagged Flickr photos onto an interactive Leaflet map, with a password-protected admin panel for content management.

**Architecture:** Single Next.js app on Vercel. Two Vercel Cron jobs (every 4h) hit internal API routes that refresh OAuth tokens, fetch new data from Strava/Flickr, and upsert into Supabase. Public pages are server-rendered from Supabase. Admin is protected via NextAuth credentials.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + PostGIS), Leaflet.js, NextAuth.js, next-intl, @mapbox/polyline, Jest + React Testing Library

---

## Phase 1: Foundation

### Task 1: Bootstrap Next.js project

**Files:**
- Create: `package.json` (via scaffolding)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=no \
  --import-alias="@/*"
```

Accept all defaults. This creates `app/`, `components/`, `public/`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`.

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  @supabase/supabase-js \
  next-auth@beta \
  next-intl \
  leaflet \
  @mapbox/polyline \
  bcryptjs

npm install -D \
  @types/leaflet \
  @types/mapbox__polyline \
  @types/bcryptjs \
  jest \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  ts-jest
```

- [ ] **Step 3: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 4: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

Open `package.json` and ensure `scripts` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Run tests to verify setup**

```bash
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 skipped` with exit code 0.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: bootstrap Next.js project with Jest"
```

---

### Task 2: Environment variables and Supabase client

**Files:**
- Create: `.env.local` (local only, never committed)
- Create: `.env.example`
- Create: `lib/supabase.ts`
- Create: `__tests__/lib/supabase.test.ts`

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Strava OAuth
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret

# Flickr
FLICKR_API_KEY=your-api-key
FLICKR_USER_ID=your-flickr-nsid

# NextAuth
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Admin credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=bcrypt-hash-of-password

# Cron security
CRON_SECRET=generate-with-openssl-rand-base64-32
```

- [ ] **Step 2: Create `.env.local` from `.env.example`**

```bash
cp .env.example .env.local
```

Fill in real values for local development. Add `.env.local` to `.gitignore` (it should already be there from `create-next-app`).

- [ ] **Step 3: Write the failing test**

Create `__tests__/lib/supabase.test.ts`:

```typescript
import { createSupabaseClient } from '@/lib/supabase'

describe('createSupabaseClient', () => {
  it('returns a supabase client object with from method', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'test-key'
    const client = createSupabaseClient()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test -- __tests__/lib/supabase.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/supabase'`

- [ ] **Step 5: Create `lib/supabase.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, key)
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- __tests__/lib/supabase.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/supabase.ts __tests__/lib/supabase.test.ts .env.example .gitignore
git commit -m "feat: add Supabase client factory"
```

---

### Task 3: Supabase database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Enable PostGIS extension in Supabase**

In the Supabase dashboard → SQL Editor, run:

```sql
create extension if not exists postgis;
```

- [ ] **Step 2: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable PostGIS (idempotent)
create extension if not exists postgis;

-- OAuth tokens (single row)
create table if not exists tokens (
  id integer primary key default 1,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  last_synced_at timestamptz not null default '2000-01-01 00:00:00+00'
);

-- Strava trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  strava_id bigint unique not null,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  distance_m integer not null,
  path geometry(LineString, 4326),
  visible boolean not null default true,
  journal_fr text,
  journal_en text,
  created_at timestamptz not null default now()
);

-- Flickr waypoints
create table if not exists waypoints (
  id uuid primary key default gen_random_uuid(),
  flickr_id text unique not null,
  trip_id uuid references trips(id) on delete set null,
  url_large text not null,
  title text,
  taken_at timestamptz not null,
  lat float not null,
  lng float not null,
  created_at timestamptz not null default now()
);

-- Landing page content (key/value)
create table if not exists site_content (
  key text primary key,
  value text not null
);

-- Seed default site content
insert into site_content (key, value) values
  ('title', 'La Grande Aventure'),
  ('description_fr', 'Suivez le voyage en temps réel.'),
  ('description_en', 'Follow the journey in real time.'),
  ('hero_image_url', '')
on conflict (key) do nothing;

-- Index for trip matching by date
create index if not exists trips_start_end_date_idx on trips(start_date, end_date);

-- Spatial index on trip paths
create index if not exists trips_path_idx on trips using gist(path);
```

- [ ] **Step 3: Run migration in Supabase SQL Editor**

Copy the file contents into the Supabase SQL Editor and run it. Verify all four tables appear in the Table Editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial Supabase schema"
```

---

### Task 4: Polyline decode helper

**Files:**
- Create: `lib/polyline.ts`
- Create: `__tests__/lib/polyline.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/polyline.test.ts
import { decodePolylineToGeoJSON } from '@/lib/polyline'

describe('decodePolylineToGeoJSON', () => {
  it('decodes a Strava polyline string to a GeoJSON LineString', () => {
    // Strava polyline for two points: [48.8566, 2.3522] and [48.8600, 2.3600]
    const encoded = '_flyHmfyMaBlW'
    const result = decodePolylineToGeoJSON(encoded)
    expect(result.type).toBe('LineString')
    expect(result.coordinates.length).toBeGreaterThanOrEqual(2)
    // GeoJSON uses [lng, lat] order
    expect(typeof result.coordinates[0][0]).toBe('number')
    expect(typeof result.coordinates[0][1]).toBe('number')
  })

  it('returns null for an empty polyline', () => {
    const result = decodePolylineToGeoJSON('')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/polyline.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/polyline'`

- [ ] **Step 3: Create `lib/polyline.ts`**

```typescript
import polyline from '@mapbox/polyline'

interface GeoJSONLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export function decodePolylineToGeoJSON(encoded: string): GeoJSONLineString | null {
  if (!encoded) return null

  // @mapbox/polyline returns [[lat, lng], ...]
  const latLngPairs = polyline.decode(encoded)

  if (latLngPairs.length === 0) return null

  // GeoJSON requires [lng, lat] order
  const coordinates: [number, number][] = latLngPairs.map(([lat, lng]) => [lng, lat])

  return { type: 'LineString', coordinates }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/lib/polyline.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/polyline.ts __tests__/lib/polyline.test.ts
git commit -m "feat: add polyline decode helper"
```

---

### Task 5: Trip-to-photo timestamp matcher

**Files:**
- Create: `lib/trip-match.ts`
- Create: `__tests__/lib/trip-match.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/trip-match.test.ts
import { matchPhotoToTrip } from '@/lib/trip-match'

const trips = [
  {
    id: 'trip-1',
    start_date: '2024-06-01T08:00:00Z',
    end_date: '2024-06-01T10:00:00Z',
  },
  {
    id: 'trip-2',
    start_date: '2024-06-02T09:00:00Z',
    end_date: '2024-06-02T12:00:00Z',
  },
]

describe('matchPhotoToTrip', () => {
  it('matches a photo taken during a trip', () => {
    const result = matchPhotoToTrip('2024-06-01T09:00:00Z', trips)
    expect(result).toBe('trip-1')
  })

  it('matches a photo at the exact start of a trip', () => {
    const result = matchPhotoToTrip('2024-06-01T08:00:00Z', trips)
    expect(result).toBe('trip-1')
  })

  it('returns null when photo is taken outside all trips', () => {
    const result = matchPhotoToTrip('2024-06-03T10:00:00Z', trips)
    expect(result).toBeNull()
  })

  it('returns null for empty trip list', () => {
    const result = matchPhotoToTrip('2024-06-01T09:00:00Z', [])
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/trip-match.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/trip-match'`

- [ ] **Step 3: Create `lib/trip-match.ts`**

```typescript
interface TripWindow {
  id: string
  start_date: string
  end_date: string
}

export function matchPhotoToTrip(
  takenAt: string,
  trips: TripWindow[]
): string | null {
  const photoTime = new Date(takenAt).getTime()

  for (const trip of trips) {
    const start = new Date(trip.start_date).getTime()
    const end = new Date(trip.end_date).getTime()
    if (photoTime >= start && photoTime <= end) {
      return trip.id
    }
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/lib/trip-match.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trip-match.ts __tests__/lib/trip-match.test.ts
git commit -m "feat: add photo-to-trip timestamp matcher"
```

---

## Phase 2: Sync Engine

### Task 6: Strava OAuth helper

**Files:**
- Create: `lib/strava.ts`
- Create: `__tests__/lib/strava.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/strava.test.ts
import { buildStravaAuthUrl, parseTokenResponse } from '@/lib/strava'

describe('buildStravaAuthUrl', () => {
  it('returns a valid Strava authorization URL', () => {
    const url = buildStravaAuthUrl('http://localhost:3000/admin/connect-strava/callback')
    expect(url).toContain('https://www.strava.com/oauth/authorize')
    expect(url).toContain('scope=activity%3Aread_all')
    expect(url).toContain('redirect_uri=')
  })
})

describe('parseTokenResponse', () => {
  it('extracts access_token, refresh_token, and expires_at from Strava response', () => {
    const raw = {
      access_token: 'abc',
      refresh_token: 'def',
      expires_at: 1700000000,
    }
    const result = parseTokenResponse(raw)
    expect(result.access_token).toBe('abc')
    expect(result.refresh_token).toBe('def')
    expect(result.expires_at).toBeInstanceOf(Date)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/strava.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/strava'`

- [ ] **Step 3: Create `lib/strava.ts`**

```typescript
const STRAVA_BASE = 'https://www.strava.com'

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: Date
}

export interface StravaActivity {
  id: number
  name: string
  start_date: string
  elapsed_time: number
  distance: number
  map: { summary_polyline: string }
}

export function buildStravaAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  })
  return `${STRAVA_BASE}/oauth/authorize?${params}`
}

export function parseTokenResponse(raw: {
  access_token: string
  refresh_token: string
  expires_at: number
}): StravaTokens {
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: new Date(raw.expires_at * 1000),
  }
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(`${STRAVA_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status}`)
  }

  return parseTokenResponse(await res.json())
}

export async function fetchStravaActivitiesSince(
  accessToken: string,
  since: Date
): Promise<StravaActivity[]> {
  const after = Math.floor(since.getTime() / 1000)
  const res = await fetch(
    `${STRAVA_BASE}/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    throw new Error(`Strava activities fetch failed: ${res.status}`)
  }

  return res.json()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/strava.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/strava.ts __tests__/lib/strava.test.ts
git commit -m "feat: add Strava OAuth and activity fetch helpers"
```

---

### Task 7: Flickr sync helper

**Files:**
- Create: `lib/flickr.ts`
- Create: `__tests__/lib/flickr.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/flickr.test.ts
import { buildFlickrPhotoUrl, parseFlickrPhoto } from '@/lib/flickr'

describe('buildFlickrPhotoUrl', () => {
  it('builds a large photo URL from Flickr photo fields', () => {
    const url = buildFlickrPhotoUrl({
      farm: 1,
      server: '123',
      id: '456',
      secret: 'abc',
    })
    expect(url).toBe('https://farm1.staticflickr.com/123/456_abc_b.jpg')
  })
})

describe('parseFlickrPhoto', () => {
  it('returns null for a photo with no location', () => {
    const raw = { id: '1', title: { _content: 'test' }, datetaken: '2024-01-01 10:00:00', farm: 1, server: '1', secret: 'x' }
    const result = parseFlickrPhoto(raw, null)
    expect(result).toBeNull()
  })

  it('parses a photo with valid location', () => {
    const raw = {
      id: '1',
      title: { _content: 'Summit' },
      datetaken: '2024-06-01 09:30:00',
      farm: 1,
      server: '123',
      secret: 'abc',
    }
    const location = { latitude: '48.8566', longitude: '2.3522' }
    const result = parseFlickrPhoto(raw, location)
    expect(result).not.toBeNull()
    expect(result!.flickr_id).toBe('1')
    expect(result!.lat).toBe(48.8566)
    expect(result!.lng).toBe(2.3522)
    expect(result!.title).toBe('Summit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/flickr.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `lib/flickr.ts`**

```typescript
const FLICKR_API = 'https://api.flickr.com/services/rest'

export interface FlickrPhoto {
  flickr_id: string
  url_large: string
  title: string
  taken_at: Date
  lat: number
  lng: number
}

export function buildFlickrPhotoUrl(photo: {
  farm: number
  server: string
  id: string
  secret: string
}): string {
  return `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`
}

export function parseFlickrPhoto(
  raw: {
    id: string
    title: { _content: string }
    datetaken: string
    farm: number
    server: string
    secret: string
  },
  location: { latitude: string; longitude: string } | null
): FlickrPhoto | null {
  if (!location) return null

  const lat = parseFloat(location.latitude)
  const lng = parseFloat(location.longitude)

  if (isNaN(lat) || isNaN(lng)) return null

  return {
    flickr_id: raw.id,
    url_large: buildFlickrPhotoUrl(raw),
    title: raw.title._content,
    taken_at: new Date(raw.datetaken.replace(' ', 'T') + 'Z'),
    lat,
    lng,
  }
}

export async function fetchFlickrPhotos(userId: string, apiKey: string): Promise<FlickrPhoto[]> {
  // Fetch photo list
  const listParams = new URLSearchParams({
    method: 'flickr.people.getPublicPhotos',
    api_key: apiKey,
    user_id: userId,
    extras: 'date_taken,geo',
    per_page: '500',
    format: 'json',
    nojsoncallback: '1',
  })

  const listRes = await fetch(`${FLICKR_API}?${listParams}`)
  if (!listRes.ok) throw new Error(`Flickr list fetch failed: ${listRes.status}`)
  const listData = await listRes.json()

  const rawPhotos: typeof listData.photos.photo = listData.photos?.photo ?? []
  const results: FlickrPhoto[] = []

  for (const raw of rawPhotos) {
    // Fetch location for each photo
    const geoParams = new URLSearchParams({
      method: 'flickr.photos.geo.getLocation',
      api_key: apiKey,
      photo_id: raw.id,
      format: 'json',
      nojsoncallback: '1',
    })

    const geoRes = await fetch(`${FLICKR_API}?${geoParams}`)
    if (!geoRes.ok) continue

    const geoData = await geoRes.json()
    const location = geoData.photo?.location ?? null

    const parsed = parseFlickrPhoto(raw, location)
    if (parsed) results.push(parsed)
  }

  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/flickr.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/flickr.ts __tests__/lib/flickr.test.ts
git commit -m "feat: add Flickr photo fetch and parse helpers"
```

---

### Task 8: Strava cron route

**Files:**
- Create: `app/api/cron/strava/route.ts`
- Create: `__tests__/api/cron/strava.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/cron/strava.test.ts
import { verifyCronSecret } from '@/app/api/cron/strava/route'

describe('verifyCronSecret', () => {
  it('returns true when Authorization header matches CRON_SECRET', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers({ Authorization: 'Bearer my-secret' })
    expect(verifyCronSecret(headers)).toBe(true)
  })

  it('returns false when Authorization header does not match', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers({ Authorization: 'Bearer wrong' })
    expect(verifyCronSecret(headers)).toBe(false)
  })

  it('returns false when Authorization header is missing', () => {
    process.env.CRON_SECRET = 'my-secret'
    const headers = new Headers()
    expect(verifyCronSecret(headers)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/api/cron/strava.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create `app/api/cron/strava/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { refreshStravaToken, fetchStravaActivitiesSince } from '@/lib/strava'
import { decodePolylineToGeoJSON } from '@/lib/polyline'

export function verifyCronSecret(headers: Headers): boolean {
  const auth = headers.get('Authorization')
  if (!auth) return false
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  // Load stored tokens
  const { data: tokenRow, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', 1)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'No tokens stored. Complete Strava OAuth first.' }, { status: 400 })
  }

  // Refresh token if expired
  let accessToken = tokenRow.access_token
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshed = await refreshStravaToken(tokenRow.refresh_token)
    accessToken = refreshed.access_token
    await supabase.from('tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at.toISOString(),
    }).eq('id', 1)
  }

  // Fetch new activities
  const since = new Date(tokenRow.last_synced_at)
  const activities = await fetchStravaActivitiesSince(accessToken, since)

  let upserted = 0
  for (const activity of activities) {
    const path = decodePolylineToGeoJSON(activity.map?.summary_polyline ?? '')
    const endDate = new Date(
      new Date(activity.start_date).getTime() + activity.elapsed_time * 1000
    )

    await supabase.from('trips').upsert({
      strava_id: activity.id,
      name: activity.name,
      start_date: activity.start_date,
      end_date: endDate.toISOString(),
      distance_m: Math.round(activity.distance),
      path: path ? JSON.stringify(path) : null,
    }, { onConflict: 'strava_id' })

    upserted++
  }

  // Update last_synced_at
  await supabase.from('tokens').update({
    last_synced_at: new Date().toISOString(),
  }).eq('id', 1)

  return NextResponse.json({ upserted })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/api/cron/strava.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/strava/ __tests__/api/cron/strava.test.ts
git commit -m "feat: add Strava cron sync route"
```

---

### Task 9: Flickr cron route

**Files:**
- Create: `app/api/cron/flickr/route.ts`

- [ ] **Step 1: Create `app/api/cron/flickr/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchFlickrPhotos } from '@/lib/flickr'
import { matchPhotoToTrip } from '@/lib/trip-match'
import { verifyCronSecret } from '@/app/api/cron/strava/route'

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers as unknown as Headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()

  // Fetch all trip windows for timestamp matching
  const { data: trips } = await supabase
    .from('trips')
    .select('id, start_date, end_date')

  const tripWindows = (trips ?? []).map((t) => ({
    id: t.id as string,
    start_date: t.start_date as string,
    end_date: t.end_date as string,
  }))

  const photos = await fetchFlickrPhotos(
    process.env.FLICKR_USER_ID!,
    process.env.FLICKR_API_KEY!
  )

  let upserted = 0
  for (const photo of photos) {
    const tripId = matchPhotoToTrip(photo.taken_at.toISOString(), tripWindows)

    await supabase.from('waypoints').upsert({
      flickr_id: photo.flickr_id,
      trip_id: tripId,
      url_large: photo.url_large,
      title: photo.title,
      taken_at: photo.taken_at.toISOString(),
      lat: photo.lat,
      lng: photo.lng,
    }, { onConflict: 'flickr_id' })

    upserted++
  }

  return NextResponse.json({ upserted })
}
```

- [ ] **Step 2: Configure Vercel cron jobs**

Create `vercel.json` at the project root:

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
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/flickr/ vercel.json
git commit -m "feat: add Flickr cron sync route and Vercel cron config"
```

---

### Task 10: One-time Strava OAuth page

**Files:**
- Create: `app/admin/connect-strava/page.tsx`
- Create: `app/api/strava/callback/route.ts`

- [ ] **Step 1: Create `app/api/strava/callback/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'
import { parseTokenResponse } from '@/lib/strava'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 })
  }

  const tokens = parseTokenResponse(await res.json())
  const supabase = createSupabaseClient()

  await supabase.from('tokens').upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at.toISOString(),
    last_synced_at: new Date(0).toISOString(),
  }, { onConflict: 'id' })

  return NextResponse.redirect(new URL('/admin', request.url))
}
```

- [ ] **Step 2: Create `app/admin/connect-strava/page.tsx`**

```typescript
import { buildStravaAuthUrl } from '@/lib/strava'

export default function ConnectStravaPage() {
  const callbackUrl =
    process.env.NEXTAUTH_URL + '/api/strava/callback'
  const authUrl = buildStravaAuthUrl(callbackUrl)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Connect Strava</h1>
      <p className="mb-4 text-gray-600">
        This one-time step authorizes the app to read your Strava activities automatically.
      </p>
      <a
        href={authUrl}
        className="inline-block bg-orange-500 text-white px-6 py-3 rounded font-semibold hover:bg-orange-600"
      >
        Authorize with Strava
      </a>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/connect-strava/ app/api/strava/
git commit -m "feat: add one-time Strava OAuth flow"
```

---

## Phase 3: Internationalisation + Public Site

### Task 11: Configure next-intl

**Files:**
- Create: `middleware.ts`
- Create: `i18n/request.ts`
- Create: `messages/fr.json`
- Create: `messages/en.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `messages/fr.json`**

```json
{
  "nav": {
    "map": "Voir la carte",
    "back": "Retour à la carte"
  },
  "landing": {
    "cta": "Voir le voyage"
  },
  "map": {
    "distance": "Distance",
    "date": "Date",
    "journal": "Journal",
    "viewTrip": "Voir l'étape"
  },
  "trip": {
    "backToMap": "← Retour à la carte"
  }
}
```

- [ ] **Step 2: Create `messages/en.json`**

```json
{
  "nav": {
    "map": "View map",
    "back": "Back to map"
  },
  "landing": {
    "cta": "View the journey"
  },
  "map": {
    "distance": "Distance",
    "date": "Date",
    "journal": "Journal",
    "viewTrip": "View leg"
  },
  "trip": {
    "backToMap": "← Back to map"
  }
}
```

- [ ] **Step 3: Create `i18n/request.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value ?? 'fr'
  const validLocales = ['fr', 'en']
  const resolvedLocale = validLocales.includes(locale) ? locale : 'fr'

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  }
})
```

- [ ] **Step 4: Create `middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localeDetection: false,
  localePrefix: 'never',
})

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

- [ ] **Step 5: Update `next.config.ts`**

```typescript
import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {}

export default withNextIntl(nextConfig)
```

- [ ] **Step 6: Create `app/api/locale/route.ts`** (locale switcher endpoint)

```typescript
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { locale } = await request.json()
  if (!['fr', 'en'].includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }
  const response = NextResponse.json({ locale })
  response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}
```

- [ ] **Step 7: Commit**

```bash
git add middleware.ts i18n/ messages/ next.config.ts app/api/locale/
git commit -m "feat: configure next-intl for FR/EN"
```

---

### Task 12: Language switcher component

**Files:**
- Create: `components/LanguageSwitcher.tsx`

- [ ] **Step 1: Create `components/LanguageSwitcher.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()

  async function switchLocale(next: string) {
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    })
    router.refresh()
  }

  return (
    <div className="flex gap-2 text-sm">
      <button
        onClick={() => switchLocale('fr')}
        className={locale === 'fr' ? 'font-bold underline' : 'text-gray-500 hover:text-gray-800'}
      >
        FR
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => switchLocale('en')}
        className={locale === 'en' ? 'font-bold underline' : 'text-gray-500 hover:text-gray-800'}
      >
        EN
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/layout.tsx`** (global layout with header)

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import Link from 'next/link'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BikeTrip Tracker',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
            <Link href="/" className="font-semibold text-gray-800">
              BikeTrip
            </Link>
            <LanguageSwitcher />
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/LanguageSwitcher.tsx app/layout.tsx
git commit -m "feat: add language switcher and global layout"
```

---

### Task 13: Landing page

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 1: Create `app/page.tsx`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export default async function LandingPage() {
  const t = await getTranslations('landing')
  const content = await getSiteContent()
  const { getLocale } = await import('next-intl/server')
  const locale = await getLocale()

  const description = locale === 'fr'
    ? content.description_fr
    : content.description_en

  return (
    <main className="min-h-screen flex flex-col">
      {content.hero_image_url && (
        <div className="relative w-full h-64 md:h-96">
          <Image
            src={content.hero_image_url}
            alt={content.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">{content.title}</h1>
        <p className="text-lg text-gray-600 max-w-xl mb-8">{description}</p>
        <Link
          href="/map"
          className="bg-gray-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          {t('cta')}
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify it renders locally**

```bash
npm run dev
```

Open `http://localhost:3000`. You should see the landing page with the default title and description from `site_content`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add landing page"
```

---

### Task 14: Leaflet Map component

**Files:**
- Create: `components/Map.tsx`
- Create: `components/PhotoModal.tsx`

- [ ] **Step 1: Create `components/PhotoModal.tsx`**

```typescript
'use client'

interface PhotoModalProps {
  imageUrl: string
  title: string
  onClose: () => void
}

export function PhotoModal({ imageUrl, title, onClose }: PhotoModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg overflow-hidden max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={imageUrl} alt={title} className="w-full object-contain max-h-[70vh]" />
        <div className="p-4 flex justify-between items-center">
          <p className="font-medium text-gray-800">{title}</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/Map.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { PhotoModal } from './PhotoModal'

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
  const [selectedPhoto, setSelectedPhoto] = useState<Waypoint | null>(null)

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
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
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
```

- [ ] **Step 3: Commit**

```bash
git add components/Map.tsx components/PhotoModal.tsx
git commit -m "feat: add Leaflet Map and PhotoModal components"
```

---

### Task 15: Full-journey map page

**Files:**
- Create: `app/map/page.tsx`

- [ ] **Step 1: Create `app/map/page.tsx`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'
import { getLocale } from 'next-intl/server'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-gray-400">Loading map...</div>,
})

async function getMapData() {
  const supabase = createSupabaseClient()

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, start_date, distance_m, path, journal_fr, journal_en')
    .eq('visible', true)
    .order('start_date', { ascending: true })

  const { data: waypoints } = await supabase
    .from('waypoints')
    .select('id, lat, lng, url_large, title')

  const formattedTrips = (trips ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    distance_m: t.distance_m,
    journal_fr: t.journal_fr,
    journal_en: t.journal_en,
    coordinates: t.path?.coordinates ?? [],
  }))

  return {
    trips: formattedTrips,
    waypoints: waypoints ?? [],
  }
}

export default async function MapPage() {
  const { trips, waypoints } = await getMapData()
  const locale = await getLocale()

  return (
    <div className="h-[calc(100vh-57px)]">
      <Map trips={trips} waypoints={waypoints} locale={locale} />
    </div>
  )
}
```

- [ ] **Step 2: Verify the map page loads**

```bash
npm run dev
```

Open `http://localhost:3000/map`. The map should render (empty if no trips in DB yet).

- [ ] **Step 3: Commit**

```bash
git add app/map/
git commit -m "feat: add full-journey map page"
```

---

### Task 16: Individual trip page

**Files:**
- Create: `app/trips/[id]/page.tsx`

- [ ] **Step 1: Create `app/trips/[id]/page.tsx`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'
import { getLocale, getTranslations } from 'next-intl/server'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const Map = dynamic(() => import('@/components/Map').then((m) => m.Map), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-gray-400">Loading map...</div>,
})

export default async function TripPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseClient()
  const locale = await getLocale()
  const t = await getTranslations('trip')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', params.id)
    .eq('visible', true)
    .single()

  if (!trip) notFound()

  const { data: waypoints } = await supabase
    .from('waypoints')
    .select('id, lat, lng, url_large, title')
    .eq('trip_id', params.id)

  const journal = locale === 'fr' ? trip.journal_fr : trip.journal_en
  const distanceKm = (trip.distance_m / 1000).toFixed(1)
  const formattedTrip = {
    id: trip.id,
    name: trip.name,
    start_date: trip.start_date,
    distance_m: trip.distance_m,
    journal_fr: trip.journal_fr,
    journal_en: trip.journal_en,
    coordinates: trip.path?.coordinates ?? [],
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-6 py-4 border-b bg-white">
        <Link href="/map" className="text-sm text-gray-500 hover:text-gray-800 mb-2 inline-block">
          {t('backToMap')}
        </Link>
        <h1 className="text-xl font-bold">{trip.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date(trip.start_date).toLocaleDateString(locale)} · {distanceKm} km
        </p>
        {journal && <p className="mt-2 text-gray-700">{journal}</p>}
      </div>
      <div className="flex-1">
        <Map trips={[formattedTrip]} waypoints={waypoints ?? []} locale={locale} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/trips/
git commit -m "feat: add individual trip page"
```

---

## Phase 4: Admin Panel

### Task 17: NextAuth setup

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `lib/auth.ts`**

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string
        const password = credentials?.password as string

        if (!email || !password) return null
        if (email !== process.env.ADMIN_EMAIL) return null

        const valid = await compare(password, process.env.ADMIN_PASSWORD_HASH!)
        if (!valid) return null

        return { id: '1', email }
      },
    }),
  ],
  pages: { signIn: '/admin/login' },
  session: { strategy: 'jwt' },
})
```

- [ ] **Step 2: Create `app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 3: Generate the admin password hash**

Run this once locally to generate your hash:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(h => console.log(h))"
```

Copy the output into `ADMIN_PASSWORD_HASH` in `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/
git commit -m "feat: add NextAuth credentials provider for admin"
```

---

### Task 18: Admin layout and login page

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Create `app/admin/layout.tsx`**

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/login/page.tsx`**

```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError('Invalid credentials')
    } else {
      router.push('/admin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6">Admin Login</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gray-900 text-white py-2 rounded font-semibold hover:bg-gray-700"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx app/admin/login/
git commit -m "feat: add admin layout with auth guard and login page"
```

---

### Task 19: Admin trips management page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/api/admin/trips/[id]/route.ts`

- [ ] **Step 1: Create `app/api/admin/trips/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed = ['name', 'visible', 'journal_fr', 'journal_en']
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  const supabase = createSupabaseClient()
  const { error } = await supabase.from('trips').update(update).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create `app/admin/page.tsx`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'
import { TripEditor } from './TripEditor'
import Link from 'next/link'

async function getTrips() {
  const supabase = createSupabaseClient()
  const { data } = await supabase
    .from('trips')
    .select('id, name, start_date, distance_m, visible, journal_fr, journal_en')
    .order('start_date', { ascending: false })
  return data ?? []
}

export default async function AdminPage() {
  const trips = await getTrips()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin — Trips</h1>
        <div className="flex gap-3">
          <Link href="/admin/site-content" className="text-sm text-blue-600 hover:underline">
            Edit site content →
          </Link>
          <Link href="/admin/connect-strava" className="text-sm text-orange-600 hover:underline">
            Connect Strava →
          </Link>
        </div>
      </div>
      <div className="space-y-4">
        {trips.length === 0 && (
          <p className="text-gray-500">No trips yet. Connect Strava and run the sync.</p>
        )}
        {trips.map((trip: any) => (
          <TripEditor key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/TripEditor.tsx`**

```typescript
'use client'

import { useState } from 'react'

interface Trip {
  id: string
  name: string
  start_date: string
  distance_m: number
  visible: boolean
  journal_fr: string | null
  journal_en: string | null
}

export function TripEditor({ trip }: { trip: Trip }) {
  const [name, setName] = useState(trip.name)
  const [visible, setVisible] = useState(trip.visible)
  const [journalFr, setJournalFr] = useState(trip.journal_fr ?? '')
  const [journalEn, setJournalEn] = useState(trip.journal_en ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/trips/${trip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, visible, journal_fr: journalFr, journal_en: journalEn }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const distanceKm = (trip.distance_m / 1000).toFixed(1)

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-base font-semibold border-b border-transparent focus:border-gray-300 focus:outline-none"
          />
          <p className="text-xs text-gray-400">
            {new Date(trip.start_date).toLocaleDateString('en')} · {distanceKm} km
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="rounded"
          />
          Visible
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Journal (FR)</label>
          <textarea
            value={journalFr}
            onChange={(e) => setJournalFr(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Journal (EN)</label>
          <textarea
            value={journalEn}
            onChange={(e) => setJournalEn(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx app/admin/TripEditor.tsx app/api/admin/trips/
git commit -m "feat: add admin trips management page"
```

---

### Task 20: Admin site content editor

**Files:**
- Create: `app/admin/site-content/page.tsx`
- Create: `app/api/admin/site-content/route.ts`

- [ ] **Step 1: Create `app/api/admin/site-content/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Record<string, string> = await request.json()
  const allowedKeys = ['title', 'description_fr', 'description_en', 'hero_image_url']

  const supabase = createSupabaseClient()

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue
    await supabase
      .from('site_content')
      .upsert({ key, value }, { onConflict: 'key' })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create `app/admin/site-content/page.tsx`**

```typescript
import { createSupabaseClient } from '@/lib/supabase'
import { SiteContentEditor } from './SiteContentEditor'
import Link from 'next/link'

async function getSiteContent(): Promise<Record<string, string>> {
  const supabase = createSupabaseClient()
  const { data } = await supabase.from('site_content').select('key, value')
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
}

export default async function SiteContentPage() {
  const content = await getSiteContent()

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Back</Link>
        <h1 className="text-2xl font-bold">Site Content</h1>
      </div>
      <SiteContentEditor content={content} />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/site-content/SiteContentEditor.tsx`**

```typescript
'use client'

import { useState } from 'react'

export function SiteContentEditor({ content }: { content: Record<string, string> }) {
  const [title, setTitle] = useState(content.title ?? '')
  const [descFr, setDescFr] = useState(content.description_fr ?? '')
  const [descEn, setDescEn] = useState(content.description_en ?? '')
  const [heroUrl, setHeroUrl] = useState(content.hero_image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/admin/site-content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description_fr: descFr,
        description_en: descEn,
        hero_image_url: heroUrl,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">Trip Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Description (FR)</label>
        <textarea
          value={descFr}
          onChange={(e) => setDescFr(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Description (EN)</label>
        <textarea
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Hero Image URL</label>
        <input
          value={heroUrl}
          onChange={(e) => setHeroUrl(e.target.value)}
          placeholder="https://..."
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-gray-900 text-white px-6 py-2 rounded font-semibold hover:bg-gray-700 disabled:opacity-50"
      >
        {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/site-content/ app/api/admin/site-content/
git commit -m "feat: add admin site content editor"
```

---

## Phase 5: Deployment

### Task 21: Deploy to Vercel

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ensure `.gitignore` excludes secrets**

Verify `.gitignore` contains:
```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 2: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/biketrip-tracker.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Import project in Vercel**

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the `biketrip-tracker` repository
3. Add all environment variables from `.env.example` with real values
4. Deploy

- [ ] **Step 4: Complete one-time Strava OAuth**

After deployment, visit `https://your-domain.vercel.app/admin/connect-strava`, log in to the admin, and authorize Strava. This stores the refresh token in Supabase.

- [ ] **Step 5: Trigger a manual sync to verify**

```bash
curl -X POST https://your-domain.vercel.app/api/cron/strava \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response: `{"upserted": N}` where N is the number of activities synced.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final deployment prep"
git push
```

---

## Running tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Single file
npm test -- __tests__/lib/strava.test.ts
```
