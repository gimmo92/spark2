import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { adminConfigured, getSupabaseAdmin } from "@/lib/supabase/admin";
import { authConfigured } from "@/lib/supabase/env";
import { COLLECTIONS, type Collection, type DataChanges } from "@/lib/sync";

const isCollection = (c: unknown): c is Collection => typeof c === "string" && (COLLECTIONS as readonly string[]).includes(c);
const PAGE = 1000;
const CHUNK = 500;

async function guard() {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return auth;
}

/** All app data, grouped by collection. `empty: true` when nothing has been saved yet. */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;

  const db = getSupabaseAdmin();
  const out: Record<Collection, unknown[]> = { users: [], schede: [], objectives: [], presets: [], workflows: [], settings: [] };
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("app_data")
      .select("collection, data")
      .order("collection")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
    for (const row of data) if (isCollection(row.collection)) out[row.collection].push(row.data);
    if (data.length < PAGE) break;
  }
  const empty = Object.values(out).every((v) => v.length === 0);
  return NextResponse.json({ data: out, empty });
}

/** Apply upserts and deletes: { upserts: { users: [{id,...}] }, deletes: { users: ["id"] } }. */
export async function POST(request: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as DataChanges | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "body" }, { status: 400 });

  const db = getSupabaseAdmin().from("app_data");
  const now = new Date().toISOString();

  const rows: Array<{ collection: Collection; id: string; data: unknown; updated_at: string; updated_by: string }> = [];
  for (const [c, items] of Object.entries(body.upserts ?? {})) {
    if (!isCollection(c) || !Array.isArray(items)) return NextResponse.json({ error: "body" }, { status: 400 });
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
    if (!isCollection(c) || !Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
      return NextResponse.json({ error: "body" }, { status: 400 });
    }
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error } = await db.delete().eq("collection", c).in("id", ids.slice(i, i + CHUNK));
      if (error) return NextResponse.json({ error: "table", detail: error.code }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
