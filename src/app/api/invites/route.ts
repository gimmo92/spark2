import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { sendInviteEmail, sendgridConfigured } from "@/lib/email/sendgrid";
import { adminConfigured, getSupabaseAdmin } from "@/lib/supabase/admin";
import { authConfigured } from "@/lib/supabase/env";

import type { InviteDTO } from "@/lib/invites";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid typos

/** 8 random characters shown as XXXX-XXXX (~40 bits, single use). */
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

async function guard() {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return auth;
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
  return NextResponse.json({ invites: data as InviteDTO[] });
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
