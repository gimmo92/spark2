-- Users allowed to register on Spark. Run once in Supabase → SQL Editor.
-- Only the server (service role) reads this table; RLS with no policies blocks every other client.

create table if not exists public.allowed_users (
  email      text primary key check (email = lower(email)),
  full_name  text,
  company    text,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

-- Load users (emails must be lowercase):
-- insert into public.allowed_users (email, full_name, company) values
--   ('mario.rossi@valmec.it', 'Mario Rossi', 'Valmec S.p.A.'),
--   ('giulia.bianchi@valmec.it', 'Giulia Bianchi', 'Valmec S.p.A.');
