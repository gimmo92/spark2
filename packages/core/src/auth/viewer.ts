import "server-only";
import { buOfTeam, permissionsOf, type SparkConfig } from "../config";
import { ADMIN_LEVEL, makeChecker, resolveAccess, type AccessConfig, type Can } from "../access/permissions";
import type { User } from "../people/data";
import { getSupabaseAdmin } from "../supabase/admin";
import { adminEmails } from "./access";

/** What the browser is told about the logged-in user (GET /api/data). */
export interface ViewerInfo {
  email: string;
  /** Matching record in "users" (by email), if any. */
  userId?: string;
  level: string;
  isAdmin: boolean;
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
 * ADMIN_EMAILS are always admins. With no ADMIN_EMAILS and no users yet, the first user is admin
 * (bootstrap of an empty project).
 */
export async function loadViewer(email: string, config: Pick<SparkConfig, "modules" | "permissions"> & { org?: SparkConfig["org"] }): Promise<Viewer | { error: string }> {
  const db = getSupabaseAdmin();
  const [{ data: userRows, error: e1 }, { data: accessRow, error: e2 }] = await Promise.all([
    db.from("app_data").select("data").eq("collection", "users").limit(100000),
    db.from("app_data").select("data").eq("collection", "settings").eq("id", "access").maybeSingle(),
  ]);
  if (e1 || e2) return { error: "table" };

  const users = (userRows ?? []).map((r) => r.data as User);
  const byId = new Map(users.map((u) => [u.id, u]));
  const levels = resolveAccess(accessRow?.data as AccessConfig | undefined, permissionsOf(config));
  const can = makeChecker(levels, users, buOfTeam(config.org));

  const record = users.find((u) => u.email?.toLowerCase() === email && u.status !== "disattivato");
  const admins = adminEmails();
  const isAdmin = admins.includes(email) || record?.level === ADMIN_LEVEL || (!admins.length && users.length === 0);
  const level = isAdmin ? ADMIN_LEVEL : (record?.level ?? "");
  const person = record ? { ...record, level } : isAdmin ? { id: `admin:${email}`, level, team: "" } : undefined;
  return { email, userId: record?.id, level, isAdmin, person, users, byId, can };
}
