import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, getSupabaseAdmin } from "../../supabase/admin";

const norm = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

function sameCode(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/**
 * Registration is only possible with the code sent from the app (public.registration_invites).
 * The user picks the password; the invite is marked as used but the code is kept for the profile.
 */
export async function POST(request: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "config", missing: ["SUPABASE_SERVICE_ROLE_KEY"] }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "");
  const password = String(body.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "email" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "weak" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: invite, error: lookupError } = await admin
    .from("registration_invites")
    .select("email, code, registered_at")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "config", missing: ["tabella registration_invites"], detail: lookupError.code }, { status: 500 });
  // same answer for "no invite" and "wrong code"
  if (!invite || !sameCode(invite.code, code)) return NextResponse.json({ error: "invalid_code" }, { status: 403 });
  if (invite.registered_at) return NextResponse.json({ error: "exists" }, { status: 409 });

  const markRegistered = () => admin.from("registration_invites").update({ registered_at: new Date().toISOString() }).eq("email", email);

  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) {
    if (/already|exists|registered/i.test(error?.message ?? "")) {
      await markRegistered();
      return NextResponse.json({ error: "exists" }, { status: 409 });
    }
    if (/password/i.test(error?.message ?? "")) return NextResponse.json({ error: "weak", message: error?.message }, { status: 400 });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  await markRegistered();
  return NextResponse.json({ ok: true });
}
