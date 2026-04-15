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
