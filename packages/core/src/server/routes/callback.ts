import { NextResponse, type NextRequest } from "next/server";
import { allowedDomains, safeNext } from "../../supabase/env";
import { getSupabaseServer } from "../../supabase/server";

/** OAuth / SAML SSO return point: exchange the PKCE code for a session, then enforce the domain allow-list. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, origin));

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail("provider");

  const code = searchParams.get("code");
  if (!code) return fail("missing_code");

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("exchange");

  const domains = allowedDomains();
  const email = data.user.email?.toLowerCase() ?? "";
  if (domains.length && !domains.includes(email.split("@")[1] ?? "")) {
    await supabase.auth.signOut();
    return fail("domain");
  }

  return NextResponse.redirect(new URL(next, origin));
}
