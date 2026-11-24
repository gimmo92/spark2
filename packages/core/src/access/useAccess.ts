"use client";

import { useCallback, useMemo } from "react";
import { buOfTeam, permissionsOf } from "../config";
import { useCollection, useData, useSettings } from "../data/DataProvider";
import type { User } from "../people/data";
import { useSparkConfig } from "../shell/SparkProvider";
import { ADMIN_LEVEL, makeChecker, resolveAccess, type AccessConfig, type AccessLevelDef, type ScopedPerson } from "./permissions";
import { tr } from "../i18n/i18n";

const EMPTY: AccessConfig = { levels: [] };

/**
 * Access levels and permission checks.
 * - `can(user, "mbo.schede.view", target)`: for any user (e.g. settings previews).
 * - `allowed("mbo.schede.view", target)`: for the logged-in user. Without `target` it tells whether
 *   they have the permission for at least one scope (menus, "Nuovo …" buttons).
 * The server enforces the same rules on /api/data: this only hides what can't be done.
 */
export function useAccess() {
  const config = useSparkConfig();
  const catalog = useMemo(() => permissionsOf(config), [config]);
  const [stored, patch] = useSettings<AccessConfig>("access", EMPTY);
  const [users] = useCollection<User>("users");
  const { viewer, dataSource } = useData();

  const levels = useMemo(() => resolveAccess(stored, catalog), [stored, catalog]);
  const can = useMemo(() => makeChecker(levels, users, buOfTeam(config.org)), [levels, users, config.org]);

  const setLevels = useCallback((next: AccessLevelDef[]) => patch({ levels: next }), [patch]);
  const levelName = useCallback((id: string) => tr(levels.find((l) => l.id === id)?.name ?? id), [levels]);

  /** The logged-in user's record (undefined for admins listed only in ADMIN_EMAILS). */
  const me = useMemo(() => (viewer?.userId ? users.find((u) => u.id === viewer.userId) : undefined), [viewer, users]);
  // browser-only mode (local dev, no database) has no login: everything is allowed
  const isAdmin = viewer ? viewer.isAdmin : dataSource !== "denied";
  const allowed = useCallback(
    (permission: string, target?: ScopedPerson) => {
      if (isAdmin) return true;
      if (!me || !viewer) return false;
      return can({ ...me, level: viewer.level }, permission, target);
    },
    [isAdmin, me, viewer, can],
  );

  /** May the logged-in user edit this user record? (only admins touch admins) */
  const canEditUser = useCallback(
    (u: Pick<User, "id" | "team" | "managerId" | "level">) => isAdmin || (u.level !== ADMIN_LEVEL && allowed("people.edit", u)),
    [isAdmin, allowed],
  );

  return { catalog, levels, setLevels, levelName, can, me, isAdmin, allowed, canEditUser, adminLevel: ADMIN_LEVEL };
}
