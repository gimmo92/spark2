import { NextResponse, type NextRequest } from "next/server";
import { hasSparkAccess } from "../../auth/access";
import { sendPasswordResetEmail, sendgridConfigured } from "../../email/sendgrid";
import { adminConfigured, getSupabaseAdmin } from "../../supabase/admin";

/**
 * Password reset: the core creates the recovery token and emails the link via SendGrid.
 * Always answers ok, so it can't be used to find out which emails have an account.
 */
export async function POST(request: NextRequest) {
  if (!adminConfigured() || !sendgridConfigured()) return NextResponse.json({ error: "config" }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "email" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (!error && token && data.user && (await hasSparkAccess(data.user))) {
    const link = `${request.nextUrl.origin}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery&next=${encodeURIComponent("/auth/update-password")}`;
    try {
      await sendPasswordResetEmail({ to: email, link });
    } catch (e) {
      console.error("reset email failed", e);
    }
  }
  return NextResponse.json({ ok: true });
}
