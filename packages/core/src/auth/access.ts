import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../supabase/admin";

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Spark staff, the same list in every installation: Spark panel, modules, companies (multi-tenant). */
export const staffEmails = () =>
  (process.env.SPARK_STAFF_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const isStaff = (email: string) => staffEmails().includes(email.toLowerCase());

/** Set on accounts created by Spark's own registration (invite code). */
export const SPARK_ACCESS_FLAG = "spark_access";

/**
 * Who may log in, decided by the core regardless of Supabase settings: accounts created through an
 * invite, or listed in ADMIN_EMAILS / SPARK_STAFF_EMAILS (created by hand). A self sign-up made
 * directly against the Supabase API is refused even if public sign-ups are left on.
 */
export async function hasSparkAccess(user: Pick<User, "email" | "app_metadata">) {
  const email = (user.email ?? "").toLowerCase();
  if (user.app_metadata?.[SPARK_ACCESS_FLAG] === true) return true;
  if (adminEmails().includes(email) || isStaff(email)) return true;
  // accounts registered with an invite before the flag existed
  const { data } = await getSupabaseAdmin().from("registration_invites").select("registered_at").eq("email", email).maybeSingle();
  return Boolean(data?.registered_at);
}
