-- Add start coordinates to trips for Americas progress tracking
alter table trips add column if not exists start_lat float;
alter table trips add column if not exists start_lng float;

-- Test rides in Alaska (for progress % development/testing)
insert into trips (strava_id, name, start_date, end_date, distance_m, start_lat, start_lng, visible) values
  (9999999001, 'Prudhoe Bay → Coldfoot', '2026-04-01T08:00:00Z', '2026-04-01T20:00:00Z', 415000, 70.20, -148.35, true),
  (9999999002, 'Coldfoot → Fairbanks',   '2026-04-03T08:00:00Z', '2026-04-03T18:00:00Z', 380000, 67.25, -150.12, true)
on conflict (strava_id) do nothing;
