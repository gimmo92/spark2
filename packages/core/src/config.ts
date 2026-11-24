import type { LucideIcon } from "lucide-react";
import { CORE_PERMISSIONS, type PermissionDef } from "./access/permissions";
import type { CollectionAccess, SettingsAccess } from "./access/rules";
import type { LetterSource } from "./letters/data";

/** Every stored record has a string id. */
export type Doc = { id: string };

/** `permission`: shown only to users who have it (for at least one scope). */
export type NavLeaf = { label: string; href: string; badge?: string; permission?: string };
export type NavItem =
  | { label: string; href: string; icon: LucideIcon; muted?: boolean; permission?: string }
  | { id: string; label: string; icon: LucideIcon; children: NavLeaf[] };

export interface Tab {
  label: string;
  href: string;
  /** Active only on this exact path (default: any path starting with href). */
  exact?: boolean;
  /** Shown only to users who have it. */
  permission?: string;
}

/** A feature module (e.g. @spark/mbo). Client-specific modules use the same shape. */
export interface SparkModule {
  id: string;
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
  /** localStorage key prefix for the browser-only fallback. */
  storagePrefix?: string;
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
