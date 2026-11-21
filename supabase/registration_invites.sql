-- Registration invites sent from the Spark user list. Run once in Supabase → SQL Editor.
-- Only invited emails can register, using the code they received. The code is kept after
-- registration so it can be shown in the user's profile.
-- Only the server (service role) touches this table; RLS with no policies blocks every other client.

create table if not exists public.registration_invites (
  email         text primary key check (email = lower(email)),
  code          text not null,
  full_name     text,
  invited_by    text,
  sent_at       timestamptz not null default now(),
  registered_at timestamptz
);

alter table public.registration_invites enable row level security;

-- Previous version of the allow-list, no longer used:
-- drop table if exists public.allowed_users;
