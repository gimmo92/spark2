import { NextResponse, type NextRequest } from "next/server";
import { authConfigured } from "@/lib/supabase/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (authConfigured) {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
