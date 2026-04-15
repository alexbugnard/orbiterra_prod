# BikeTrip Tracker — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

---

## Overview

A fully public, bilingual (FR/EN) website that automatically syncs a cyclist's Strava rides and geotagged Flickr photos onto an interactive map. The site includes a password-protected admin panel for the cyclist to manage content (trip names, journal entries, visibility, landing page copy).

**Stack:** Next.js (Vercel) · Supabase (PostgreSQL + PostGIS) · Leaflet.js · NextAuth

---

## Architecture

A single Next.js app on Vercel with four layers:

1. **Public site** — landing page, full-journey map, individual ride pages
2. **Sync engine** — two Vercel Cron jobs (every 4h) running as Next.js API routes
3. **Admin panel** — password-protected `/admin` routes via NextAuth credentials
4. **Database** — Supabase as single source of truth for all data

---

## Database Schema

### `tokens`
Stores Strava OAuth credentials. Single row, updated in place.

| Column | Type | Notes |
|---|---|---|
| `id` | int | primary key |
| `access_token` | text | |
| `refresh_token` | text | |
| `expires_at` | timestamptz | |
| `last_synced_at` | timestamptz | used to fetch only new activities |

### `trips`
One row per Strava activity.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `strava_id` | bigint | unique, used for upsert dedup |
| `name` | text | editable in admin |
| `start_date` | timestamptz | |
| `end_date` | timestamptz | derived from start + elapsed time |
| `distance_m` | int | metres |
| `path` | geometry(LineString, 4326) | decoded from Strava polyline via PostGIS |
| `visible` | boolean | default true; hidden trips excluded from public site |
| `journal_fr` | text | nullable; admin-authored journal entry in French |
| `journal_en` | text | nullable; admin-authored journal entry in English |

### `waypoints`
One row per geotagged Flickr photo.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `flickr_id` | text | unique, used for upsert dedup |
| `trip_id` | uuid | nullable FK → `trips.id`; matched by timestamp at sync time |
| `url_large` | text | hotlinked directly from Flickr |
| `title` | text | |
| `taken_at` | timestamptz | |
| `lat` | float | |
| `lng` | float | |

### `site_content`
Key/value store for editable landing page content.

| Column | Type | Notes |
|---|---|---|
| `key` | text | primary key (e.g. `title`, `description_fr`, `description_en`, `hero_image_url`) |
| `value` | text | |

---

## Public Pages

### `/` — Landing page
- Trip title, FR/EN description, hero image
- Language switcher in header (stored in cookie, applied site-wide via `next-intl`)
- "View the journey" CTA → `/map`

### `/map` — Full-journey map
- Full-screen Leaflet map
- All `visible = true` trips drawn as a continuous polyline
- Camera-icon markers at each waypoint
- Clicking a trip segment: highlights it, shows sidebar with name, date, distance, journal entry (in active language), link to `/trips/[id]`
- Clicking a photo marker: opens modal with full-res Flickr image and caption
- Handles missing/null coordinate segments gracefully (Strava privacy buffers)

### `/trips/[id]` — Individual ride page
- Zoomed-in Leaflet map for that ride only
- Photo markers for waypoints matched to this trip
- Stats: distance, date
- Journal entry in active language (if set)
- Back link to `/map`

### `/admin` — Admin panel (protected)
- Login via NextAuth credentials (email + bcrypt password hash from env vars)
- **Trips list:** toggle `visible`, edit `name`, edit `journal_fr` / `journal_en`
- **Landing page editor:** edit all `site_content` keys (title, descriptions, hero image URL)
- No user table — single hardcoded admin user via env vars

---

## Sync Engine

### `POST /api/cron/strava`
1. Verify `Authorization: Bearer $CRON_SECRET` header
2. Read `tokens` row; if `access_token` is expired, call Strava token refresh endpoint and update the row
3. Fetch Strava activities created after `last_synced_at`
4. For each activity: decode polyline with `@mapbox/polyline`, upsert into `trips` by `strava_id`, set `end_date = start_date + elapsed_time`
5. Update `last_synced_at` in `tokens`

### `POST /api/cron/flickr`
1. Verify `CRON_SECRET`
2. Fetch recent photos from configured `FLICKR_USER_ID` using `flickr.people.getPublicPhotos` + `flickr.photos.geo.getLocation`
3. Skip photos without GPS coordinates
4. For each photo: match to a `trip_id` by finding the trip whose `start_date`–`end_date` window contains `taken_at`
5. Upsert into `waypoints` by `flickr_id`

Both routes are triggered by Vercel Cron (configured in `vercel.json`) every 4 hours.

---

## Internationalisation

- Library: `next-intl`
- Languages: `fr` (default), `en`
- Translation files: `messages/fr.json`, `messages/en.json`
- Language preference stored in a cookie; language switcher in the global header
- Admin panel is English-only

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-only) |
| `STRAVA_CLIENT_ID` | Strava app client ID |
| `STRAVA_CLIENT_SECRET` | Strava app client secret |
| `FLICKR_API_KEY` | Flickr app API key |
| `FLICKR_USER_ID` | Flickr account user ID to sync from |
| `NEXTAUTH_SECRET` | NextAuth session signing secret |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `CRON_SECRET` | Shared secret to authenticate cron route calls |

---

## Key Implementation Notes

- **No local image storage** — Flickr URLs are hotlinked directly
- **Privacy buffers** — Strava may omit start/end coordinates near home; null segments must be skipped when drawing polylines
- **Photos without GPS** — stored but skipped for map placement; `trip_id` left null
- **Strava one-time auth** — the initial OAuth flow (authorization code → tokens) is a one-time setup step, run manually or via a `/admin/connect-strava` page. After that, the sync engine handles token refresh automatically.
