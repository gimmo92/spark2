import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Self-registration restricted to pre-loaded users: the email must exist in public.allowed_users.
 * The account is created with the password the user chose; ownership of the mailbox is proven at
 * every login by the emailed code.
 */
export async function POST(request: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "config" }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "email" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "weak" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: allowed, error: lookupError } = await admin.from("allowed_users").select("email").eq("email", email).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "config" }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: "not_allowed" }, { status: 403 });

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) return NextResponse.json({ error: "exists" }, { status: 409 });
    if (/password/i.test(error.message)) return NextResponse.json({ error: "weak", message: error.message }, { status: 400 });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
