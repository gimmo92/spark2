import "server-only";
import { cookies } from "next/headers";
import { TWOFA_COOKIE, verifyToken } from "./twofa";
import { getSupabaseServer } from "../supabase/server";

/**
 * For privileged API routes: the caller must have completed the full login (Supabase session +
 * signed 2-step cookie for the same user). If ADMIN_EMAILS is set, the email must also be listed.
 */
export async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub as string | undefined;
  const email = String(data?.claims?.email ?? "").toLowerCase();
  if (!sub) return { ok: false, status: 401, error: "unauthenticated" };

  const twofa = await verifyToken<{ sub: string }>((await cookies()).get(TWOFA_COOKIE)?.value);
  if (twofa?.sub !== sub) return { ok: false, status: 401, error: "unauthenticated" };

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length && !admins.includes(email)) return { ok: false, status: 403, error: "forbidden" };

  return { ok: true, email };
}
