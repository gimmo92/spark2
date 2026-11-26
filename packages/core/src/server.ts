// @spark/core/server: server-only helpers for client apps' own API routes.
import "server-only";

export { requireUser } from "./auth/require";
export { loadViewer, type Viewer, type ViewerInfo } from "./auth/viewer";
export { getSupabaseAdmin, getSupabaseStateless, adminConfigured } from "./supabase/admin";
export { getSupabaseServer } from "./supabase/server";
export { sendInviteEmail, sendLoginCodeEmail, sendPasswordResetEmail, sendgridConfigured } from "./email/sendgrid";
export { adminEmails, hasSparkAccess } from "./auth/access";
export { proxy } from "./server/proxy";
export { requireCaller, type Caller, type CallerConfig } from "./server/caller";
