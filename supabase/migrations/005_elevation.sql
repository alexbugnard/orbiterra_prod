-- Store elevation profile data (array of [distanceMeters, altitudeMeters] pairs)
alter table trips add column if not exists elevation jsonb;
