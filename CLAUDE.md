# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BikeTrip Tracker** — a serverless web app that automatically syncs a cyclist's (Vincent's) Strava activities and Flickr photos onto an interactive map, tracking his Alaska → Ushuaia cycling journey. The app is live and actively developed.

## Tech Stack

- **Framework:** Next.js 15 (App Router — server components + client components, API routes)
- **Database:** Supabase (PostgreSQL) — no PostGIS needed, coordinates stored as JSONB
- **Mapping:** Leaflet.js (loaded dynamically, SSR disabled)
- **Auth:** NextAuth.js with credentials provider (bcrypt-hashed admin password in env)
- **i18n:** next-intl — French default, English toggle; messages in `messages/fr.json` and `messages/en.json`
- **Hosting:** Vercel (free tier) with Vercel Cron jobs

## Database Schema

Five tables in Supabase:

- **`trips`** — `id, name, strava_id, start_date, end_date, distance_m, coordinates jsonb ([lng,lat][]), elevation jsonb ([distanceMeters,altMeters][]), start_lat, start_lng, visible, journal_fr, journal_en, last_synced_at`
- **`waypoints`** — `id, trip_id, lat, lng, url_large, title, flickr_id, taken_at`
- **`planned_routes`** — `id, name, coordinates jsonb ([lng,lat][]), color`
- **`videos`** — `id, youtube_id (unique), title, published_at, sort_order`
- **`strava_tokens`** — `id, access_token, refresh_token, expires_at`

## Architecture

### Sync Engine
- **Strava cron** (`/api/cron/strava`) — runs every ~4h via Vercel Cron; refreshes OAuth token, fetches activities since `last_synced_at`, decodes polylines, samples elevation streams to 200 points, populates `start_lat`/`start_lng` from first coordinate
- **YouTube cron** (`/api/cron/youtube`) — runs hourly; fetches public RSS feed (no API key needed: `https://www.youtube.com/feeds/videos.xml?channel_id=...`), upserts by `youtube_id`
- **Flickr** — synced via Strava cron using `flickr.photos.geo.getLocation`; stored as waypoints

### Frontend Pages
- **`/`** — landing page with full-bleed background image (`/image_landing_page.png`) + overlay
- **`/map`** — main map page; stats overlay (rides, km, photos, Americas crossing % + km left); About modal
- **`/trips/[id]`** — trip detail page; header with elevation profile + map below; bidirectional hover sync

### Key Components
- **`Map.tsx`** — core Leaflet component; polylines, waypoint markers, planned route (dashed cyan), trip detail side panel, elevation ↔ map bidirectional hover
- **`ElevationProfile.tsx`** — custom SVG chart with ResizeObserver (no chart library); shows gain, min/max alt, hover indicator
- **`TripViewClient.tsx`** — client wrapper for `/trips/[id]`; owns shared `hoveredDistance` state passed as `externalHover` to both `ElevationProfile` and `MapClient`
- **`MapClient.tsx`** — thin client wrapper that dynamically imports `Map` (SSR disabled); accepts optional `externalHover` prop
- **`AboutModal.tsx`** — rendered via `createPortal` to `document.body` (escapes header `backdrop-filter` stacking context); shows goal, Vincent bio, sponsors (RAB logo), YouTube videos
- **`AboutButton.tsx`** — receives translated label as prop (avoids `useTranslations` hydration issue in client component)

## Key Implementation Notes

### Coordinate format
Coordinates are stored as `[lng, lat][]` (GeoJSON convention). When passing to Leaflet, always convert: `coords.map(([lng, lat]) => [lat, lng])`.

### Elevation hover sync
Bidirectional: hovering the Leaflet polyline updates the elevation profile indicator, and hovering the SVG profile moves an orange `circleMarker` on the map. Uses `useRef` for Leaflet closure access (`setHoveredDistanceRef`, `externalHoverRef`, `cumDistsRef`). `circleMarker` extends `Path` — use `setStyle({opacity, fillOpacity})` not `setOpacity()`.

### Americas crossing progress
Computed in `app/map/page.tsx` via `computeAmericasProgress`: filters trips with `start_lng` in -170 to -34 range, finds southernmost latitude reached, computes % of lat span covered from Alaska to Ushuaia.

### bcrypt in .env.local
Dollar signs in bcrypt hashes must be escaped: `\$2b\$10\$...` — otherwise dotenv interpolates `$2b` as an empty variable.

### YouTube sync
Uses public RSS feed — no API key needed. Channel ID: `UCxOaBkNDFV1BRL_eUMWuQyQ`. Parsed with regex in `lib/youtube.ts`.

### Privacy buffers
Strava may omit start/end coordinates near home. Handle null/missing coordinate segments gracefully — never let the map break on sparse data.

### No local image storage
Hotlink directly from Flickr URLs. Photos without GPS are stored but not placed on the map.

### Resetting sync for backfill
To re-sync all activities: PATCH `strava_tokens.last_synced_at` to an early date via Supabase REST API, then trigger `/api/cron/strava`.
