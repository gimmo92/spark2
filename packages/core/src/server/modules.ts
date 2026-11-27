import "server-only";
import { getSupabaseAdmin } from "../supabase/admin";

/**
 * Modules switched on by Spark staff, stored in app_data (collection "_spark", never served by
 * /api/data): one record for the installation and, in multi-tenant apps, one per tenant. A missing
 * record means the defaults (see `enabledModules`). `hidden`: menu entries (hrefs) of the modules
 * switched off one by one (shown locked).
 */
export const SPARK_COLLECTION = "_spark";
const ID = "modules";

type Rec = { id: string; enabled: string[]; hidden?: string[] };
export type ModuleState = { enabled?: string[]; hidden: string[] };

/**
 * Stored module lists. Single-tenant apps: only `installation`. Multi-tenant apps: the installation
 * (row with tenant "") plus the tenants asked for (every tenant when `tenants` is omitted).
 */
export async function readModules(multiTenant: boolean, tenants?: string[]) {
  const db = getSupabaseAdmin();
  const map = new Map<string, ModuleState>();
  const state = (d?: Rec): ModuleState => ({ enabled: d?.enabled, hidden: d?.hidden ?? [] });
  if (!multiTenant) {
    const { data, error } = await db.from("app_data").select("data").eq("collection", SPARK_COLLECTION).eq("id", ID).maybeSingle();
    if (error) throw error;
    return { installation: state(data?.data as Rec | undefined), tenants: map };
  }
  // one small row per tenant: read them all and filter here (`.in("tenant", [""])` would send an empty list)
  const { data, error } = await db.from("app_data").select("tenant, data").eq("collection", SPARK_COLLECTION).eq("id", ID);
  if (error) throw error;
  let installation = state();
  for (const r of data ?? []) {
    if (tenants && r.tenant !== "" && !tenants.includes(r.tenant as string)) continue;
    if (r.tenant === "") installation = state(r.data as Rec);
    else map.set(r.tenant as string, state(r.data as Rec));
  }
  return { installation, tenants: map };
}

/** Saves modules and hidden entries: `tenant` undefined = single-tenant installation, "" = multi-tenant installation. */
export async function writeModules(enabled: string[], hidden: string[], by: string, tenant?: string) {
  const row: Record<string, unknown> = { collection: SPARK_COLLECTION, id: ID, data: { id: ID, enabled, hidden } satisfies Rec, updated_at: new Date().toISOString(), updated_by: by };
  if (tenant !== undefined) row.tenant = tenant; // single-tenant databases have no tenant column
  const { error } = await getSupabaseAdmin()
    .from("app_data")
    .upsert(row, { onConflict: tenant === undefined ? "collection,id" : "tenant,collection,id" });
  if (error) throw error;
}
