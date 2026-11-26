import "server-only";
import { buOfTeam, permissionsOf, type SparkConfig } from "../config";
import { ADMIN_LEVEL, makeChecker, resolveAccess, type AccessConfig, type Can } from "../access/permissions";
import type { User } from "../people/data";
import { getSupabaseAdmin } from "../supabase/admin";
import { adminEmails, isStaff } from "./access";

/** What the browser is told about the logged-in user (GET /api/data). */
export interface ViewerInfo {
  email: string;
  /** Matching record in "users" (by email), if any. */
  userId?: string;
  level: string;
  isAdmin: boolean;
  staff?: boolean;
  tenant?: string;
  tenantName?: string;
}

export interface Viewer extends ViewerInfo {
  /** The viewer as a person for permission checks (admins listed in ADMIN_EMAILS may have no record). */
  person?: Pick<User, "id" | "level" | "team" | "managerId"> & { company?: string };
  users: User[];
  byId: Map<string, User>;
  can: Can;
}

/**
 * Resolve the logged-in email to its Spark user and permissions, from the client's own data.
 * ADMIN_EMAILS and Spark staff are always admins. With no ADMIN_EMAILS and no users yet, the first user is admin
 * (bootstrap of an empty single-tenant project).
 */
export async function loadViewer(
  email: string,
  config: Pick<SparkConfig, "modules" | "permissions"> & { org?: SparkConfig["org"] },
  /** Multi-tenant app: only this tenant's records. Omit in single-tenant apps. */
  tenant?: string,
): Promise<Viewer | { error: string }> {
  const db = getSupabaseAdmin();
  const rows = () => {
    const q = db.from("app_data").select("data");
    return tenant === undefined ? q : q.eq("tenant", tenant);
  };
  const [{ data: userRows, error: e1 }, { data: accessRow, error: e2 }, { data: orgRow, error: e3 }] = await Promise.all([
    rows().eq("collection", "users").limit(100000),
    rows().eq("collection", "settings").eq("id", "access").maybeSingle(),
    rows().eq("collection", "settings").eq("id", "org").maybeSingle(),
  ]);
  if (e1 || e2 || e3) return { error: "table" };

  const users = (userRows ?? []).map((r) => r.data as User);
  const byId = new Map(users.map((u) => [u.id, u]));
  const levels = resolveAccess(accessRow?.data as AccessConfig | undefined, permissionsOf(config));
  // teams edited in the app (settings "org") win over the client config, as in useOrg
  const teams = (orgRow?.data as { teams?: NonNullable<SparkConfig["org"]>["teams"] } | undefined)?.teams ?? config.org?.teams;
  const can = makeChecker(levels, users, buOfTeam(teams ? { teams } : undefined));

  const record = users.find((u) => u.email?.toLowerCase() === email && u.status !== "disattivato");
  const admins = adminEmails();
  const isAdmin = admins.includes(email) || isStaff(email) || record?.level === ADMIN_LEVEL || (tenant === undefined && !admins.length && users.length === 0);
  const level = isAdmin ? ADMIN_LEVEL : (record?.level ?? "");
  const person = record ? { ...record, level } : isAdmin ? { id: `admin:${email}`, level, team: "" } : undefined;
  return { email, userId: record?.id, level, isAdmin, person, users, byId, can };
}
