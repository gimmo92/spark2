import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { PENDING_COOKIE, PENDING_TTL_S, authSecretConfigured, cookieOptions, signToken } from "@/lib/auth/twofa";
import { getSupabaseStateless } from "@/lib/supabase/admin";
import { authConfigured, missingAuthConfig } from "@/lib/supabase/env";

/** Step 1: verify email + password on the server, then email a one-time code. No session reaches the browser yet. */
export async function POST(request: NextRequest) {
  if (!authConfigured || !authSecretConfigured()) return NextResponse.json({ error: "config", missing: missingAuthConfig() }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "credentials" }, { status: 400 });

  const supabase = getSupabaseStateless();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const rate = /rate limit|too many/i.test(error?.message ?? "");
    return NextResponse.json({ error: rate ? "rate" : "credentials" }, { status: rate ? 429 : 401 });
  }
  const uid = data.user.id;
  await supabase.auth.signOut({ scope: "local" }); // drop the password-only session: it never leaves the server

  const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (otpError) {
    const rate = /rate limit|too many|seconds/i.test(otpError.message);
    return NextResponse.json({ error: rate ? "rate" : "send" }, { status: rate ? 429 : 500 });
  }

  (await cookies()).set(PENDING_COOKIE, await signToken({ uid, email }, PENDING_TTL_S), cookieOptions(PENDING_TTL_S));
  return NextResponse.json({ ok: true });
}
