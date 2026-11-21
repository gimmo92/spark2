"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, authConfigured } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (singleton). Returns null when Supabase isn't configured. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!authConfigured) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
