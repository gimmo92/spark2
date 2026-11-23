# Client app: Carlo Gavazzi Services AG

Spark app for **Carlo Gavazzi Services AG**. Built on `@spark/core` + `@spark/mbo`; read the root `CLAUDE.md` first (architecture and rules: never edit `packages/*` for this client only).

## Status (2026-11-23)

- App created from `apps/demo`: core screens (users, teams, profile, dashboard) and the standard MBO module, **no seed data** (clean start).
- Not deployed yet: needs its own Supabase project and Vercel project (see "Deployment").

## Client facts

- Organisation: Carlo Gavazzi Services AG, the group company of the same name: the only company for now.
- Email: employees use **several domains** (one per business unit, e.g. `gavazzicbu.it`): list them in `org.emailDomains` (the first is used for suggestions).
- UI language: Italian is fine for this client (the core will become multilingual: it / fr / en / de / es).
- Admin: only one, on our side: **`testcg@tryspark.co`** (`ADMIN_EMAILS=testcg@tryspark.co`). No client-side admins for now.
- Domain: **`carlogavazzi.tryspark.it`**.
- Still to collect: teams.

## Requirements and customisations

Record here every client request, the decision taken, and where it lives (config / client component in this app / generic feature added to a package).

- _none yet_

## Deployment

1. Supabase: new project for this client (Data API **on**, auto-grant API access **off** — our SQL grants `service_role` explicitly —, auto RLS **on**) → run `packages/core/supabase/migrations/*.sql` in order (done 2026-11-23). Nothing else in Supabase: emails and access rules are handled by the core.
2. Vercel: new project on repo `gimmo92/spark2`, **Root Directory `apps/carlo-gavazzi`**, env vars from `.env.example` (secrets Sensitive), own `AUTH_SECRET`, `ADMIN_EMAILS=testcg@tryspark.co`, `AUTH_ENABLED=true` once the first admin has logged in.
3. First admin: Supabase → Authentication → Users → Add user → `testcg@tryspark.co` + password, "Auto Confirm User" on (registration is invite-only, so the first account is created by hand). The mailbox must exist (alias on Google Workspace) to receive login codes.
4. Domain: `carlogavazzi.tryspark.it` (Vercel project → Domains; DNS of tryspark.it is on Vercel).
