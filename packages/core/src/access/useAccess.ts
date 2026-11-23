"use client";

import { useCallback, useMemo } from "react";
import { permissionsOf } from "../config";
import { useCollection, useSettings } from "../data/DataProvider";
import type { User } from "../people/data";
import { useSparkConfig } from "../shell/SparkProvider";
import { ADMIN_LEVEL, grantCovers, resolveAccess, type AccessLevelDef, type AccessConfig } from "./permissions";

const EMPTY: AccessConfig = { levels: [] };

/**
 * Access levels and permission checks.
 * `can(user, "mbo.schede.view", target)` answers for a specific record owner; without `target` it
 * tells whether the user has the permission for at least one scope (e.g. to show a menu item).
 */
export function useAccess() {
  const config = useSparkConfig();
  const catalog = useMemo(() => permissionsOf(config), [config]);
  const [stored, patch] = useSettings<AccessConfig>("access", EMPTY);
  const [users] = useCollection<User>("users");

  const levels = useMemo(() => resolveAccess(stored, catalog), [stored, catalog]);
  const grantsByLevel = useMemo(() => new Map(levels.map((l) => [l.id, new Set(l.grants)])), [levels]);

  const setLevels = useCallback((next: AccessLevelDef[]) => patch({ levels: next }), [patch]);
  const levelName = useCallback((id: string) => levels.find((l) => l.id === id)?.name ?? id, [levels]);

  const can = useCallback(
    (user: Pick<User, "id" | "level" | "team" | "managerId"> | undefined, permission: string, target?: Pick<User, "id" | "team" | "managerId">) => {
      if (!user) return false;
      if (user.level === ADMIN_LEVEL) return true;
      const grants = grantsByLevel.get(user.level);
      return grants ? grantCovers(grants, permission, user, target, users) : false;
    },
    [grantsByLevel, users],
  );

  return { catalog, levels, setLevels, levelName, can };
}
