import "server-only";
import { getSupabaseAdmin } from "../supabase/admin";

/**
 * Modules switched on by Spark staff, stored in app_data (collection "_spark", never served by
 * /api/data): one record for the installation and, in multi-tenant apps, one per tenant. A missing
 * record means the defaults (see `enabledModules`).
 */
export const SPARK_COLLECTION = "_spark";
const ID = "modules";

type Rec = { id: string; enabled: string[] };

/**
 * Stored module lists. Single-tenant apps: only `installation`. Multi-tenant apps: the installation
 * (row with tenant "") plus the tenants asked for (every tenant when `tenants` is omitted).
 */
export async function readModules(multiTenant: boolean, tenants?: string[]) {
  const db = getSupabaseAdmin();
  const map = new Map<string, string[]>();
  if (!multiTenant) {
    const { data, error } = await db.from("app_data").select("data").eq("collection", SPARK_COLLECTION).eq("id", ID).maybeSingle();
    if (error) throw error;
    return { installation: (data?.data as Rec | undefined)?.enabled, tenants: map };
  }
  const q = db.from("app_data").select("tenant, data").eq("collection", SPARK_COLLECTION).eq("id", ID);
  const { data, error } = await (tenants ? q.in("tenant", ["", ...tenants]) : q);
  if (error) throw error;
  let installation: string[] | undefined;
  for (const r of data ?? []) {
    const list = (r.data as Rec).enabled;
    if (r.tenant === "") installation = list;
    else map.set(r.tenant as string, list);
  }
  return { installation, tenants: map };
}

/** Saves a module list: `tenant` undefined = single-tenant installation, "" = multi-tenant installation. */
export async function writeModules(enabled: string[], by: string, tenant?: string) {
  const row: Record<string, unknown> = { collection: SPARK_COLLECTION, id: ID, data: { id: ID, enabled } satisfies Rec, updated_at: new Date().toISOString(), updated_by: by };
  if (tenant !== undefined) row.tenant = tenant; // single-tenant databases have no tenant column
  const { error } = await getSupabaseAdmin()
    .from("app_data")
    .upsert(row, { onConflict: tenant === undefined ? "collection,id" : "tenant,collection,id" });
  if (error) throw error;
}
