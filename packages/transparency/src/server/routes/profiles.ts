import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, Anthropic, aiConfigured, claude, requireCaller, throttled, type CallerConfig } from "@spark/core/server";

const MAX_ROLES = 400;
const BATCH = 25;

const SYSTEM = `Sei un esperto di organizzazione e job evaluation. Per ogni ruolo aziendale scrivi:
- "descrizione": job description sintetica in italiano (3-4 frasi): scopo del ruolo, attività principali, responsabilità (su persone, risultati, budget, sicurezza), condizioni di lavoro tipiche;
- "competenze": da 5 a 8 competenze richieste (conoscenze tecniche, titoli o certificazioni, capacità), brevi, in italiano.
Basati su titolo, livello e contratto CCNL, qualifica ed eventuale descrizione esistente; resta neutro rispetto al genere e non inventare dettagli specifici dell'azienda.
Restituisci un elemento per ogni ruolo ricevuto, con lo stesso "index".`;

const Answer = z.object({
  roles: z.array(z.object({ index: z.number().int(), descrizione: z.string(), competenze: z.array(z.string()) })),
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
type Input = { role: string; level?: string; ccnl?: string; qualification?: string; description?: string };

async function enrich(client: ReturnType<typeof claude>, roles: Input[], offset: number) {
  const list = roles.map((r, i) => ({
    index: offset + i,
    ruolo: r.role,
    ...(r.level && { livello: r.level }),
    ...(r.ccnl && { ccnl: r.ccnl }),
    ...(r.qualification && { qualifica: r.qualification }),
    ...(r.description && { descrizione_esistente: r.description }),
  }));
  const message = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Ruoli (JSON):\n${JSON.stringify(list)}` }],
  });
  if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
  return message.parsed_output.roles;
}

/**
 * POST /api/transparency/role-profiles `{ roles }`: job description and required skills of each role
 * (titles and CCNL context only, never people data), to make the role weighting more accurate. Needs
 * `transparency.manage`; the app saves the profiles and lets HR edit them.
 */
export function createRoleProfilesRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!aiConfigured()) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { roles?: unknown } | null;
    if (!Array.isArray(body?.roles) || !body.roles.length || body.roles.length > MAX_ROLES) return NextResponse.json({ error: "body" }, { status: 400 });
    const roles: Input[] = [];
    for (const raw of body.roles as Record<string, unknown>[]) {
      const role = text(raw?.role, 120);
      if (!role) return NextResponse.json({ error: "body" }, { status: 400 });
      roles.push({ role, level: text(raw.level, 60), ccnl: text(raw.ccnl, 80), qualification: text(raw.qualification, 60), description: text(raw.description, 600) });
    }
    if (throttled(`profiles:${caller.tenant ?? ""}`, 10)) return NextResponse.json({ error: "rate" }, { status: 429 });

    const client = claude();
    const batches: Input[][] = [];
    for (let i = 0; i < roles.length; i += BATCH) batches.push(roles.slice(i, i + BATCH));
    try {
      const answers = (await Promise.all(batches.map((b, i) => enrich(client, b, i * BATCH)))).flat();
      const out: { role: string; description: string; skills: string[] }[] = [];
      for (const a of answers) {
        const r = roles[a.index];
        if (!r || out.some((o) => o.role === r.role)) continue;
        out.push({
          role: r.role,
          description: a.descrizione.trim().slice(0, 1200),
          skills: [...new Set(a.competenze.map((s) => s.trim().slice(0, 80)).filter(Boolean))].slice(0, 10),
        });
      }
      return NextResponse.json({ roles: out });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("role profiles failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
