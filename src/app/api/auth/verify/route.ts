import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { PENDING_COOKIE, TWOFA_COOKIE, TWOFA_TTL_S, cookieOptions, signToken, verifyToken } from "@/lib/auth/twofa";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Step 2: verify the emailed code for the user whose password was just checked, then open the session. */
export async function POST(request: NextRequest) {
  const jar = await cookies();
  const pending = await verifyToken<{ uid: string; email: string }>(jar.get(PENDING_COOKIE)?.value);
  if (!pending) return NextResponse.json({ error: "expired" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const token = String(body.code ?? "").replace(/\D/g, "");
  if (token.length < 6) return NextResponse.json({ error: "code" }, { status: 400 });

  const supabase = await getSupabaseServer(); // writes the session cookies on success
  const { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: "email" });
  if (error || !data.user) {
    const rate = /rate limit|too many/i.test(error?.message ?? "");
    return NextResponse.json({ error: rate ? "rate" : "code" }, { status: rate ? 429 : 401 });
  }
  if (data.user.id !== pending.uid) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: "code" }, { status: 401 });
  }

  jar.set(TWOFA_COOKIE, await signToken({ sub: data.user.id }, TWOFA_TTL_S), cookieOptions(TWOFA_TTL_S));
  jar.delete(PENDING_COOKIE);
  return NextResponse.json({ ok: true });
}
