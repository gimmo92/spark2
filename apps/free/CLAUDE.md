# Spark Free (`apps/free`)

Free plan for companies Spark is courting (first campaign: insurance companies, free until 31/12/2026; goal of the trial: collect data for the benchmarks). **Multi-tenant**: every company is a tenant of this one app and database (`multiTenant: true`, see the root CLAUDE.md "Multi-tenant"). A new company gets the Compensation module (`@spark/transparency`: Caricamento dati, Trasparenza salariale, Job grading, Benchmarks, Salary bands, Minimi CCNL) plus La mia azienda (core), profile and permissions (`tenantModules: ["transparency"]`); MBO is built in and staff can switch it on per company in the Spark panel. Everything else is shown locked in the menu (`lockedHint`). No "Stai lavorando su X" bar (`tenantBar: false`).

## Status (2026-11-28)

- Live at **free.tryspark.it** (own Supabase project with core migrations 0001–0003 + `multi-tenant/0001_tenants.sql`, own Vercel project with Root Directory `apps/free`).
- First tenant: **Insoore** (insurtech; data with an insurance company on CCNL ANIA and a tech company on Metalmeccanico / Federmanager).
- Env vars: Supabase (URL, anon key, service role key), `AUTH_SECRET`, SendGrid, `ADMIN_EMAILS` (= Spark staff here; `SPARK_STAFF_EMAILS` not needed), **`ANTHROPIC_API_KEY`** (AI features, set on Production; demo project: not set yet).

## How a company is activated

1. Spark staff (emails in `ADMIN_EMAILS`) log in: with no company picked they see the **Pannello Spark** (installation modules and their menu entries + companies). Company pages opened without a company ask to pick one ("Scegli l'azienda").
2. **Nuova azienda**: company name + first admin (name, email). The server creates the tenant, the admin's user record (level ADMIN), the invite, and emails the registration code. Modules and single menu entries per company from the companies table ("Voci di menu").
3. The admin registers at `/registrazione`, logs in (password + email code), uploads the payroll file in **Compensation → Caricamento dati**, and can invite colleagues from Lista Utenti (they join the same company). The company sector goes in La mia azienda → Modifica azienda (used by the benchmarks).
4. Staff can **Entra** any company for support and go back to the panel from the menu.

When a company buys Spark: create `apps/<client>` (root checklist) and move its data out of this database (script to write).

## Notes

- Payroll files must follow the Spark template (download from Caricamento dati). The file is read in the browser; only saved data goes to the database.
- Every tenant's data is mixed in one database: the separation is enforced only by the server (`/api/data`, invites). Mention the shared database and Anthropic (AI features) in the DPA with free customers.
