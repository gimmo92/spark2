import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TWOFA_COOKIE, verifyToken } from "@/lib/auth/twofa";
import { SUPABASE_KEY, SUPABASE_URL, authConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/registrazione", "/auth/", "/api/auth/"];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

/**
 * Gate every page behind: a valid Supabase session AND the signed 2-step cookie (password + email code)
 * for the same user. Also refreshes the Supabase session cookies, as required by @supabase/ssr.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The gate is switched on with AUTH_ENABLED=true (Vercel → Settings → Environment Variables),
  // so the code can ship before auth is configured. /login stays reachable to test sign-in first.
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
  const sub = data?.claims?.sub as string | undefined;
  const twofa = sub ? await verifyToken<{ sub: string }>(request.cookies.get(TWOFA_COOKIE)?.value) : null;
  const fullyAuthed = Boolean(sub && twofa?.sub === sub);

  if (!fullyAuthed && !isPublic(path)) {
    const url = new URL("/login", request.url);
    if (path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (fullyAuthed && (path === "/login" || path === "/registrazione")) return NextResponse.redirect(new URL("/", request.url));

  return response;
}

export const config = {
  // everything except static assets and image optimisation
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
