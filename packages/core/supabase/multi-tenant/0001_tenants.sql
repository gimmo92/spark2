-- Multi-tenant mode (SparkConfig.multiTenant): run ONLY on the database of a multi-tenant app
-- (e.g. apps/free), after the core migrations. Several companies ("tenants") share one database:
-- every record and invite carries its tenant, and the server reads and writes only the caller's.
-- Single-tenant client databases must NOT run this file.

-- companies of the shared app, created by Spark staff (ADMIN_EMAILS) from the "Aziende" page
create table if not exists public.tenants (
  id         text primary key,
  name       text not null,
  plan       text not null default 'free',
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.tenants enable row level security;
grant select, insert, update, delete on table public.tenants to service_role;

-- records: same ids may exist in several tenants (users "u1", settings "access", ...)
alter table public.app_data add column if not exists tenant text not null default '';
alter table public.app_data drop constraint if exists app_data_pkey;
alter table public.app_data add primary key (tenant, collection, id);
create index if not exists app_data_tenant_collection on public.app_data (tenant, collection);

-- invites: the tenant the invited person will belong to (an email belongs to one tenant only)
alter table public.registration_invites add column if not exists tenant text not null default '';
