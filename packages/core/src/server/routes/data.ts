import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "../../auth/require";
import { collectionsOf, type Doc, type SparkConfig } from "../../config";
import type { DataChanges } from "../../data/sync";
import { adminConfigured, getSupabaseAdmin } from "../../supabase/admin";
import { authConfigured } from "../../supabase/env";

const PAGE = 1000;
const CHUNK = 500;

async function guard() {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return auth;
}

/**
 * /api/data for one app: GET returns every collection, POST applies { upserts, deletes }.
 * Only the collections declared by the app's config (core + modules) are accepted.
 */
export function createDataRoute(config: Pick<SparkConfig, "modules">) {
  const collections = collectionsOf(config);
  const allowed = (c: string) => collections.includes(c);

  async function GET() {
    const auth = await guard();
    if (auth instanceof NextResponse) return auth;

    const db = getSupabaseAdmin();
    const out: Record<string, unknown[]> = Object.fromEntries(collections.map((c) => [c, []]));
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("app_data")
        .select("collection, data")
        .in("collection", collections)
        .order("collection")
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      for (const row of data) out[row.collection]?.push(row.data);
      if (data.length < PAGE) break;
    }
    const empty = Object.values(out).every((v) => v.length === 0);
    return NextResponse.json({ data: out, empty });
  }

  async function POST(request: NextRequest) {
    const auth = await guard();
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => null)) as DataChanges | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "body" }, { status: 400 });

    const db = getSupabaseAdmin().from("app_data");
    const now = new Date().toISOString();

    const rows: Array<{ collection: string; id: string; data: Doc; updated_at: string; updated_by: string }> = [];
    for (const [c, items] of Object.entries(body.upserts ?? {})) {
      if (!allowed(c) || !Array.isArray(items)) return NextResponse.json({ error: "body" }, { status: 400 });
      for (const item of items) {
        const id = (item as { id?: unknown })?.id;
        if (typeof id !== "string" || !id) return NextResponse.json({ error: "body" }, { status: 400 });
        rows.push({ collection: c, id, data: item, updated_at: now, updated_by: auth.email });
      }
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db.upsert(rows.slice(i, i + CHUNK), { onConflict: "collection,id" });
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
    }

    for (const [c, ids] of Object.entries(body.deletes ?? {})) {
      if (!allowed(c) || !Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
        return NextResponse.json({ error: "body" }, { status: 400 });
      }
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await db.delete().eq("collection", c).in("id", ids.slice(i, i + CHUNK));
        if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
      }
    }

    return NextResponse.json({ ok: true, saved: rows.length });
  }

  return { GET, POST };
}
