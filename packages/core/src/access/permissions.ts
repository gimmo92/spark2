/**
 * Access levels and permissions, owned by the core.
 *
 * - The catalog of permissions comes from the core (people, dashboard, settings), from each module
 *   (`SparkModule.permissions`) and from the client app (`SparkConfig.permissions`).
 * - A permission is either on/off, or scoped: granted for one's own records ("self"), for one's direct
 *   reports ("direct"), for all reports down the line ("reports", via `User.managerId`), for one's team,
 *   business unit ("bu", from the team in `OrgConfig.teams`), company, or for all.
 * - Levels live in the settings doc "access". ADMIN, MANAGER and UTENTE always exist; ADMIN has every
 *   permission and can't be changed (so nobody can lock the organisation out). Clients add custom levels.
 */

export type Scope = "self" | "direct" | "reports" | "team" | "bu" | "company" | "all";
export const SCOPES: Scope[] = ["self", "direct", "reports", "team", "bu", "company", "all"];
/** Every scope except "self": for permissions that only make sense over other people. */
export const OTHERS_SCOPES: Scope[] = SCOPES.filter((s) => s !== "self");
export const SCOPE_LABELS: Record<Scope, string> = {
  self: "Self",
  direct: "Riporti",
  reports: "Riporti a cascata",
  team: "Team",
  bu: "BU",
  company: "Società",
  all: "Tutto",
};
export const SCOPE_HINTS: Record<Scope, string> = {
  self: "Solo i propri dati",
  direct: "Le persone che riportano direttamente a lui/lei",
  reports: "Tutte le persone sotto di lui/lei, direttamente o indirettamente",
  team: "Le persone del suo team",
  bu: "Le persone della sua business unit",
  company: "Le persone della sua società",
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
    scopes: OTHERS_SCOPES,
  },
  { id: "people.create", group: "Persone", label: "Creare utenti e inviare inviti" },
  { id: "people.level", group: "Persone", label: "Cambiare il livello di accesso degli utenti" },
  { id: "teams.manage", group: "Persone", label: "Gestire i team" },
  { id: "companies.manage", group: "Persone", label: "Gestire le società", hint: "Lista Società: aggiungere, rinominare, eliminare" },
  {
    id: "dashboard.view",
    group: "Dashboard",
    label: "Vedere la dashboard generale",
    scopes: OTHERS_SCOPES,
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
        description: "Vede se stesso, il proprio team e i propri riporti a cascata.",
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
  company?: string;
  managerId?: string;
}

/** Business unit of a team (from `OrgConfig.teams`). */
export type BuOf = (team: string) => string | undefined;

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
  buOf: BuOf = () => undefined,
) {
  if (grants.has(permission)) return true;
  if (!target || !viewer) return SCOPES.some((s) => grants.has(`${permission}:${s}`));
  const has = (s: Scope) => grants.has(`${permission}:${s}`);
  if (has("all")) return true;
  if (has("self") && target.id === viewer.id) return true;
  if (has("direct") && !!target.managerId && target.managerId === viewer.id) return true;
  if (has("team") && viewer.team && target.team === viewer.team) return true;
  if (has("company") && viewer.company && target.company === viewer.company) return true;
  if (has("bu")) {
    const bu = viewer.team ? buOf(viewer.team) : undefined;
    if (bu && target.team && buOf(target.team) === bu) return true;
  }
  if (has("reports") && reportsTo(target, viewer, people)) return true;
  return false;
}

export type LeveledPerson = ScopedPerson & { level: string };
export type Can = (user: LeveledPerson | undefined, permission: string, target?: ScopedPerson) => boolean;

/** Permission check shared by the browser (UI) and the server (/api/data). ADMIN can do everything. */
export function makeChecker(levels: AccessLevelDef[], people: ScopedPerson[], buOf?: BuOf): Can {
  const byLevel = new Map(levels.map((l) => [l.id, new Set(l.grants)]));
  return (user, permission, target) => {
    if (!user) return false;
    if (user.level === ADMIN_LEVEL) return true;
    const grants = byLevel.get(user.level);
    return grants ? grantCovers(grants, permission, user, target, people, buOf) : false;
  };
}
