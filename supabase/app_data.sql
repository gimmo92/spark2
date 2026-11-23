-- App data (users list, schede, objectives, presets, workflows, MBO settings). Run once in
-- Supabase → SQL Editor. Each row is one record stored as JSON, grouped by collection.
-- Only the server (service role, behind the full login) reads and writes it; RLS with no
-- policies blocks every other client.

create table if not exists public.app_data (
  collection text not null check (collection in ('users', 'schede', 'objectives', 'presets', 'workflows', 'settings')),
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (collection, id)
);

alter table public.app_data enable row level security;

grant select, insert, update, delete on table public.app_data to service_role;
