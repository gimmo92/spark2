# Client app: Pellemoda

Spark app for **Pellemoda**. Built on `@spark/core` + `@spark/mbo`; read the root `CLAUDE.md` first (architecture and rules: never edit `packages/*` for this client only).

## Status (2026-11-28)

- App created from `apps/carlo-gavazzi` without its customisations: core screens (users, teams, profile, dashboard, La mia azienda) and the **standard MBO module only** (`createMboModule()`, no options), **no seed data** (clean start). Compensation and Analisi di clima are shown locked.
- Not deployed yet: needs its own Supabase project and Vercel project (see "Deployment").

## Client facts

- Organisation: Pellemoda. Still to collect: legal name, companies, email domains (`org.emailDomains`, placeholder `pellemoda.it`), teams, admins, domain.
- UI language: Italian (default `locale: "it"`).

## Requirements and customisations

Record here every client request, the decision taken, and where it lives (config / client component in this app / generic feature added to a package).

- None yet.

## Deployment

1. New Supabase project (Data API on, "grant API access to new tables automatically" off, "enable RLS automatically" on): run `packages/core/supabase/migrations/*.sql` in order; add the first admin user by hand (Authentication → Add user, auto-confirm).
2. New Vercel project on `gimmo92/spark2`, Root Directory `apps/pellemoda`, env vars from `.env.example` (secrets Sensitive; `ADMIN_EMAILS` = the first admin), domain (e.g. `pellemoda.tryspark.it`).
3. Local dev: `npm run dev:pellemoda` from the repo root, with `.env.local` filled by hand.
