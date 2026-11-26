import { NextResponse, type NextRequest } from "next/server";
import { accessRulesOf, canRead, canWrite, canWriteUser } from "../../access/rules";
import type { Viewer } from "../../auth/viewer";
import { collectionsOf, type Doc } from "../../config";
import { requireCaller, type Caller, type CallerConfig } from "../caller";
import type { DataChanges, ViewerDTO } from "../../data/sync";
import { getSupabaseAdmin } from "../../supabase/admin";

const PAGE = 1000;
const CHUNK = 500;

type AppConfig = CallerConfig;
const guard = requireCaller;

const info = (v: Caller): ViewerDTO => ({
  email: v.email,
  userId: v.userId,
  level: v.level,
  isAdmin: v.isAdmin,
  staff: v.staff,
  modules: v.modules,
  ...(v.tenant !== undefined ? { tenant: v.tenant, tenantName: v.tenantName } : {}),
});

/**
 * /api/data for one app. GET returns only what the logged-in user may read; POST applies the
 * { upserts, deletes } the user may write and reports how many were refused. Permissions are enforced
 * here, on the server, with the rules declared by the core and the modules (screens only hide actions).
 */
export function createDataRoute(config: AppConfig) {
  const known = collectionsOf(config);
  /** Collections and rules of the modules on for the caller. */
  const scopeOf = (v: Caller) => {
    const scoped = { ...config, modules: config.modules.filter((m) => v.modules.includes(m.id)) };
    return { collections: collectionsOf(scoped), rules: accessRulesOf(scoped) };
  };

  function readable(rules: ReturnType<typeof accessRulesOf>, v: Viewer, c: string, doc: Doc) {
    if (v.isAdmin) return true;
    if (c === "settings") return true; // configuration (levels, module settings) is needed by every screen
    if (c === "users" && doc.id === v.userId) return true; // everyone sees their own record
    return canRead(rules.collections[c], v.person, doc, v.can, v.byId);
  }

  function writable(rules: ReturnType<typeof accessRulesOf>, v: Viewer, c: string, before: Doc | undefined, after: Doc | undefined) {
    if (v.isAdmin) return true;
    if (c === "settings") {
      const perms = rules.settings[(before ?? after)!.id];
      return !!perms?.some((p) => v.can(v.person, p));
    }
    if (c === "users") return canWriteUser(v.person, before, after, v.can, v.byId);
    return canWrite(rules.collections[c], v.person, before, after, v.can, v.byId);
  }

  async function GET() {
    const v = await guard(config);
    if (v instanceof NextResponse) return v;

    const { collections, rules } = scopeOf(v);
    const db = getSupabaseAdmin();
    const out: Record<string, Doc[]> = Object.fromEntries(collections.map((c) => [c, []]));
    let total = 0;
    for (let from = 0; ; from += PAGE) {
      const q = db.from("app_data").select("collection, data");
      const { data, error } = await (v.tenant === undefined ? q : q.eq("tenant", v.tenant))
        .in("collection", collections)
        .order("collection")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      total += data.length;
      for (const row of data) if (readable(rules, v, row.collection, row.data as Doc)) out[row.collection]?.push(row.data as Doc);
      if (data.length < PAGE) break;
    }
    // only an admin uploads the initial data of an empty database
    return NextResponse.json({ data: out, empty: total === 0 && v.isAdmin, viewer: info(v) });
  }

  async function POST(request: NextRequest) {
    const v = await guard(config);
    if (v instanceof NextResponse) return v;

    const body = (await request.json().catch(() => null)) as DataChanges | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "body" }, { status: 400 });

    const { collections, rules } = scopeOf(v);
    const allowed = (c: string) => known.includes(c);
    // collections of a module switched off: refused like a missing permission
    let rejected = 0;
    const on = <T,>([c, list]: [string, T[]]) => {
      if (collections.includes(c)) return true;
      rejected += Array.isArray(list) ? list.length : 0;
      return false;
    };
    const allUpserts = Object.entries(body.upserts ?? {});
    const allDeletes = Object.entries(body.deletes ?? {});
    for (const [c, items] of allUpserts) {
      if (!allowed(c) || !Array.isArray(items) || items.some((x) => typeof (x as Doc)?.id !== "string" || !(x as Doc).id))
        return NextResponse.json({ error: "body" }, { status: 400 });
    }
    for (const [c, ids] of allDeletes) {
      if (!allowed(c) || !Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return NextResponse.json({ error: "body" }, { status: 400 });
    }
    const upserts = allUpserts.filter(on);
    const deletes = allDeletes.filter(on);

    const table = () => getSupabaseAdmin().from("app_data");
    const tenant = v.tenant;
    // multi-tenant apps: every query is restricted to the caller's tenant
    const select = () => {
      const q = table().select("id, data");
      return tenant === undefined ? q : q.eq("tenant", tenant);
    };
    const remove = () => {
      const q = table().delete();
      return tenant === undefined ? q : q.eq("tenant", tenant);
    };

    /** Stored versions of the touched records: permissions are checked on the old owners too. */
    async function stored(c: string, ids: string[]) {
      const map = new Map<string, Doc>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await select().eq("collection", c).in("id", ids.slice(i, i + CHUNK));
        if (error) throw error;
        for (const r of data) map.set(r.id, r.data as Doc);
      }
      return map;
    }

    const now = new Date().toISOString();
    const rows: Array<{ collection: string; id: string; data: Doc; updated_at: string; updated_by: string; tenant?: string }> = [];
    const toDelete: Array<[string, string[]]> = [];
    try {
      for (const [c, items] of upserts) {
        const before = v.isAdmin ? new Map<string, Doc>() : await stored(c, items.map((x) => x.id));
        for (const item of items) {
          if (writable(rules, v, c, before.get(item.id), item)) rows.push({ collection: c, id: item.id, data: item, updated_at: now, updated_by: v.email, ...(tenant !== undefined && { tenant }) });
          else rejected++;
        }
      }
      for (const [c, ids] of deletes) {
        if (v.isAdmin) {
          if (ids.length) toDelete.push([c, ids]);
          continue;
        }
        const before = await stored(c, ids);
        const ok = ids.filter((id) => before.has(id) && writable(rules, v, c, before.get(id), undefined));
        rejected += ids.length - ok.length;
        if (ok.length) toDelete.push([c, ok]);
      }
    } catch (e) {
      return NextResponse.json({ error: "table", detail: (e as { code?: string }).code }, { status: 503 });
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await table().upsert(rows.slice(i, i + CHUNK), { onConflict: tenant === undefined ? "collection,id" : "tenant,collection,id" });
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
    }
    for (const [c, ids] of toDelete) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await remove().eq("collection", c).in("id", ids.slice(i, i + CHUNK));
        if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: true, saved: rows.length, rejected });
  }

  return { GET, POST };
}
