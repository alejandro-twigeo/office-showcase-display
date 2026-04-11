create table if not exists public.youtube_search_cache (
  normalized_query text primary key,
  results jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table if not exists public.youtube_search_usage (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  search_date date not null default current_date,
  search_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youtube_search_usage_device_date_key unique (device_id, search_date)
);

create index if not exists youtube_search_cache_expires_at_idx
  on public.youtube_search_cache (expires_at);

create index if not exists youtube_search_usage_search_date_idx
  on public.youtube_search_usage (search_date);

alter table public.youtube_search_cache enable row level security;
alter table public.youtube_search_usage enable row level security;
