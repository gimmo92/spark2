import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, Anthropic, aiConfigured, claude, requireCaller, throttled, type CallerConfig } from "@spark/core/server";
import { SENIORITIES, SIZES, cleanScope, cleanStats, geoLabel, type BenchmarkInput, type BenchmarkScope, type BenchmarkStats } from "../../lib/benchmark";

const MAX_ROLES = 400;
const BATCH = 40;

const SYSTEM = `Sei un esperto di retribuzioni del mercato del lavoro italiano (compensation & benefits).
Per ogni ruolo stimi la retribuzione annua lorda (RAL) di mercato in euro, a tempo pieno, esclusi variabile e benefit, nel perimetro indicato:
area geografica (tutta Italia, macro-area, regione o città: tieni conto delle differenze territoriali), dimensione dell'azienda, settore e seniority.
Restituisci cinque valori crescenti: minimo, primo quartile, mediana, terzo quartile, massimo del mercato per quel ruolo in quel perimetro.
Usa il titolo del ruolo, il livello e il contratto CCNL (i minimi tabellari sono un pavimento) e la qualifica. Se la seniority è "dal livello CCNL", deducila dal livello.
Se il settore non è indicato, riconoscilo dall'insieme dei ruoli e dei contratti (es. assicurativo, tecnologia, servizi ambientali), usalo per le stime e restituiscilo in "settore" (due o tre parole, in italiano).
Restituisci un elemento per ogni ruolo ricevuto, con lo stesso "index".`;

const Answer = z.object({
  settore: z.string(),
  roles: z.array(
    z.object({
      index: z.number().int(),
      min: z.number(),
      q1: z.number(),
      median: z.number(),
      q3: z.number(),
      max: z.number(),
    }),
  ),
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** The scope as the model reads it. */
function scopeText(s: BenchmarkScope) {
  const find = <T extends { id: string; label: string }>(list: readonly T[], id: string) => list.find((x) => x.id === id)?.label ?? id;
  return [
    `Area geografica: ${geoLabel(s)}`,
    `Dimensione azienda: ${s.size ? find(SIZES, s.size) : "qualsiasi"}`,
    `Settore: ${s.sector || "non indicato"}`,
    `Seniority: ${find(SENIORITIES, s.seniority)}`,
  ].join("\n");
}

async function estimate(client: ReturnType<typeof claude>, roles: BenchmarkInput[], offset: number, scope: BenchmarkScope) {
  const list = roles.map((r, i) => ({
    index: offset + i,
    ruolo: r.role,
    ...(r.level && { livello: r.level }),
    ...(r.ccnl && { ccnl: r.ccnl }),
    ...(r.qualification && { qualifica: r.qualification }),
  }));
  const message = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Answer) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Perimetro:\n${scopeText(scope)}\n\nRuoli (JSON):\n${JSON.stringify(list)}` }],
  });
  if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
  return message.parsed_output;
}

/**
 * POST /api/transparency/benchmark `{ roles, scope }`: market salary range of each role in a scope
 * (geography, company size, sector, seniority), estimated by Claude from title, CCNL level and
 * qualification (no names, no company pay). Needs
 * `transparency.manage` and ANTHROPIC_API_KEY.
 */
export function createBenchmarkRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!aiConfigured()) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { roles?: unknown; scope?: unknown } | null;
    if (!Array.isArray(body?.roles) || !body.roles.length || body.roles.length > MAX_ROLES) return NextResponse.json({ error: "body" }, { status: 400 });
    const roles: BenchmarkInput[] = [];
    for (const raw of body.roles as Record<string, unknown>[]) {
      const role = text(raw?.role, 120);
      if (!role) return NextResponse.json({ error: "body" }, { status: 400 });
      roles.push({ role, level: text(raw.level, 60), ccnl: text(raw.ccnl, 80), qualification: text(raw.qualification, 60) });
    }
    const scope = cleanScope(body.scope);
    if (throttled(`bench:${caller.tenant ?? ""}`, 20)) return NextResponse.json({ error: "rate" }, { status: 429 });

    const client = claude();
    const batches: BenchmarkInput[][] = [];
    for (let i = 0; i < roles.length; i += BATCH) batches.push(roles.slice(i, i + BATCH));
    try {
      const results = await Promise.all(batches.map((b, i) => estimate(client, b, i * BATCH, scope)));
      const out: { role: string; stats: BenchmarkStats | null }[] = [];
      for (const a of results.flatMap((x) => x.roles)) {
        const r = roles[a.index];
        if (!r || out.some((o) => o.role === r.role)) continue;
        out.push({ role: r.role, stats: cleanStats(a) });
      }
      const sector = scope.sector || results[0]?.settore.trim().slice(0, 60) || undefined;
      return NextResponse.json({ roles: out, scope, sector, source: AI_MODEL });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("benchmark failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
