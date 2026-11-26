import "server-only";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "../supabase/admin";
import { isStaff } from "./access";

/** Tenant picked by Spark staff in a multi-tenant app (ignored for everybody else). */
export const TENANT_COOKIE = "spark_tenant";

export interface TenantInfo {
  /** "" = no tenant (single-tenant app, or staff who hasn't picked one). */
  tenant: string;
  name?: string;
  /** Spark staff: emails in SPARK_STAFF_EMAILS. In a multi-tenant app they manage every tenant. */
  staff: boolean;
}

/**
 * The caller's tenant, decided on the server only: staff use the tenant they picked (cookie, checked
 * against public.tenants); everybody else belongs to the tenant of the invite they registered with.
 * In a single-tenant database there is no tenant column: everybody gets "".
 */
export async function resolveTenant(email: string): Promise<TenantInfo> {
  const staff = isStaff(email);
  const db = getSupabaseAdmin();
  let id = "";
  if (staff) {
    id = (await cookies()).get(TENANT_COOKIE)?.value ?? "";
  } else {
    // select("*"): single-tenant databases have no tenant column
    const { data } = await db.from("registration_invites").select("*").eq("email", email).maybeSingle();
    id = typeof data?.tenant === "string" ? data.tenant : "";
  }
  if (!id) return { tenant: "", staff };
  const { data } = await db.from("tenants").select("id, name").eq("id", id).maybeSingle();
  // a deleted tenant gives no access
  return data ? { tenant: data.id as string, name: data.name as string, staff } : { tenant: "", staff };
}
