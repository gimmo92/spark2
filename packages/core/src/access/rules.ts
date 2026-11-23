import type { Doc, SparkConfig } from "../config";
import { ADMIN_LEVEL, type Can, type LeveledPerson, type ScopedPerson } from "./permissions";

/**
 * Who may read and write the records of a collection. Declared by the core (users, settings) and by
 * each module (`SparkModule.access`); /api/data enforces them on the server, screens use them to hide
 * actions. A collection without rules is reserved to admins.
 */
export interface CollectionAccess {
  /** Users a record belongs to: scoped permissions are checked against them. Omit = organisation-wide records. */
  owners?: (doc: Doc) => string[];
  /** Permission needed to read. Omit = everyone logged in can read. */
  view?: string;
  /** Any of these allows writing; for owned records it must cover every owner (before and after the change). */
  edit: string[];
}

/** Settings documents (collection "settings"): doc id → permissions that may change it. Readable by everyone. */
export type SettingsAccess = Record<string, string[]>;

const CORE_ACCESS: Record<string, CollectionAccess> = {
  users: { owners: (d) => [d.id], view: "people.view", edit: ["people.edit"] },
};
const CORE_SETTINGS: SettingsAccess = { access: ["access.manage"] };

export function accessRulesOf(config: Pick<SparkConfig, "modules">) {
  const collections: Record<string, CollectionAccess> = { ...CORE_ACCESS };
  const settings: SettingsAccess = { ...CORE_SETTINGS };
  for (const m of config.modules) {
    Object.assign(collections, m.access ?? {});
    Object.assign(settings, m.settingsAccess ?? {});
  }
  return { collections, settings };
}

type Person = LeveledPerson & { id: string };

/** Can `viewer` read `doc`? */
export function canRead(rule: CollectionAccess | undefined, viewer: Person | undefined, doc: Doc, can: Can, byId: Map<string, ScopedPerson>) {
  if (!rule) return false;
  if (!rule.view) return true;
  if (!rule.owners) return can(viewer, rule.view);
  return rule.owners(doc).some((id) => {
    const target = byId.get(id);
    return target ? can(viewer, rule.view!, target) : false;
  });
}

/** Can `viewer` write a record (`before` = stored version, `after` = new version; one may be missing)? */
export function canWrite(
  rule: CollectionAccess | undefined,
  viewer: Person | undefined,
  before: Doc | undefined,
  after: Doc | undefined,
  can: Can,
  byId: Map<string, ScopedPerson>,
) {
  if (!rule) return false;
  const anyOf = (target?: ScopedPerson) => rule.edit.some((p) => can(viewer, p, target));
  if (!rule.owners) return anyOf();
  const owners = [...new Set([...(before ? rule.owners(before) : []), ...(after ? rule.owners(after) : [])])];
  if (!owners.length) return anyOf();
  return owners.every((id) => {
    const target = byId.get(id);
    return target ? anyOf(target) : false;
  });
}

/** Extra checks on user records: creating users, changing levels, touching admins. */
export function canWriteUser(viewer: Person | undefined, before: (Doc & { level?: string }) | undefined, after: (Doc & { level?: string }) | undefined, can: Can, byId: Map<string, ScopedPerson>) {
  if (viewer?.level === ADMIN_LEVEL) return true;
  if (before?.level === ADMIN_LEVEL || after?.level === ADMIN_LEVEL) return false; // only admins manage admins
  if (!before) return can(viewer, "people.create") && (after?.level === "UTENTE" || can(viewer, "people.level"));
  if (!after) return false; // users are deactivated, never deleted, by non-admins
  if (before.level !== after.level && !can(viewer, "people.level")) return false;
  return canWrite(CORE_ACCESS.users, viewer, before, after, can, byId);
}
