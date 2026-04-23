# orbiterra — Vincent's Pan-American Cycling Tracker

A live map tracking Vincent Morisetti's cycling journey from Deadhorse, Alaska to Ushuaia, Argentina (~30,000 km across two continents).

## What the app does

- Displays every completed ride as an interactive trace on a Leaflet map
- Shows the full planned route (Deadhorse → Ushuaia) as a reference line
- Places geotagged photos from the road on the map
- Shows a live weather layer along the planned route
- Marks cities, mountains, passes and lakes near the route with Wikipedia summaries
- Estimates Vincent's current position from the furthest point he has ridden on the planned route
- Tracks overall stats: distance ridden, elevation gain, countries crossed, Americas crossing progress

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Mapping:** Leaflet.js (client-side only, SSR disabled)
- **Auth:** NextAuth.js (credentials provider)
- **i18n:** next-intl — French default, English toggle
- **Hosting:** Vercel with Vercel Cron jobs

## Data sources

| Data | Source | Refresh |
|------|--------|---------|
| Rides | Strava API (OAuth) | Every ~4 hours |
| Photos | Flickr API (geotagged) | Every ~4 hours |
| Videos | YouTube RSS feed | Every hour |
| Weather | OpenWeatherMap API | On map load |
| City/POI descriptions | Wikipedia REST API | On demand |

## Version

The app version is defined in `lib/version.ts`. Increment it on every commit that touches user-visible features or fixes.

## Local development

```bash
npm install
npm run dev
```

Requires a `.env.local` with Supabase, Strava, Flickr, NextAuth, and OpenWeatherMap credentials.

## Database migrations

SQL files in `supabase/` can be run in the Supabase SQL editor. Files ending in `_batch*.sql` are data seeding scripts safe to re-run (they use `ON CONFLICT DO NOTHING`).
