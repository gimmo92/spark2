import { NextResponse, type NextRequest } from "next/server";
import { PENDING_COOKIE, TWOFA_COOKIE } from "@/lib/auth/twofa";
import { authConfigured } from "@/lib/supabase/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (authConfigured) {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut({ scope: "local" });
  }
  const res = NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
  res.cookies.delete(TWOFA_COOKIE);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
