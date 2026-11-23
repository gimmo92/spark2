// @spark/core/server: server-only helpers for client apps' own API routes.
import "server-only";

export { requireAdmin } from "./auth/require";
export { getSupabaseAdmin, getSupabaseStateless, adminConfigured } from "./supabase/admin";
export { getSupabaseServer } from "./supabase/server";
export { sendInviteEmail, sendLoginCodeEmail, sendPasswordResetEmail, sendgridConfigured } from "./email/sendgrid";
export { adminEmails, hasSparkAccess } from "./auth/access";
export { proxy } from "./server/proxy";
