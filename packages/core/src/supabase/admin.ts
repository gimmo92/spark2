import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Service-role key (set by the Vercel ↔ Supabase integration). Never expose it to the browser. */
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export const adminConfigured = () => Boolean(SUPABASE_URL && SERVICE_KEY);

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Privileged client: bypasses RLS, can create users. Server only. */
export const getSupabaseAdmin = () => createClient(SUPABASE_URL, SERVICE_KEY, noSession);

/** Anonymous client with no cookie storage: used to check a password without handing a session to the browser. */
export const getSupabaseStateless = () => createClient(SUPABASE_URL, SUPABASE_KEY, noSession);
