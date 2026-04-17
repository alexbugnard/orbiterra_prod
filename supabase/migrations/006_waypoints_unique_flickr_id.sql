-- Ensure flickr_id is unique so Strava photos can be upserted without duplicates
-- (Strava photo unique_id is stored as "strava_<id>" in this column)
alter table waypoints
  add column if not exists flickr_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waypoints_flickr_id_key'
  ) then
    alter table waypoints add constraint waypoints_flickr_id_key unique (flickr_id);
  end if;
end$$;
