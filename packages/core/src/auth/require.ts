import "server-only";
import { cookies } from "next/headers";
import { TWOFA_COOKIE, verifyToken } from "./twofa";
import { getSupabaseServer } from "../supabase/server";

type Result = { ok: true; email: string } | { ok: false; status: number; error: string };

/** For API routes: the caller must have completed the full login (Supabase session + signed 2-step cookie). */
export async function requireUser(): Promise<Result> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub as string | undefined;
  const email = String(data?.claims?.email ?? "").toLowerCase();
  if (!sub) return { ok: false, status: 401, error: "unauthenticated" };

  const twofa = await verifyToken<{ sub: string }>((await cookies()).get(TWOFA_COOKIE)?.value);
  if (twofa?.sub !== sub) return { ok: false, status: 401, error: "unauthenticated" };
  return { ok: true, email };
}
