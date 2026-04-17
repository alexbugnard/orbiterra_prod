# Météo Layer — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

A toggleable weather forecast layer on the BikeTrip Tracker map. Every day at midnight a cron job fetches tomorrow's forecast from Open-Meteo for a set of pre-computed points sampled every ~50 km along the planned route. Visitors can activate the layer via a "Météo" button on the map to see cloudiness/rain icons, min/max temperatures, and a dominant wind arrow at each point.

---

## Database

New table: `weather_points`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `seq` | int | order along the route (0, 1, 2…) |
| `lat` | float | sampled from route geometry |
| `lng` | float | |
| `label` | text | nullable — nearest town name, reverse-geocoded once at setup |
| `fetched_at` | timestamptz | timestamp of last daily fetch |
| `weather_code` | int | WMO weather code (maps to icon: sun, cloud, rain, snow, storm) |
| `temp_min` | float | °C |
| `temp_max` | float | °C |
| `wind_direction` | int | degrees 0–360 |
| `wind_speed` | float | km/h (dominant wind) |

The geographic columns (`lat`, `lng`, `seq`, `label`) are populated **once** at setup via a script using PostGIS `ST_LineInterpolatePoints` on the planned route geometry stored in `trips`. Only the weather columns are updated by the daily cron.

---

## Sync Engine

### `POST /api/cron/weather`

Added to the existing Vercel Cron schedule — runs daily at midnight.

1. Verify `Authorization: Bearer $CRON_SECRET` header
2. Read all rows from `weather_points` ordered by `seq`
3. Issue a **single batched request** to Open-Meteo forecast API with all `lat`/`lng` pairs, requesting `daily` variables:
   - `weathercode`
   - `temperature_2m_min`
   - `temperature_2m_max`
   - `winddirection_10m_dominant`
   - `windspeed_10m_max`
4. For each point, update weather columns using **day index 1** (tomorrow) from the response + set `fetched_at = now()`

No new environment variables needed — Open-Meteo requires no API key.

---

## Frontend Map Layer

### Toggle button

A **"Météo"** button in the map's top-right controls area. Clicking it toggles the weather layer on/off without a page reload.

### Markers

Each `weather_point` renders a custom Leaflet marker containing:
- A **weather icon** (small SVG) derived from the WMO `weather_code`: sun, partly cloudy, cloudy, rain, snow, storm
- **Min/max temperature** below the icon: e.g. `12° / 24°`
- A **wind arrow** SVG rotated to `wind_direction` degrees, with size proportional to `wind_speed`

On hover: tooltip showing the `label` (town name).

All markers belong to a dedicated Leaflet `LayerGroup` that is shown/hidden by the toggle button.

### Data fetching

New public API route: `GET /api/weather-points` — returns all rows from `weather_points`.

Data is fetched once (on first layer activation) and cached in memory for the session. No repeated fetches on toggle off/on.

---

## Setup Script

A one-time script (e.g. `scripts/seed-weather-points.ts`) that:
1. Reads the planned route geometry from the `trips` table
2. Uses PostGIS `ST_LineInterpolatePoints` to sample a point every ~50 km
3. Optionally reverse-geocodes each point to a town name (using a free geocoding API or Open-Meteo's own geocoding endpoint)
4. Inserts rows into `weather_points` with `seq`, `lat`, `lng`, `label`

Run once manually; does not need to be part of the cron.

---

## Key Notes

- Open-Meteo is free, requires no API key, supports batched multi-point requests
- WMO weather codes are a standard integer set; a small lookup table maps them to icon names
- Wind arrow rotation: CSS `transform: rotate(Ndeg)` on the SVG element
- The layer is purely additive — no changes to existing map behaviour
