import { NextResponse, type NextRequest } from "next/server";
import { accessRulesOf, canRead, canWrite, canWriteUser } from "../../access/rules";
import { requireUser } from "../../auth/require";
import { loadViewer, type Viewer } from "../../auth/viewer";
import { collectionsOf, type Doc, type SparkConfig } from "../../config";
import type { DataChanges, ViewerDTO } from "../../data/sync";
import { adminConfigured, getSupabaseAdmin } from "../../supabase/admin";
import { authConfigured } from "../../supabase/env";

const PAGE = 1000;
const CHUNK = 500;

type AppConfig = Pick<SparkConfig, "modules" | "permissions"> & { org?: SparkConfig["org"] };

async function guard(config: AppConfig): Promise<NextResponse | Viewer> {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const viewer = await loadViewer(auth.email, config);
  if ("error" in viewer) return NextResponse.json({ error: viewer.error }, { status: 503 });
  if (!viewer.person) return NextResponse.json({ error: "unlinked" }, { status: 403 });
  return viewer;
}

const info = (v: Viewer): ViewerDTO => ({ email: v.email, userId: v.userId, level: v.level, isAdmin: v.isAdmin });

/**
 * /api/data for one app. GET returns only what the logged-in user may read; POST applies the
 * { upserts, deletes } the user may write and reports how many were refused. Permissions are enforced
 * here, on the server, with the rules declared by the core and the modules (screens only hide actions).
 */
export function createDataRoute(config: AppConfig) {
  const collections = collectionsOf(config);
  const allowed = (c: string) => collections.includes(c);
  const rules = accessRulesOf(config);

  function readable(v: Viewer, c: string, doc: Doc) {
    if (v.isAdmin) return true;
    if (c === "settings") return true; // configuration (levels, module settings) is needed by every screen
    if (c === "users" && doc.id === v.userId) return true; // everyone sees their own record
    return canRead(rules.collections[c], v.person, doc, v.can, v.byId);
  }

  function writable(v: Viewer, c: string, before: Doc | undefined, after: Doc | undefined) {
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

    const db = getSupabaseAdmin();
    const out: Record<string, Doc[]> = Object.fromEntries(collections.map((c) => [c, []]));
    let total = 0;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("app_data")
        .select("collection, data")
        .in("collection", collections)
        .order("collection")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      total += data.length;
      for (const row of data) if (readable(v, row.collection, row.data as Doc)) out[row.collection]?.push(row.data as Doc);
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

    const upserts = Object.entries(body.upserts ?? {});
    const deletes = Object.entries(body.deletes ?? {});
    for (const [c, items] of upserts) {
      if (!allowed(c) || !Array.isArray(items) || items.some((x) => typeof (x as Doc)?.id !== "string" || !(x as Doc).id))
        return NextResponse.json({ error: "body" }, { status: 400 });
    }
    for (const [c, ids] of deletes) {
      if (!allowed(c) || !Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return NextResponse.json({ error: "body" }, { status: 400 });
    }

    const table = () => getSupabaseAdmin().from("app_data");

    /** Stored versions of the touched records: permissions are checked on the old owners too. */
    async function stored(c: string, ids: string[]) {
      const map = new Map<string, Doc>();
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await table().select("id, data").eq("collection", c).in("id", ids.slice(i, i + CHUNK));
        if (error) throw error;
        for (const r of data) map.set(r.id, r.data as Doc);
      }
      return map;
    }

    const now = new Date().toISOString();
    const rows: Array<{ collection: string; id: string; data: Doc; updated_at: string; updated_by: string }> = [];
    const toDelete: Array<[string, string[]]> = [];
    let rejected = 0;
    try {
      for (const [c, items] of upserts) {
        const before = v.isAdmin ? new Map<string, Doc>() : await stored(c, items.map((x) => x.id));
        for (const item of items) {
          if (writable(v, c, before.get(item.id), item)) rows.push({ collection: c, id: item.id, data: item, updated_at: now, updated_by: v.email });
          else rejected++;
        }
      }
      for (const [c, ids] of deletes) {
        if (v.isAdmin) {
          if (ids.length) toDelete.push([c, ids]);
          continue;
        }
        const before = await stored(c, ids);
        const ok = ids.filter((id) => before.has(id) && writable(v, c, before.get(id), undefined));
        rejected += ids.length - ok.length;
        if (ok.length) toDelete.push([c, ok]);
      }
    } catch (e) {
      return NextResponse.json({ error: "table", detail: (e as { code?: string }).code }, { status: 503 });
    }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await table().upsert(rows.slice(i, i + CHUNK), { onConflict: "collection,id" });
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
    }
    for (const [c, ids] of toDelete) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await table().delete().eq("collection", c).in("id", ids.slice(i, i + CHUNK));
        if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: true, saved: rows.length, rejected });
  }

  return { GET, POST };
}
