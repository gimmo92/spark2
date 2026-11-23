import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { hasSparkAccess } from "../../auth/access";
import { PENDING_COOKIE, PENDING_TTL_S, authSecretConfigured, cookieOptions, signToken } from "../../auth/twofa";
import { sendLoginCodeEmail, sendgridConfigured } from "../../email/sendgrid";
import { adminConfigured, getSupabaseAdmin, getSupabaseStateless } from "../../supabase/admin";
import { authConfigured, missingAuthConfig } from "../../supabase/env";

function missingConfig() {
  const missing = missingAuthConfig();
  if (!adminConfigured()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!sendgridConfigured()) missing.push("SENDGRID_API_KEY / SENDGRID_FROM");
  return missing;
}

/**
 * Step 1: verify email + password on the server, then email a one-time code (sent by the core via
 * SendGrid, not by Supabase). No session reaches the browser yet.
 */
export async function POST(request: NextRequest) {
  const missing = missingConfig();
  if (!authConfigured || !authSecretConfigured() || missing.length) return NextResponse.json({ error: "config", missing }, { status: 500 });

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
  const user = data.user;
  await supabase.auth.signOut({ scope: "local" }); // drop the password-only session: it never leaves the server

  // same answer as a wrong password: don't reveal that the account exists
  if (!(await hasSparkAccess(user))) return NextResponse.json({ error: "credentials" }, { status: 401 });

  // generate the one-time code without letting Supabase send any email
  const { data: link, error: linkError } = await getSupabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  const code = link?.properties?.email_otp;
  if (linkError || !code) {
    const rate = /rate limit|too many|seconds/i.test(linkError?.message ?? "");
    return NextResponse.json({ error: rate ? "rate" : "send" }, { status: rate ? 429 : 500 });
  }
  try {
    await sendLoginCodeEmail({ to: email, code });
  } catch (e) {
    console.error("login code email failed", e);
    return NextResponse.json({ error: "send" }, { status: 502 });
  }

  (await cookies()).set(PENDING_COOKIE, await signToken({ uid: user.id, email }, PENDING_TTL_S), cookieOptions(PENDING_TTL_S));
  return NextResponse.json({ ok: true });
}
