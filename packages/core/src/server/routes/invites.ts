import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "../../auth/require";
import { loadViewer } from "../../auth/viewer";
import { sendInviteEmail, sendgridConfigured } from "../../email/sendgrid";
import { adminConfigured, getSupabaseAdmin } from "../../supabase/admin";
import { authConfigured } from "../../supabase/env";

import type { InviteDTO } from "../../people/invites";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid typos

/** 8 random characters shown as XXXX-XXXX (~40 bits, single use). */
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Logged-in user with "people.create" (invites carry registration codes: nobody else sees them). */
async function guard() {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const viewer = await loadViewer(auth.email, { modules: [] });
  if ("error" in viewer) return NextResponse.json({ error: "config" }, { status: 503 });
  if (!viewer.can(viewer.person, "people.create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // non-admins only deal with the people they can see
  const visible = new Set(
    viewer.users.filter((u) => viewer.isAdmin || viewer.can(viewer.person, "people.view", u)).map((u) => u.email.toLowerCase()),
  );
  return { ...auth, isAdmin: viewer.isAdmin, visible };
}

/** List all invites (status + code) for the user list and profiles. */
export async function GET() {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await getSupabaseAdmin()
    .from("registration_invites")
    .select("email, code, sent_at, registered_at")
    .order("sent_at", { ascending: false });
  if (error) return NextResponse.json({ error: "config" }, { status: 503 });
  const invites = (data as InviteDTO[]).filter((i) => auth.isAdmin || auth.visible.has(i.email));
  return NextResponse.json({ invites });
}

/** Send (or re-send) the registration email. The code is created once and reused on re-send. */
export async function POST(request: NextRequest) {
  const auth = await guard();
  if (auth instanceof NextResponse) return auth;
  if (!sendgridConfigured()) return NextResponse.json({ error: "email_config" }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; fullName?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim() || null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "email" }, { status: 400 });
  if (!auth.isAdmin && !auth.visible.has(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = getSupabaseAdmin().from("registration_invites");
  const { data: existing, error: readError } = await db.select("email, code, sent_at, registered_at").eq("email", email).maybeSingle();
  if (readError) return NextResponse.json({ error: "config" }, { status: 503 });
  if (existing?.registered_at) return NextResponse.json({ error: "registered" }, { status: 409 });

  const code = existing?.code ?? newCode();
  const link = `${request.nextUrl.origin}/registrazione?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
  try {
    await sendInviteEmail({ to: email, name: fullName ?? undefined, code, link });
  } catch (e) {
    console.error("invite email failed", e);
    return NextResponse.json({ error: "send" }, { status: 502 });
  }

  const row = { email, code, full_name: fullName, invited_by: auth.email, sent_at: new Date().toISOString() };
  const { data, error } = await db.upsert(row, { onConflict: "email" }).select("email, code, sent_at, registered_at").single();
  if (error) return NextResponse.json({ error: "config" }, { status: 503 });
  return NextResponse.json({ invite: data as InviteDTO });
}
