alter table trips add column if not exists max_speed_ms float;
alter table trips add column if not exists elev_high float;
-- breaks: array of {lat, lng, duration_min, distance_m} objects
alter table trips add column if not exists breaks jsonb;
