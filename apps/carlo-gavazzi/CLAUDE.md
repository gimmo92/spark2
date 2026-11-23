# Client app: Carlo Gavazzi Services AG

Spark app for **Carlo Gavazzi Services AG**. Built on `@spark/core` + `@spark/mbo`; read the root `CLAUDE.md` first (architecture and rules: never edit `packages/*` for this client only).

## Status (2026-11-23)

- App created from `apps/demo`: core screens (users, teams, profile, dashboard) and the standard MBO module, **no seed data** (clean start).
- Not deployed yet: needs its own Supabase project and Vercel project (see "Deployment").

## Client facts

- Organisation: Carlo Gavazzi Services AG (single company for now: `companies` in `src/spark.config.ts`).
- To confirm with the owner: employees' email domain (placeholder `carlogavazzi.com`), teams and companies structure, UI language (Italian for now), who the admins are (`ADMIN_EMAILS`), app domain.

## Requirements and customisations

Record here every client request, the decision taken, and where it lives (config / client component in this app / generic feature added to a package).

- _none yet_

## Deployment

1. Supabase: new project for this client → run `packages/core/supabase/migrations/*.sql` in order → Auth: SMTP (SendGrid) and Magic Link template with `{{ .Token }}`; disable public sign-ups.
2. Vercel: new project on repo `gimmo92/spark2`, **Root Directory `apps/carlo-gavazzi`**, env vars from `.env.example` (secrets Sensitive), own `AUTH_SECRET`, `AUTH_ENABLED=true` once the first admin has logged in.
3. Domain: to decide (e.g. `carlogavazzi.tryspark.it`).
