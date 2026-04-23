-- 1. Remove duplicate cities (keep one row per name+country)
DELETE FROM route_cities
WHERE id NOT IN (
  SELECT DISTINCT ON (name, country) id
  FROM route_cities
  ORDER BY name, country, id
);

-- 2. Remove duplicate POIs (keep one row per name+country)
DELETE FROM route_pois
WHERE id NOT IN (
  SELECT DISTINCT ON (name, country) id
  FROM route_pois
  ORDER BY name, country, id
);

-- 3. Add unique constraints so future inserts can use ON CONFLICT DO NOTHING
ALTER TABLE route_cities ADD CONSTRAINT route_cities_name_country_unique UNIQUE (name, country);
ALTER TABLE route_pois   ADD CONSTRAINT route_pois_name_country_unique   UNIQUE (name, country);
