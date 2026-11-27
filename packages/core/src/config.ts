import type { LucideIcon } from "lucide-react";
import { CORE_PERMISSIONS, type PermissionDef } from "./access/permissions";
import type { CollectionAccess, SettingsAccess } from "./access/rules";
import type { LetterSource } from "./letters/data";
import type { Locale, Messages } from "./i18n/i18n";

/** Every stored record has a string id. */
export type Doc = { id: string };

/**
 * `permission`: shown only to users who have it (for at least one scope).
 * `locked`: a feature the app doesn't include (e.g. the free plan): shown greyed out with a lock and
 * `SparkConfig.lockedHint` as tooltip, never a link nor a reachable page (a locked group doesn't open).
 */
/** `module`: id of the SparkModule the entry belongs to; locked automatically when that module is off. */
export type NavLeaf = { label: string; href: string; badge?: string; permission?: string; locked?: boolean; module?: string };
export type NavItem =
  | { label: string; href: string; icon: LucideIcon; muted?: boolean; permission?: string; locked?: boolean; module?: string }
  | { id: string; label: string; icon: LucideIcon; children: NavLeaf[]; locked?: boolean; module?: string };

export interface Tab {
  label: string;
  href: string;
  /** Active only on this exact path (default: any path starting with href). */
  exact?: boolean;
  /** Shown only to users who have it. */
  permission?: string;
  /** SparkModule the tab belongs to: hidden (and its page blocked) when that module is off. */
  module?: string;
  /** Set by `applyModules`: the tab's module is off. */
  locked?: boolean;
}

/** A feature module (e.g. @spark/mbo). Client-specific modules use the same shape. */
export interface SparkModule {
  id: string;
  /** Name shown in the Spark control panel (Italian, translated with tr()). */
  label?: string;
  /** Data collections the module saves (rows of public.app_data). */
  collections: string[];
  /** Permissions the module adds to Impostazioni → Permessi. */
  permissions?: PermissionDef[];
  /** Read/write rules of the module's collections, enforced by /api/data. A collection without rules is admin-only. */
  access?: Record<string, CollectionAccess>;
  /** Settings documents the module owns → permissions that may change them. */
  settingsAccess?: SettingsAccess;
  /** Variables the module adds to letters (Gestione Lettere). */
  letters?: LetterSource;
  /** Per-client switches of the module, set by the client app (e.g. `createMboModule({ ... })`). */
  options?: Record<string, unknown>;
  /** Translations of the module's UI copy (keyed by the Italian text). */
  messages?: Messages;
}

export interface OrgConfig {
  /** Organisation name shown in the shell. */
  name: string;
  /** Employees' email domains. The first one is used to suggest nome.cognome@domain for new users. */
  emailDomains: string[];
  companies: string[];
  /** Business units: a group of teams, inside one company (or across companies when `company` is omitted). */
  businessUnits?: { name: string; company?: string }[];
  /** `bu`: the business unit the team belongs to (used by the "BU" permission scope). */
  teams: { name: string; company: string; bu?: string }[];
}

/** An extra field of the user form, declared by the client app. */
export interface UserField {
  /** Key in `User.extra`: never rename (stored data). */
  key: string;
  label: string;
  type?: "text" | "number";
  placeholder?: string;
  /** Short text shown inside the input on the right (unit, currency…). */
  suffix?: string;
  /** Uppercase the text as it's typed (codes like currencies). */
  upper?: boolean;
  maxLength?: number;
}

/** Business unit of a team, from the organisation config. */
export const buOfTeam = (org: Pick<OrgConfig, "teams"> | undefined) => (team: string) => org?.teams.find((t) => t.name === team)?.bu;

/**
 * One per client app (apps/<client>/src/spark.config.ts). The core reads everything
 * client-specific from here: organisation, menu, tabs, modules, demo data.
 */
export interface SparkConfig {
  appName: string;
  org: OrgConfig;
  modules: SparkModule[];
  nav: NavItem[];
  dashboardTabs: Tab[];
  settingsTabs: Tab[];
  /** Where "/" sends the user. */
  home: string;
  /** Initial data: used before the first save and uploaded to an empty database. Omit for a clean start. */
  seed?: () => Partial<Record<string, Doc[]>>;
  /** Upgrade records saved with an older shape. Return the same array when nothing changes. */
  migrate?: (collection: string, items: Doc[]) => Doc[];
  /** Client-specific permissions, added to the core and module ones. */
  permissions?: PermissionDef[];
  /** Client-specific letter variables, added to the core and module ones. */
  letters?: LetterSource;
  /** Client-specific fields of the user form (stored in `User.extra`), e.g. a target bonus. */
  userFields?: UserField[];
  /** Language of the UI until the user picks one (default "it"). */
  locale?: Locale;
  /** Client-specific translations (keyed by the Italian text); may also reword core/module copy. */
  messages?: Messages;
  /**
   * Several companies (tenants) share this app and its database (e.g. the free plan). Needs
   * `supabase/multi-tenant/*.sql` on the database. Spark staff (ADMIN_EMAILS) create tenants and pick
   * the one to work on; everybody else only ever sees the tenant they were invited to.
   */
  multiTenant?: boolean;
  /**
   * Multi-tenant apps: modules a company gets until Spark staff choose its modules in the Spark
   * panel (default: every module on in the installation).
   */
  tenantModules?: string[];
  /** Multi-tenant apps: the "Stai lavorando su X · Cambia azienda" bar shown to staff above every page (default true). */
  tenantBar?: boolean;
  /** Tooltip of the `locked` menu entries (default "Non incluso nel tuo piano"). Italian, translated with tr(). */
  lockedHint?: string;
  /** localStorage key prefix for the browser-only fallback. */
  storagePrefix?: string;
}

/**
 * Modules on for the caller. `installation`: modules switched on for the whole installation (Spark
 * panel; undefined = all of `config.modules`). `tenant` (multi-tenant apps): modules of the caller's
 * company (undefined = `config.tenantModules`, else the installation's).
 */
export function enabledModules(config: Pick<SparkConfig, "modules" | "multiTenant" | "tenantModules">, installation?: string[], tenant?: string[]) {
  const all = config.modules.map((m) => m.id);
  const inst = installation ?? all;
  const own = config.multiTenant ? (tenant ?? config.tenantModules ?? inst) : inst;
  return all.filter((id) => inst.includes(id) && own.includes(id));
}

/**
 * The config as seen by a caller with only `enabled` modules: other modules are dropped (their
 * permissions, letter variables, collections) and their menu entries and tabs are locked.
 */
export function applyModules(config: SparkConfig, enabled: string[], hidden: string[] = []): SparkConfig {
  const off = (m?: string, href?: string) => (!!m && !enabled.includes(m)) || (!!href && hidden.includes(href));
  return {
    ...config,
    modules: config.modules.filter((m) => enabled.includes(m.id)),
    nav: config.nav.map((i) =>
      off(i.module, "href" in i ? i.href : undefined)
        ? { ...i, locked: true }
        : "children" in i
          ? { ...i, children: i.children.map((c) => (off(c.module, c.href) ? { ...c, locked: true } : c)) }
          : i,
    ),
    dashboardTabs: config.dashboardTabs.map((t) => (off(t.module, t.href) ? { ...t, locked: true } : t)),
    settingsTabs: config.settingsTabs.map((t) => (off(t.module, t.href) ? { ...t, locked: true } : t)),
  };
}

/** Menu entries of the modules (label, href, module), switchable one by one in the Spark panel. */
export function moduleFeatures(config: Pick<SparkConfig, "nav" | "dashboardTabs" | "settingsTabs">) {
  const out: { module: string; href: string; label: string; group?: string }[] = [];
  for (const i of config.nav) {
    if ("children" in i) {
      for (const c of i.children) {
        const m = c.module ?? i.module;
        if (m) out.push({ module: m, href: c.href, label: c.label, group: i.label });
      }
    } else if (i.module) out.push({ module: i.module, href: i.href, label: i.label });
  }
  for (const t of [...config.dashboardTabs, ...config.settingsTabs]) if (t.module) out.push({ module: t.module, href: t.href, label: t.label });
  return out;
}

/** Collections owned by the core. */
export const CORE_COLLECTIONS = ["users", "settings", "letters"] as const;

export const collectionsOf = (c: Pick<SparkConfig, "modules">) => [...CORE_COLLECTIONS, ...c.modules.flatMap((m) => m.collections)];

/** Full permission catalog of an app: core, then modules, then client-specific. */
export const permissionsOf = (c: Pick<SparkConfig, "modules" | "permissions">) => [
  ...CORE_PERMISSIONS,
  ...c.modules.flatMap((m) => m.permissions ?? []),
  ...(c.permissions ?? []),
];

export const defineConfig = (c: SparkConfig) => c;
