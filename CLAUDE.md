# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BikeTrip Tracker** — a serverless web app that automatically syncs a cyclist's Strava activities and Flickr photos onto an interactive map. No code exists yet; this is a greenfield project.

## Intended Tech Stack

- **Framework:** Next.js (API routes handle backend logic)
- **Database:** Supabase (PostgreSQL + PostGIS for geospatial data)
- **Mapping:** Leaflet.js or Mapbox
- **External APIs:** Strava (OAuth2 + polyline decoding) and Flickr (`flickr.photos.geo.getLocation`)
- **Hosting:** Vercel (free tier)

## Architecture

Three main subsystems:

1. **OAuth + Token Storage** — User authenticates once via Strava OAuth2. The `refresh_token` is persisted in Supabase. A helper refreshes `access_token` on demand without user interaction.

2. **Sync Engine (Cron, ~4h interval)** — Next.js API route triggered by Vercel Cron:
   - Fetches new Strava activities → decodes polylines → stores as GeoJSON/coordinates in `trips` table
   - Fetches Flickr photostream → extracts GPS from EXIF → stores URL + lat/lng + timestamp in `waypoints` table
   - Avoids hitting API rate limits on every page load by caching in Supabase

3. **Frontend Map** — Full-screen Leaflet map that reads from Supabase:
   - Draws journey polylines in high-contrast color
   - Places clickable camera-icon markers at photo waypoints
   - On click: modal/popup showing the Flickr image at full resolution with caption

## Key Implementation Notes

- **No local image storage** — hotlink directly from Flickr URLs
- **Privacy buffers** — Strava may hide ride start/end near home; handle missing/null coordinate segments gracefully so the map doesn't break
- **EXIF GPS requirement** — photos without location data have no coordinates; store them but skip map placement (or place at a default)
- **Supabase schema** — two core tables: `trips` (path geometry, Strava activity metadata) and `waypoints` (photo URL, caption, lat, lng, timestamp, foreign key to trip)
