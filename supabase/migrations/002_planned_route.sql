-- Planned routes (hand-crafted itineraries shown on the map)
create table if not exists planned_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coordinates jsonb not null default '[]',  -- [[lng, lat], ...]
  color text not null default '#22d3ee',
  created_at timestamptz not null default now()
);

-- Seed: Alaska → Ushuaia (Pan-American Highway)
insert into planned_routes (name, color, coordinates) values (
  'Alaska → Ushuaia',
  '#22d3ee',
  '[
    [-148.35, 70.20],
    [-147.72, 64.84],
    [-135.06, 60.72],
    [-123.12, 49.28],
    [-122.33, 47.61],
    [-122.68, 45.52],
    [-122.42, 37.77],
    [-118.24, 34.05],
    [-117.03, 32.53],
    [-110.97, 29.07],
    [-106.41, 23.23],
    [-99.13, 19.43],
    [-96.73, 17.07],
    [-90.52, 14.64],
    [-89.22, 13.69],
    [-86.29, 12.13],
    [-84.08,  9.93],
    [-79.52,  8.99],
    [-74.08,  4.71],
    [-78.50, -0.23],
    [-77.03, -12.05],
    [-71.54, -16.41],
    [-68.15, -16.50],
    [-65.41, -24.79],
    [-65.21, -26.82],
    [-64.18, -31.42],
    [-68.83, -32.89],
    [-58.38, -34.61],
    [-62.27, -38.72],
    [-71.31, -41.13],
    [-72.94, -41.47],
    [-72.07, -45.57],
    [-72.50, -51.73],
    [-70.91, -53.16],
    [-68.30, -54.80]
  ]'::jsonb
) on conflict do nothing;
