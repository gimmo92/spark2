import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, authConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth/"];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

/**
 * Gate every page behind a Supabase session. Also refreshes the session cookies on each request,
 * as required by @supabase/ssr.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The gate is switched on with AUTH_ENABLED=true (Vercel → Settings → Environment Variables),
  // so the code can ship before SSO is configured. /login stays reachable to test sign-in first.
  if (process.env.AUTH_ENABLED !== "true") return NextResponse.next();

  if (!authConfigured) {
    // Gate on but Supabase keys missing: never expose the app; /login explains what's missing.
    return isPublic(path) ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims() verifies the JWT; don't run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublic(path)) {
    const url = new URL("/login", request.url);
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (signedIn && path === "/login") return NextResponse.redirect(new URL("/", request.url));

  return response;
}

export const config = {
  // everything except static assets and image optimisation
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
