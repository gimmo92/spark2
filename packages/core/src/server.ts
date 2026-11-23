// @spark/core/server: server-only helpers for client apps' own API routes.
import "server-only";

export { requireAdmin } from "./auth/require";
export { getSupabaseAdmin, getSupabaseStateless, adminConfigured } from "./supabase/admin";
export { getSupabaseServer } from "./supabase/server";
export { sendInviteEmail, sendgridConfigured } from "./email/sendgrid";
export { proxy } from "./server/proxy";
