/**
 * Supabase config. The Vercel ↔ Supabase integration injects NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (newer projects: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Optional server-side allow-list of email domains, e.g. "tryspark.co,valmec.it". Empty = any domain. */
export const allowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
