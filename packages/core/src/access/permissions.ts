/**
 * Access levels and permissions, owned by the core.
 *
 * - The catalog of permissions comes from the core (people, dashboard, settings), from each module
 *   (`SparkModule.permissions`) and from the client app (`SparkConfig.permissions`).
 * - A permission is either on/off, or scoped: granted for one's own records ("self"), for one's
 *   reports ("reports", direct and indirect, via `User.managerId`), for one's team ("team") or for all.
 * - Levels live in the settings doc "access". ADMIN, MANAGER and UTENTE always exist; ADMIN has every
 *   permission and can't be changed (so nobody can lock the organisation out). Clients add custom levels.
 */

export type Scope = "self" | "reports" | "team" | "all";
export const SCOPES: Scope[] = ["self", "reports", "team", "all"];
export const SCOPE_LABELS: Record<Scope, string> = { self: "Propri", reports: "Dei riporti", team: "Del team", all: "Tutti" };
export const SCOPE_HINTS: Record<Scope, string> = {
  self: "Solo i propri dati",
  reports: "Le persone che riportano a lui/lei, direttamente o indirettamente",
  team: "Le persone del suo team",
  all: "Tutta l'organizzazione",
};

export interface PermissionDef {
  /** Stable id, e.g. "mbo.schede.view". Never rename: levels store it. */
  id: string;
  /** Section of the settings panel, e.g. "Persone", "MBO". */
  group: string;
  label: string;
  hint?: string;
  /** Scopes this permission can be granted for. Omit for a simple on/off permission. */
  scopes?: Scope[];
  /** Default for the built-in levels (ADMIN always has everything). */
  defaults?: { MANAGER?: Scope[] | true; UTENTE?: Scope[] | true };
}

/** Granted permission: "id" (on/off) or "id:scope". */
export type Grant = string;

export interface AccessLevelDef {
  id: string;
  name: string;
  description?: string;
  /** Built-in level: can't be deleted. */
  system?: boolean;
  /** Custom levels: the built-in level they were created from (used for permissions added later). */
  base?: "MANAGER" | "UTENTE";
  grants: Grant[];
  /** Permission ids that existed when this level was last saved: newer ones get their defaults. */
  known: string[];
}

export interface AccessConfig {
  levels: AccessLevelDef[];
}

export const ADMIN_LEVEL = "ADMIN";

export const CORE_PERMISSIONS: PermissionDef[] = [
  {
    id: "people.view",
    group: "Persone",
    label: "Vedere i profili utente",
    scopes: SCOPES,
    defaults: { MANAGER: ["self", "reports", "team"], UTENTE: ["self"] },
  },
  {
    id: "people.edit",
    group: "Persone",
    label: "Modificare i profili utente",
    hint: "Anagrafica, team, responsabile, stato dell'account",
    scopes: ["reports", "team", "all"],
  },
  { id: "people.create", group: "Persone", label: "Creare utenti e inviare inviti" },
  { id: "people.level", group: "Persone", label: "Cambiare il livello di accesso degli utenti" },
  { id: "teams.manage", group: "Persone", label: "Gestire i team" },
  {
    id: "dashboard.view",
    group: "Dashboard",
    label: "Vedere la dashboard generale",
    scopes: ["reports", "team", "all"],
    defaults: { MANAGER: ["reports", "team"] },
  },
  { id: "letters.manage", group: "Lettere", label: "Gestire i modelli di lettera", hint: "Carta intestata, testi e variabili" },
  { id: "access.manage", group: "Impostazioni", label: "Gestire livelli di accesso e permessi" },
];

const grantsFor = (p: PermissionDef, d: Scope[] | true | undefined): Grant[] =>
  !d ? [] : p.scopes ? (d === true ? p.scopes : d.filter((s) => p.scopes!.includes(s))).map((s) => `${p.id}:${s}`) : [p.id];

/** Every grant a permission can have. */
export const allGrants = (p: PermissionDef): Grant[] => (p.scopes ? p.scopes.map((s) => `${p.id}:${s}`) : [p.id]);

export const defaultGrants = (catalog: PermissionDef[], level: "MANAGER" | "UTENTE") => catalog.flatMap((p) => grantsFor(p, p.defaults?.[level]));

export function defaultAccess(catalog: PermissionDef[]): AccessConfig {
  const known = catalog.map((p) => p.id);
  return {
    levels: [
      { id: "ADMIN", name: "Admin", description: "Vede e gestisce tutto.", system: true, grants: catalog.flatMap(allGrants), known },
      {
        id: "MANAGER",
        name: "Manager",
        description: "Vede se stesso, il proprio team e i propri riporti.",
        system: true,
        grants: defaultGrants(catalog, "MANAGER"),
        known,
      },
      { id: "UTENTE", name: "Utente", description: "Vede solo se stesso.", system: true, grants: defaultGrants(catalog, "UTENTE"), known },
    ],
  };
}

/**
 * Stored levels completed against the current catalog: built-in levels are always present, ADMIN
 * always has every permission, permissions added after a level was saved get their defaults.
 */
export function resolveAccess(stored: AccessConfig | undefined, catalog: PermissionDef[]): AccessLevelDef[] {
  const defaults = defaultAccess(catalog).levels;
  const saved = stored?.levels ?? [];
  const ids = new Set(catalog.map((p) => p.id));
  const builtIn = defaults.map((d) => ({ ...d, ...saved.find((l) => l.id === d.id), system: true }));
  const custom = saved.filter((l) => !defaults.some((d) => d.id === l.id));
  return [...builtIn, ...custom].map((l) => {
    if (l.id === ADMIN_LEVEL) return { ...l, grants: catalog.flatMap(allGrants), known: [...ids] };
    const base = l.id === "MANAGER" || l.id === "UTENTE" ? l.id : (l.base ?? "UTENTE");
    const fresh = catalog.filter((p) => !l.known?.includes(p.id));
    const grants = [...l.grants.filter((g) => ids.has(g.split(":")[0])), ...fresh.flatMap((p) => grantsFor(p, p.defaults?.[base]))];
    return { ...l, grants, known: [...ids] };
  });
}

/** Minimal person shape for scope checks (a core User fits). */
export interface ScopedPerson {
  id: string;
  team: string;
  managerId?: string;
}

/** True if `target` reports to `viewer`, directly or through other managers. */
export function reportsTo(target: ScopedPerson, viewer: ScopedPerson, people: ScopedPerson[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  let cur = target.managerId ? byId.get(target.managerId) : undefined;
  while (cur && !seen.has(cur.id)) {
    if (cur.id === viewer.id) return true;
    seen.add(cur.id);
    cur = cur.managerId ? byId.get(cur.managerId) : undefined;
  }
  return false;
}

/** Does a level grant `permission` over `target`? (`target` omitted = any scope at all.) */
export function grantCovers(
  grants: Set<Grant>,
  permission: string,
  viewer?: ScopedPerson,
  target?: ScopedPerson,
  people: ScopedPerson[] = [],
) {
  if (grants.has(permission)) return true;
  if (!target || !viewer) return SCOPES.some((s) => grants.has(`${permission}:${s}`));
  if (grants.has(`${permission}:all`)) return true;
  if (grants.has(`${permission}:self`) && target.id === viewer.id) return true;
  if (grants.has(`${permission}:team`) && viewer.team && target.team === viewer.team) return true;
  if (grants.has(`${permission}:reports`) && reportsTo(target, viewer, people)) return true;
  return false;
}

export type LeveledPerson = ScopedPerson & { level: string };
export type Can = (user: LeveledPerson | undefined, permission: string, target?: ScopedPerson) => boolean;

/** Permission check shared by the browser (UI) and the server (/api/data). ADMIN can do everything. */
export function makeChecker(levels: AccessLevelDef[], people: ScopedPerson[]): Can {
  const byLevel = new Map(levels.map((l) => [l.id, new Set(l.grants)]));
  return (user, permission, target) => {
    if (!user) return false;
    if (user.level === ADMIN_LEVEL) return true;
    const grants = byLevel.get(user.level);
    return grants ? grantCovers(grants, permission, user, target, people) : false;
  };
}
