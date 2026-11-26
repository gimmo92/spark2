import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { newInviteCode } from "../../auth/inviteCode";
import { requireStaff } from "../../auth/staff";
import { TENANT_COOKIE } from "../../auth/tenant";
import { cookieOptions } from "../../auth/twofa";
import { sendInviteEmail, sendgridConfigured } from "../../email/sendgrid";
import { ADMIN_LEVEL } from "../../access/permissions";
import type { User } from "../../people/data";
import type { TenantDTO } from "../../people/tenants";
import { getSupabaseAdmin } from "../../supabase/admin";

/** Multi-tenant apps only: tenants are managed by Spark staff (SPARK_STAFF_EMAILS). */
const staffOnly = requireStaff;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "azienda";

/** Every tenant with its number of users, and the one the staff member is working on. */
export async function GET() {
  const auth = await staffOnly();
  if (auth instanceof NextResponse) return auth;
  const db = getSupabaseAdmin();
  const [{ data: tenants, error }, { data: users, error: e2 }] = await Promise.all([
    db.from("tenants").select("id, name, plan, created_at").order("created_at", { ascending: false }),
    db.from("app_data").select("tenant").eq("collection", "users").limit(100000),
  ]);
  if (error || e2) return NextResponse.json({ error: "config" }, { status: 503 });
  const count = new Map<string, number>();
  for (const u of users ?? []) count.set(u.tenant as string, (count.get(u.tenant as string) ?? 0) + 1);
  const list: TenantDTO[] = (tenants ?? []).map((t) => ({ ...(t as Omit<TenantDTO, "users">), users: count.get(t.id as string) ?? 0 }));
  return NextResponse.json({ tenants: list, current: (await cookies()).get(TENANT_COOKIE)?.value ?? "" });
}

/**
 * New tenant: creates the company, its first user (level ADMIN) and the registration invite, then
 * emails the invite. The new admin then invites their own colleagues from the user list.
 */
export async function POST(request: NextRequest) {
  const auth = await staffOnly();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { name?: string; firstName?: string; lastName?: string; email?: string };
  const name = String(body.name ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  if (!firstName || !lastName) return NextResponse.json({ error: "person" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "email" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: existing, error: readError } = await db.from("registration_invites").select("email").eq("email", email).maybeSingle();
  if (readError) return NextResponse.json({ error: "config" }, { status: 503 });
  if (existing) return NextResponse.json({ error: "taken" }, { status: 409 });

  const id = `${slug(name)}-${crypto.randomUUID().slice(0, 6)}`;
  const now = new Date().toISOString();
  const { error: e1 } = await db.from("tenants").insert({ id, name, created_by: auth.email });
  if (e1) return NextResponse.json({ error: "config" }, { status: 503 });

  const admin: User = {
    id: `u${Date.now()}`,
    firstName,
    lastName,
    email,
    level: ADMIN_LEVEL,
    team: "",
    company: name,
    role: "",
    status: "attivo",
    createdAt: now.slice(0, 10),
  };
  const rows = [
    { tenant: id, collection: "users", id: admin.id, data: admin, updated_at: now, updated_by: auth.email },
    { tenant: id, collection: "settings", id: "org", data: { id: "org", companies: [name] }, updated_at: now, updated_by: auth.email },
  ];
  const code = newInviteCode();
  const [{ error: e2 }, { error: e3 }] = await Promise.all([
    db.from("app_data").insert(rows),
    db.from("registration_invites").insert({ email, code, full_name: `${firstName} ${lastName}`, invited_by: auth.email, sent_at: now, tenant: id }),
  ]);
  if (e2 || e3) return NextResponse.json({ error: "config" }, { status: 503 });

  const tenant: TenantDTO = { id, name, plan: "free", created_at: now, users: 1 };
  if (!sendgridConfigured()) return NextResponse.json({ tenant, warning: "email_config" });
  try {
    const link = `${request.nextUrl.origin}/registrazione?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    await sendInviteEmail({ to: email, name: `${firstName} ${lastName}`, code, link });
  } catch (e) {
    console.error("tenant invite email failed", e);
    return NextResponse.json({ tenant, warning: "send" });
  }
  return NextResponse.json({ tenant });
}

/** Pick the tenant to work on (`id: ""` goes back to the list). */
export async function PUT(request: NextRequest) {
  const auth = await staffOnly();
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? "");
  const jar = await cookies();
  if (!id) {
    jar.delete(TENANT_COOKIE);
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await getSupabaseAdmin().from("tenants").select("id").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "config" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "missing" }, { status: 404 });
  jar.set(TENANT_COOKIE, id, cookieOptions(60 * 60 * 24 * 30));
  return NextResponse.json({ ok: true });
}
