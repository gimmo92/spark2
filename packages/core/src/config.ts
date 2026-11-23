import type { LucideIcon } from "lucide-react";
import { CORE_PERMISSIONS, type PermissionDef } from "./access/permissions";

/** Every stored record has a string id. */
export type Doc = { id: string };

export type NavLeaf = { label: string; href: string; badge?: string };
export type NavItem =
  | { label: string; href: string; icon: LucideIcon; muted?: boolean }
  | { id: string; label: string; icon: LucideIcon; children: NavLeaf[] };

export interface Tab {
  label: string;
  href: string;
  /** Active only on this exact path (default: any path starting with href). */
  exact?: boolean;
}

/** A feature module (e.g. @spark/mbo). Client-specific modules use the same shape. */
export interface SparkModule {
  id: string;
  /** Data collections the module saves (rows of public.app_data). */
  collections: string[];
  /** Permissions the module adds to Impostazioni → Permessi. */
  permissions?: PermissionDef[];
}

export interface OrgConfig {
  /** Organisation name shown in the shell. */
  name: string;
  /** Employees' email domains. The first one is used to suggest nome.cognome@domain for new users. */
  emailDomains: string[];
  companies: string[];
  teams: { name: string; company: string }[];
}

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
  /** localStorage key prefix for the browser-only fallback. */
  storagePrefix?: string;
}

/** Collections owned by the core. */
export const CORE_COLLECTIONS = ["users", "settings"] as const;

export const collectionsOf = (c: Pick<SparkConfig, "modules">) => [...CORE_COLLECTIONS, ...c.modules.flatMap((m) => m.collections)];

/** Full permission catalog of an app: core, then modules, then client-specific. */
export const permissionsOf = (c: Pick<SparkConfig, "modules" | "permissions">) => [
  ...CORE_PERMISSIONS,
  ...c.modules.flatMap((m) => m.permissions ?? []),
  ...(c.permissions ?? []),
];

export const defineConfig = (c: SparkConfig) => c;
