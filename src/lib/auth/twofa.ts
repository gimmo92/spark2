/**
 * Signed cookies that enforce the two-step login (password + email code) on the server.
 *
 * - PENDING: issued after the password is verified; lets /api/auth/verify accept a code for that user only.
 * - TWOFA:   issued after the email code is verified; the proxy requires it (bound to the session's user id).
 *
 * A Supabase session obtained any other way (e.g. calling the OTP API directly) has no TWOFA cookie,
 * so the proxy still sends it to /login.
 */

export const PENDING_COOKIE = "spark_login_pending";
export const TWOFA_COOKIE = "spark_2fa";
export const PENDING_TTL_S = 10 * 60; // 10 minutes to type the code
export const TWOFA_TTL_S = 12 * 60 * 60; // re-do the full login every 12 hours

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET mancante o troppo corto (min 32 caratteri)");
  return s;
}

export const authSecretConfigured = () => (process.env.AUTH_SECRET ?? "").length >= 32;

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signToken(payload: Record<string, unknown>, ttlSeconds: number) {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  return `${body}.${await hmac(body)}`;
}

export async function verifyToken<T extends Record<string, unknown>>(token: string | undefined): Promise<(T & { exp: number }) | null> {
  if (!token || !authSecretConfigured()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, await hmac(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
