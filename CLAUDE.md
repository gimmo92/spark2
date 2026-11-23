@AGENTS.md

# Spark — webapp HR / MBO

Admin app for Spark (people, teams, MBO objectives). Demo organisation: **Valmec S.p.A.** Repo: github.com/gimmo92/spark2 (`main`), deployed on Vercel at **app.tryspark.it**, Supabase integrated.

## Working rules (from the owner)

- **Always commit and push to `main` after every finished change**, without asking. Verify first: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- UI copy is **Italian**. Code, comments and commit messages in English.
- **Compact UI**: the owner works on a high-DPI screen at ~1260 CSS px. Small type (13–14px body, 11px uppercase labels), tight paddings. Check layouts at 1260px wide.
- Demo data must be **invented**: Italian names, `nome.cognome@tryspark.co` emails, Valmec companies. Never copy real people from reference screenshots.
- Reference screenshots live in `../references/`.
- Every icon-only action has a `Tooltip` (from `src/components/ui.tsx`), not a native `title`.
- When the owner removes a feature, remove it fully (state, filters, imports), don't hide it.

## Stack

Next.js 16 (App Router, `cacheComponents` on, **`src/proxy.ts` instead of middleware**) · React 19 · Tailwind 4 (tokens in `src/app/globals.css`) · lucide-react · @supabase/ssr + supabase-js. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).

- Pages reading URL params on the client must be wrapped in `<Suspense>` (cacheComponents prerender rule). Static catch-all pages need `generateStaticParams`.
- Shell scripts with long inline Python/heredocs sometimes break on quoting: write the script to a file and run it.

## Data model

Business data lives in `src/lib/store.tsx` (`StoreProvider` / `useStore`) and is **saved on Supabase** in `public.app_data` (`supabase/app_data.sql`: one JSON row per record, key `collection` + `id`; collections users / schede / objectives / presets / workflows / settings). `/api/data` (GET all, POST `{upserts, deletes}`) is behind `requireAdmin()`. The store loads from the DB, then diffs state against the last saved snapshot (`diffById` in `src/lib/sync.ts`, by object reference) and saves changes 500 ms later (and on `pagehide`). If the DB is empty on first load it uploads the browser's data (demo seed). If `/api/data` fails (not logged in, missing table) it falls back to `localStorage` and `AppShell` shows a banner with the reason. Bump the localStorage key version when a data shape changes.

- `src/lib/data.ts` — users, teams ("gruppo"), companies.
- `src/lib/mbo.ts` — objectives catalog (`ObjectiveDef`: levels target→payout, calc `lineare` | `scaglioni`, category = **livello**: Gruppo / Società / Business Unit / Team / Utente, cycle), schede (`Scheda`: multiple assignees, cycle, items with weight and optional per-scheda `levels` override or one-off `custom` objective, optional own `threshold`), presets, `payoutFor`, `schedaScore(catalog, scheda, globalGate)`.
- **Thresholds**: the **global** threshold (Impostazioni → MBO, `mboSettings.globalThresholdId/Actual`) applies to every scheda; a scheda can add its **own** threshold in its advanced options. Payout is 0 if either is measured and missed.
- `src/lib/forecast.ts` — what-if engine for MBO → Forecast (scenario base min/target/max/actual, per-objective estimates, bonus at target).

## Sections

- La mia azienda → Lista Utenti (invite icon), user profile (registration card), Lista Team.
- MBO → Schede obiettivo (list + full-page editor `/mbo/schede/[id]`), Obiettivi (catalog list + editor with per-scheda assignment, weight and levels), Workflow (list + editor `/mbo/workflow/[id]`: ordered tasks Definizione / Approvazione / Consuntivazione obiettivi / Invio e firma lettera, each with owner role, due date, reminder and type-specific settings; model in `src/lib/workflow.ts`), Forecast.
- Dashboard → tabs Generale / MBO (analytics; charts follow the dataviz skill: single hue for magnitude, validated categorical slots for levels).
- Impostazioni → tab MBO: global threshold objective, target/payout presets.

## Authentication (Supabase)

- Login = **email + password, then a 6-digit code by email**, both enforced server-side: `/api/auth/login` checks the password with a cookie-less client and sends the OTP (`shouldCreateUser:false`); `/api/auth/verify` checks the code, opens the session and sets the signed `spark_2fa` cookie (`src/lib/auth/twofa.ts`, HMAC with `AUTH_SECRET`). `src/proxy.ts` requires session **and** `spark_2fa` for the same user.
- **No self sign-up.** Registration (`/registrazione`) needs the invite code sent from the user list (letter icon → `/api/invites` → SendGrid API). Table `public.registration_invites` (`supabase/registration_invites.sql`); the code stays visible in the user profile after registration.
- Gate is opt-in: `AUTH_ENABLED=true` on Vercel. Env vars documented in `.env.example`.
- Privileged routes use `requireAdmin()` (full login + optional `ADMIN_EMAILS`).
- Setup errors are self-describing: `/api/auth/login` and `/api/auth/register` return `{error:"config", missing:[...]}` with the names (never values) of what's missing; the login page shows them.

## Production setup status (as of 2026-11-22)

Done by the owner:
- Supabase project `lgfzzdgpviorwdzxmqkt` (URL is public). `registration_invites.sql` run. Custom SMTP = SendGrid (`smtp.sendgrid.net:587`, user `apikey`), needed before Supabase lets you edit email templates. Magic Link template must contain `{{ .Token }}` (it is the login-code email).
- Vercel env vars set; secrets (`AUTH_SECRET`, `SENDGRID_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) marked Sensitive, so `vercel env pull` won't fetch them: put them in `.env.local` by hand for local dev.
- Server-side auth config verified live (`/api/auth/login` answers `credentials` to a fake login).

Pending / to check:
- Grant on `registration_invites` run (verified 2026-11-23). New Supabase projects don't grant API roles on SQL-created tables (error `42501`): every SQL file includes its `grant ... to service_role`.
- Run `supabase/app_data.sql` in production (needed for data saving).
- First real login with password + code, a test invite to a real address, then `AUTH_ENABLED=true` + Redeploy.
- Email sender is `noreply@tryspark.co` (domain authenticated in SendGrid). Switching to `@tryspark.it` needs SendGrid domain auth for tryspark.it + update Supabase SMTP sender and `SENDGRID_FROM`.

## Domains and email

- `tryspark.co`: Google Workspace mail (owner `gbasso@tryspark.co`), DNS at dnshigh.
- `tryspark.it`: DNS managed by **Vercel** (app at `app.tryspark.it`). Added to Google Workspace as secondary domain; MX `smtp.google.com`, SPF `include:_spf.google.com`, Google verification TXT. `info@tryspark.it` is an alias of `gbasso@tryspark.co` (mail sent from the owner's own account to the alias doesn't show in the inbox: test from an external address).

## Next steps / open points

- Link workflows to schede (which workflow a scheda follows, current task, notifications).
- Link the user list to real accounts (today invites from demo rows would email invented addresses); optionally move `app_data` to proper relational tables.
- Optional: lock out after N wrong login codes (needs a small table).
