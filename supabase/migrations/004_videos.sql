-- YouTube videos synced from the channel
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text unique not null,
  title text not null,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
