# Spark Free (`apps/free`)

Free plan for companies Spark is courting (first campaign: insurance companies, free until 31/12/2026 to get the instant pay transparency report). **Multi-tenant**: every company is a tenant of this one app and database (`multiTenant: true`, see the root CLAUDE.md "Multi-tenant"). Only the pay transparency module (`@spark/transparency`) plus users, profile and permissions.

## How a company is activated

1. Spark staff (emails in `ADMIN_EMAILS`) log in: with no company picked they see **Aziende**.
2. **Nuova azienda**: company name + first admin (name, email). The server creates the tenant, the admin's user record (level ADMIN), the invite, and emails the registration code.
3. The admin registers at `/registrazione`, logs in (password + email code), uploads the payroll file in Trasparenza retributiva, and can invite colleagues from Lista Utenti (they join the same company).
4. Staff can **Entra** any company for support; the top bar shows which one and switches back.

When a company buys Spark: create `apps/<client>` (root checklist) and move its data out of this database (script to write).

## Deployment (not done yet)

1. New Supabase project (Data API on, auto grants off, RLS on). SQL Editor, in order: `packages/core/supabase/migrations/0001…0003`, then `packages/core/supabase/multi-tenant/0001_tenants.sql`.
2. Authentication → Add user for each staff member (auto-confirm) and list them in `ADMIN_EMAILS`.
3. New Vercel project on the repo, Root Directory `apps/free`, env vars from `.env.example` (secrets Sensitive), domain `free.tryspark.it` (DNS on Vercel).

## Notes

- Payroll files must follow the Spark template (download from the upload screen). The file is read in the browser; only saved analyses go to the database.
- Every tenant's data is mixed in one database: the separation is enforced only by the server (`/api/data`, invites). Mention the shared database in the DPA with free customers.
