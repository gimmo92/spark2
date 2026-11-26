import "server-only";
import { NextResponse } from "next/server";
import { adminConfigured } from "../supabase/admin";
import { authConfigured } from "../supabase/env";
import { isStaff } from "./access";
import { requireUser } from "./require";

/** For API routes reserved to Spark staff (SPARK_STAFF_EMAILS): the response to return, or the caller. */
export async function requireStaff(): Promise<NextResponse | { email: string }> {
  if (!authConfigured || !adminConfigured()) return NextResponse.json({ error: "config" }, { status: 503 });
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isStaff(auth.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return { email: auth.email };
}
