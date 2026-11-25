@AGENTS.md

# Spark — core + client apps (FDE)

Spark is **not a multi-tenant SaaS**. The owner works Forward-Deployed: a shared **core** (auth, security, data store, shell, base UI, people) plus **one app per client** where that client's features and workflows are built, because clients ask for extreme customisations. Everything stays on the owner's accounts (GitHub `gimmo92/spark2`, Vercel, Supabase), so it's a single **monorepo** (npm workspaces).

```
packages/core   @spark/core  auth (password + email code), proxy gate, /api routes, data store, shell, UI kit, users/teams/invites
packages/mbo    @spark/mbo   standard MBO module (schede, obiettivi, preset, workflow, forecast, MBO dashboard/settings)
apps/demo       @spark/demo  demo client Valmec S.p.A. → app.tryspark.it (Vercel Root Directory = apps/demo)
apps/carlo-gavazzi  @spark/carlo-gavazzi  client Carlo Gavazzi Services AG (see its CLAUDE.md; not deployed yet)
apps/<client>   one Next.js app per client (own Vercel project, own Supabase project)
```

## Rules of the architecture

- **Client code never edits `packages/*`.** Client apps import from `@spark/core` / `@spark/mbo`. If a client need is useful to everyone, build it in the core/module first (generic, configurable), then use it in the client app.
- No client-specific logic, names or data in packages. Organisation, menu, tabs, modules, seed data come from the app's `src/spark.config.ts` (`SparkConfig` in `packages/core/src/config.ts`).
- One Supabase + one Vercel project per client: data never mixed, no tenant ids.
- Changes to a package affect every client app: run lint/typecheck/build for all apps before pushing.

## Working rules (from the owner)

- **Always commit and push to `main` after every finished change**, without asking. Verify first from the repo root: `npm run lint`, `npm run typecheck`, `npm run build` (builds every app).
- UI copy is written in **Italian** and translated (IT / EN, see "Languages"). Code, comments and commit messages in English.
- **Compact UI**: the owner works on a high-DPI screen at ~1260 CSS px. Small type (13–14px body, 11px uppercase labels), tight paddings.
- Demo data must be **invented**: Italian names, `nome.cognome@tryspark.co` emails, Valmec companies. Never copy real people from reference screenshots (`../references/`).
- Every icon-only action has a `Tooltip` (core `ui.tsx`), not a native `title`.
- When the owner removes a feature, remove it fully (state, filters, imports), don't hide it.

## Stack and monorepo mechanics

Next.js 16 (App Router, `cacheComponents` on, **`src/proxy.ts` instead of middleware**) · React 19 · Tailwind 4 · lucide-react · @supabase/ssr + supabase-js. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).

- Packages are TypeScript source (no build step): each app lists them in `transpilePackages` and sets `turbopack.root` to the repo root (`apps/demo/next.config.ts`).
- Package entry points: `@spark/core` (client-safe barrel `src/index.ts`), `@spark/core/server` (server-only: `requireAdmin`, admin client, SendGrid, `proxy`), `@spark/core/routes/<name>` (route handlers), `@spark/mbo`. Inside a package use relative imports; `@/` is the app's own `src/`.
- Styles: theme tokens and shared classes in `packages/core/src/styles.css`; the app's `globals.css` imports it and declares `@source "../../../../packages"` so Tailwind sees package classes.
- App route files are thin: pages render package components, API routes re-export core handlers (`export { POST } from "@spark/core/routes/login"`; data: `createDataRoute(config)`). A client overrides a screen by rendering its own component in that route.
- The config holds functions/icons, so it reaches the client through `src/app/(app)/Providers.tsx` (client component → `AppShell config={config}`).
- Pages reading URL params on the client need `<Suspense>`; static catch-alls need `generateStaticParams`.
- Shell scripts with long inline Python/heredocs sometimes break on quoting: write the script to a file and run it.

## Data

- `DataProvider` (core) keeps every collection (`users`, `settings` + each module's `collections`) and saves to Supabase `public.app_data` (one JSON row per record, key `collection` + `id`) via `/api/data`, behind `requireAdmin()`. It diffs state against the last saved snapshot by object reference (`diffById`) and saves 500 ms after an edit (and on `pagehide`). Empty DB on first load → uploads the app's `seed()`. If `/api/data` fails (not logged in, missing table) it falls back to `localStorage` (prefix `storagePrefix`, default `spark.v5`) and the shell shows a banner with the reason.
- Client-specific user fields: `SparkConfig.userFields` (key, label, number/text) are shown in the user form and stored in `User.extra[key]` (e.g. Gavazzi target bonus).
- Hooks: `useCollection<T>(name)`, `useSettings<T>(docId, defaults)` (docs in `settings`), `useCore()` (users, invites, toasts, data status), `useOrg()` (companies, teams, `companyForTeam`, email domain; companies are edited in La mia azienda → Lista Società with permission `companies.manage`, saved in settings doc `org`, falling back to `OrgConfig.companies` until the first change; renaming updates the users, a company in use cannot be deleted; the user form picks the company), `useMbo()` (module state + users/notify/hydrated).
- `config.migrate(collection, items)` upgrades records saved with an old shape (demo: old team names).
- MBO model (`packages/mbo/src/lib`): objectives catalog (levels target→payout, `lineare` | `scaglioni`, category = **livello** Gruppo/Società/Business Unit/Team/Utente, cycle), schede (multiple assignees, items with weight, per-scheda `levels` override or `custom` objective, optional own threshold), presets, workflows (tasks Definizione / Approvazione / Consuntivazione / Invio e firma lettera), forecast engine. **Global threshold** (settings doc `mbo`) applies to every scheda; a scheda may add its own. Payout 0 if either is measured and missed.
- "Progetto" objectives: activities each measured On/Off, 0-100 % or KPI (unit + target = 100 %), optionally with the objective's weight distributed over them (`weightedActivities`, weights sum to 100). Measures store `done` (on/off ids) + `values` (per activity); `projectActual` = weighted completion %. Option `createMboModule({ activityLevels: true })` (on in Carlo Gavazzi): a project may give each activity its own target → payout levels (`ObjectiveDef.activityLevels`); then `actual` = weighted sum of activity payouts and `payoutFor` returns it as is (no objective-level or per-scheda levels). Module options reach components via `SparkModule.options` / `useMboOptions()`.
- Options `bonusOf(user)` / `bonusCurrencyOf(user)` (Carlo Gavazzi: user fields `bonusTarget` / `bonusCurrency`): the forecast's on-target budget is the sum of the assignees' own bonuses (scenario default for whoever has none, per-scheda override still possible), shown in their currency when everyone in scope shares it. In the forecast, % levels are shown and estimated in values (`forecastDef`: on the objective's last-year actual or a scheda's) and each estimate is moved to every scheda's own target in proportion.
- Option `createMboModule({ relativeLevels: true })` (on in Carlo Gavazzi): quantitative objectives and target/payout presets always use the "Calcolato su" levels editor (no toggle): the target (payout editable, default 100%) is a % of last year's actual or a fixed value; every other level is a % of last year, a % of the target or a fixed value (`ObjectiveDef.relative` / `Preset.relative`, e.g. min 90% PY, target 108% PY, 110…118% of the target). Old plain levels open as fixed values (`toRelative`). The objective may store last year in `ObjectiveDef.lastYear` (asked on the objective page; default of every scheda) and each scheda item may override it in `SchedaItem.base`; a scheda item may also have its own % scale (`SchedaItem.relative`, edited in Modifica obiettivo → assegnazione alle schede, used by `itemDef`) (always asked with the option, except on/off and date objectives; required only when some level uses it, `needsBase`; set in the scheda or in the objective's assignments); `itemDef` turns the scale into absolute `levels` (none without a base → payout 0). The catalog's own `levels` are the scale on a base of 100; fixed values mixed with % of last year (`mixedScale`) are order-checked per scheda. Presets needing last year are offered only on quantitative objectives. The Gavazzi Incentive Plan sheet shows each level's defined % in the % column.
- Objectives created inside a scheda are catalog objectives like any other: saving the scheda moves `item.custom` to the catalog (`catalogItems`, id `ob-<custom id>`), and `useCatalogCustomObjectives()` (Obiettivi / Schede lists) upgrades schede saved before. Users without `mbo.catalog.manage` keep them one-off. Not moved (one objective per name): a catalog objective personalized for one scheda (`custom.originId`, set by "Personalizza per questa scheda") stays a copy in the scheda, and a new one-off named like an existing catalog objective of the same cycle becomes its personalized copy. `schedeUsing` and the Misura modal count personalized copies under their catalog objective; Misura uses `itemDef` (per-scheda levels, last year's actual).
- SQL migrations: `packages/core/supabase/migrations/*.sql` (run in order on every client database; each grants `service_role`). Client-only tables go in `apps/<client>/supabase/migrations/`.

## Languages (core i18n)

- Every UI string goes through `tr("Testo italiano")` (`@spark/core`, `packages/core/src/i18n/i18n.ts`): the Italian text is the key, missing translations fall back to Italian. Placeholders: `tr("{0} utenti attivi", [n])`. Constants (labels in arrays, permission catalog, statuses) stay Italian in code and are translated where rendered (`tr(x.label)`); core UI kit components (Field, Tooltip, Modal, FilterMenu, Switch, MultiSelect, nav, tabs) translate their string props themselves.
- Dictionaries (`EN`, keyed by Italian): core `packages/core/src/i18n/en.ts`, MBO `packages/mbo/src/i18n/en.ts` (via `SparkModule.messages`), client `apps/<app>/src/i18n/en.ts` (via `SparkConfig.messages`; may also reword core copy). The module dictionary is merged over the core one: never give a shared key a different translation.
- **When adding UI text**: wrap it in `tr()`, add the English to the right dictionary, run `npm run i18n:check` (missing keys / conflicts).
- Language: `IT | EN` switch in the sidebar footer and on login screens, saved per browser (`localStorage spark.locale`); default `SparkConfig.locale` ("it"). `LocaleProvider` (inside the data store) remounts the UI on switch. Dates/numbers use `localeTag()`.
- Stay Italian: letter templates and generated letters (content), emails sent by the server, page `<title>` metadata, user data (objective names, roles, teams). The Gavazzi Incentive Plan sheet keeps its Excel labels in English in both languages.

## Authentication (core)

**All of authentication lives in the core; a client Supabase project only provides users and tables** (no SMTP, no email templates, no auth settings to touch).

- Login = **email + password, then a 6-digit code by email**, both enforced server-side: `routes/login` checks the password with a cookie-less client, checks `hasSparkAccess`, generates the code with `auth.admin.generateLink({type:"magiclink"})` (Supabase sends nothing) and emails it with SendGrid; `routes/verify` checks it (`verifyOtp type "email"`) and sets the signed `spark_2fa` cookie (HMAC, `AUTH_SECRET`). The proxy requires session **and** `spark_2fa` for the same user.
- **Who may log in** (`src/auth/access.ts`): accounts created by Spark's registration (`app_metadata.spark_access`), emails in `ADMIN_EMAILS`, or invites already registered. A sign-up made directly against Supabase's API is refused, so public sign-ups don't need to be disabled per project.
- **No self sign-up**: `/registrazione` needs the invite code sent from the user list (letter icon → `/api/invites`). The first admin is created by hand (Supabase → Authentication → Add user, auto-confirm) and listed in `ADMIN_EMAILS`.
- Password reset: `routes/reset` → `generateLink({type:"recovery"})` → SendGrid link to `/auth/confirm?token_hash=…&type=recovery` → `/auth/update-password`. Always answers ok (no account enumeration).
- Emails (invite, login code, reset) share one template in `src/email/sendgrid.ts`.
- Login gate is always on (no page is visible without login); `AUTH_ENABLED=false` switches it off, and local dev without Supabase keys runs ungated. Env vars in `apps/<app>/.env.example`. Setup errors are self-describing (`{error:"config", missing:[...]}`, names only).

## Access levels and permissions (core)

- Code: `packages/core/src/access/` (`permissions.ts` model, `useAccess()` hook, `AccessSettings` panel at Impostazioni → Permessi, route `apps/<app>/src/app/(app)/impostazioni/permessi`).
- Catalog = core (`CORE_PERMISSIONS`) + modules (`SparkModule.permissions`, e.g. `MBO_PERMISSIONS`) + client (`SparkConfig.permissions`). Permission ids are stored in levels: never rename them.
- A permission is on/off or scoped: `self` / `direct` (riporti diretti) / `reports` (riporti a cascata, via `User.managerId` = "Responsabile"; id kept from when it was the only reports scope) / `team` / `bu` (team → `OrgConfig.teams[].bu`, BUs in `OrgConfig.businessUnits`, page La mia azienda → Business Unit) / `company` (`User.company`) / `all`. Grants are stored as `"id"` or `"id:scope"`.
- Levels in settings doc `"access"`. Built-in ADMIN (always everything, locked), MANAGER (self + team + reports), UTENTE (self only); clients create custom levels ("parti dai permessi di …"). Permissions added later get their defaults automatically (`known` list per level).
- Check with `can(user, "mbo.schede.view", targetUser)`; without target = "has it for some scope" (menus).
- **Who is logged in**: the server matches the login email to the `users` record (`loadViewer`, `packages/core/src/auth/viewer.ts`). Admins = `ADMIN_EMAILS` or level ADMIN (with no ADMIN_EMAILS and no users yet, the first login is admin). A login with no matching active user gets nothing (`unlinked` banner).
- **Enforced on the server** (`/api/data`): GET returns only readable records, POST applies only permitted changes and returns `rejected` (toast in the UI). Rules: `access/rules.ts` (core: users; settings docs readable by all, writable per `settingsAccess`) + `SparkModule.access` (MBO: schede owned by `assigneeIds`; catalog/presets/workflows readable by all, writable with the manage permission). A module collection without rules is admin-only. Only admins can create/modify ADMIN users or seed an empty DB; non-admins don't push `migrate()` upgrades. Invites (`/api/invites`) need `people.create`.
- **In the UI** (only hides; the server decides): `useAccess().allowed(perm, target)`, `canEditUser`, MBO `canCreateScheda` / `canEditScheda`; menu entries and tabs carry `permission` in the app config; `RouteGuard` (in AppShell) blocks pages the user can't open and moves home/section roots to the first allowed page.
- **Coarse spot**: on the server any of `mbo.schede.edit / goals.edit / results.edit / approve` lets a user save the whole scheda; the editor doesn't yet split goals vs results vs status per permission.

## Letters (core, Azienda → Gestione Lettere)

- Code: `packages/core/src/letters/` (`data.ts` model + core variables, `pdf.ts` renderer, `LettersPage.tsx`), route `apps/<app>/src/app/(app)/azienda/lettere`, permission `letters.manage` (collection `letters`, readable/writable only with it).
- A template = letterhead PDF (first page + optional "next pages", stored as data: URL ≤ 1.5 MB or a `/public` path) + text with `{{variables}}`, `**bold**`, blank line = paragraph; table variables sit on their own line. Margins (mm) define the text area inside the letterhead.
- PDF is generated in the browser with `pdf-lib` (standard Helvetica: WinAnsi only, unsupported chars are substituted). Long tables continue on the next page with the header repeated.
- Variables: core (person, organisation, date) + `SparkModule.letters` (MBO: `packages/mbo/src/lib/letters.ts`, uses the person's latest non-archived scheda) + `SparkConfig.letters` for client-specific ones.
- Workflow "lettera" steps store the template id (`WorkflowTask.letterTemplate`). Demo: 3 templates + invented Valmec letterhead (`apps/demo/public/letterhead-valmec*.pdf`, seed `seed/letters.ts`); an existing DB gets them via "Carica i modelli di esempio".
- Not yet: sending/signing letters, bulk generation from schede, client fonts.

## New client app (checklist)

1. Copy `apps/demo` to `apps/<client>`; set `"name": "@spark/<client>"`; delete `src/seed/` and the `seed`/`migrate` entries (or write the client's own demo seed); edit `src/spark.config.ts` (org, nav, tabs, modules); keep or drop module routes accordingly.
2. New Supabase project (Data API on, "grant API access to new tables automatically" off, "enable RLS automatically" on): run core migrations, add the first admin user (auto-confirm). Nothing else in Supabase: emails and access rules are handled by the core.
3. New Vercel project on the same repo, Root Directory `apps/<client>`, env vars from `.env.example` (secrets Sensitive), domain.
4. Write `apps/<client>/CLAUDE.md`: who the client is, their processes, specs, what was customised and why.

## Demo deployment status (app.tryspark.it, as of 2026-11-23)

- Supabase project `lgfzzdgpviorwdzxmqkt`; migrations 0001 and 0002 run (2026-11-23). Supabase SMTP is no longer used (the core sends the emails). Vercel secrets marked Sensitive (`vercel env pull` won't fetch them: put them in `.env.local` by hand).
- Root Directory `apps/demo` set. Pending: `ADMIN_EMAILS` must list the owner's login email (manually created accounts can log in only if listed); first real login, test invite.
- Email sender `noreply@tryspark.co`. Switching to `@tryspark.it` needs SendGrid domain auth + Supabase SMTP sender + `SENDGRID_FROM`.

## Domains and email

- `tryspark.co`: Google Workspace mail (owner `gbasso@tryspark.co`), DNS at dnshigh.
- `tryspark.it`: DNS on **Vercel** (app at `app.tryspark.it`), Google Workspace secondary domain. `info@tryspark.it` is an alias of `gbasso@tryspark.co` (test from an external address).

## Next steps / open points

- More languages (fr / de / es): add the locale to `LOCALES` and a dictionary per package; later save the language on the user record; translate emails and page titles. (IT / EN done 2026-11-24.)
- Scheda editor: split editing by permission (goals / results / status-approval), not only all-or-nothing.
- Extension points in modules (e.g. client-defined workflow task types), a `new-client` script, link workflows to schede.
- Link the user list to real accounts; move `app_data` to relational tables per module when a client needs it.
- Optional: lock out after N wrong login codes.
