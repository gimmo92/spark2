import "server-only";
import { NextResponse } from "next/server";
import { isStaff } from "../auth/access";
import { requireUser } from "../auth/require";
import { resolveTenant } from "../auth/tenant";
import { loadViewer, type Viewer } from "../auth/viewer";
import { enabledModules, type SparkConfig } from "../config";
import type { ViewerDTO } from "../data/sync";
import { adminConfigured } from "../supabase/admin";
import { authConfigured } from "../supabase/env";
import { readModules } from "./modules";

export type CallerConfig = Pick<SparkConfig, "modules" | "permissions" | "multiTenant" | "tenantModules"> & { org?: SparkConfig["org"] };

/**
 * The caller with permissions; `tenant` is set only in multi-tenant apps (every query is scoped to it).
 * `modules`: modules on for the caller (Spark panel: installation, and company in multi-tenant apps).
 */
export type Caller = Viewer & { tenant?: string; modules: string[]; hidden: string[] };

/**
 * For API routes that work on the app's data: the logged-in Spark user with their permissions, tenant
 * (multi-tenant apps) and modules on, or the error response to return (same rules as /api/data).
 */
export async function requireCaller(config: CallerConfig): Promise<NextResponse | Caller> {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let tenant: string | undefined;
  let extra: Partial<ViewerDTO> = {};
  if (config.multiTenant) {
    const t = await resolveTenant(auth.email);
    if (!t.tenant) {
      // staff must pick a tenant first (their menu shows the installation's modules); anybody else without one has no data at all
      if (t.staff) {
        const inst = await readModules(true, []).catch(() => null);
        const modules = enabledModules({ ...config, tenantModules: undefined }, inst?.installation.enabled);
        const hiddenFeatures = inst?.installation.hidden ?? [];
        return NextResponse.json({ error: "tenant", viewer: { email: auth.email, level: "ADMIN", isAdmin: true, staff: true, tenant: "", modules, hiddenFeatures } satisfies ViewerDTO }, { status: 409 });
      }
      return NextResponse.json({ error: "unlinked" }, { status: 403 });
    }
    tenant = t.tenant;
    extra = { tenant: t.tenant, tenantName: t.name };
  }
  let stored: Awaited<ReturnType<typeof readModules>>;
  try {
    stored = await readModules(!!config.multiTenant, tenant ? [tenant] : undefined);
  } catch (e) {
    return NextResponse.json({ error: "table", detail: (e as { code?: string }).code }, { status: 503 });
  }
  const own = tenant ? stored.tenants.get(tenant) : undefined;
  const modules = enabledModules(config, stored.installation.enabled, own?.enabled);
  // menu entries switched off for the installation or the company
  const hidden = [...new Set([...stored.installation.hidden, ...(own?.hidden ?? [])])];
  // the caller's config: modules switched off don't exist (permissions, collections, rules)
  const scoped = { ...config, modules: config.modules.filter((m) => modules.includes(m.id)) };
  const viewer = await loadViewer(auth.email, scoped, tenant);
  if ("error" in viewer) return NextResponse.json({ error: viewer.error }, { status: 503 });
  if (!viewer.person) return NextResponse.json({ error: "unlinked" }, { status: 403 });
  return Object.assign(viewer, extra, { tenant, modules, hidden, staff: isStaff(auth.email) });
}

