-- Target audience tags catalog + per-panel tags

create table if not exists public.target_audience_tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

alter table public.panels
  add column if not exists target_audience_tags jsonb not null default '[]';

alter table public.target_audience_tags enable row level security;

create policy target_audience_tags_admin_all on public.target_audience_tags
  for all using (public.is_admin()) with check (public.is_admin());

