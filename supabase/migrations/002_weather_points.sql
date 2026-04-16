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
