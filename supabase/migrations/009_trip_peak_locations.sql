alter table trips add column if not exists max_speed_lat float;
alter table trips add column if not exists max_speed_lng float;
alter table trips add column if not exists elev_high_lat float;
alter table trips add column if not exists elev_high_lng float;
