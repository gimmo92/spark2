import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "../../auth/staff";
import type { SparkConfig } from "../../config";
import type { SparkPanelDTO } from "../../spark/panel";
import { getSupabaseAdmin } from "../../supabase/admin";
import { readModules, writeModules } from "../modules";

type AppConfig = Pick<SparkConfig, "modules" | "multiTenant" | "tenantModules">;

const code = (e: unknown) => (e as { code?: string }).code;

/**
 * /api/spark, Spark staff only (SPARK_STAFF_EMAILS): modules switched on for the installation and,
 * in multi-tenant apps, for each company. Applied by /api/data on every request.
 */
export function createSparkRoute(config: AppConfig) {
  const ids = config.modules.map((m) => m.id);

  async function GET() {
    const auth = await requireStaff();
    if (auth instanceof NextResponse) return auth;
    try {
      const stored = await readModules(!!config.multiTenant);
      const body: SparkPanelDTO = {
        modules: config.modules.map((m) => ({ id: m.id, label: m.label ?? m.id })),
        installation: (stored.installation.enabled ?? ids).filter((id) => ids.includes(id)),
        multiTenant: !!config.multiTenant,
        tenantModules: Object.fromEntries([...stored.tenants].filter(([, t]) => t.enabled).map(([id, t]) => [id, t.enabled!])),
        tenantDefault: config.tenantModules,
        installationHidden: stored.installation.hidden,
        tenantHidden: Object.fromEntries([...stored.tenants].map(([id, t]) => [id, t.hidden])),
      };
      return NextResponse.json(body);
    } catch (e) {
      return NextResponse.json({ error: "table", detail: code(e) }, { status: 503 });
    }
  }

  /** `{ modules, hidden }` for the installation, `{ tenant, modules, hidden }` for one company (multi-tenant apps). */
  async function PUT(request: NextRequest) {
    const auth = await requireStaff();
    if (auth instanceof NextResponse) return auth;
    const body = (await request.json().catch(() => null)) as { modules?: unknown; hidden?: unknown; tenant?: unknown } | null;
    const list = body?.modules;
    if (!Array.isArray(list) || list.some((x) => typeof x !== "string" || !ids.includes(x))) return NextResponse.json({ error: "body" }, { status: 400 });
    const modules = ids.filter((id) => list.includes(id));
    const rawHidden = Array.isArray(body?.hidden) ? body.hidden : [];
    if (rawHidden.length > 200 || rawHidden.some((x) => typeof x !== "string" || !x.startsWith("/") || x.length > 200)) return NextResponse.json({ error: "body" }, { status: 400 });
    const hidden = [...new Set(rawHidden as string[])];
    const tenant = typeof body?.tenant === "string" && body.tenant ? body.tenant : undefined;
    try {
      if (tenant) {
        if (!config.multiTenant) return NextResponse.json({ error: "body" }, { status: 400 });
        const { data, error } = await getSupabaseAdmin().from("tenants").select("id").eq("id", tenant).maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: "missing" }, { status: 404 });
        await writeModules(modules, hidden, auth.email, tenant);
      } else {
        await writeModules(modules, hidden, auth.email, config.multiTenant ? "" : undefined);
      }
    } catch (e) {
      return NextResponse.json({ error: "table", detail: code(e) }, { status: 503 });
    }
    return NextResponse.json({ ok: true, modules, hidden });
  }

  return { GET, PUT };
}
