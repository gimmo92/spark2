import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCaller, type CallerConfig } from "@spark/core/server";
import { CRITERIA, normalizeScores, type RoleInput, type RoleScores } from "../../lib/roleWeights";

const MODEL = "claude-opus-5-5";
const MAX_ROLES = 400;
const BATCH = 40;

const SYSTEM = `Sei un esperto di valutazione delle posizioni (job evaluation) per la direttiva UE 2023/970 sulla trasparenza retributiva.
Valuti ruoli aziendali per stabilire quali svolgono "lavoro di pari valore" (art. 4), con quattro criteri oggettivi e neutri rispetto al genere:
${CRITERIA.map((c) => `- ${c.id}: ${c.label} (${c.hint})`).join("\n")}

Per ogni ruolo dai un punteggio intero da 1 (minimo) a 10 (massimo) su ciascun criterio, confrontando i ruoli tra loro sulla stessa scala.
Basati sul contenuto del lavoro (titolo, livello e contratto CCNL, qualifica, descrizione se presente), mai sulla retribuzione o su chi lo svolge.
Se un titolo è ambiguo, usa livello e qualifica per stimare il contenuto e dillo nella motivazione.
Motivazione: una frase in italiano, al massimo 25 parole, sui fattori che pesano di più.
Restituisci un elemento per ogni ruolo ricevuto, con lo stesso "index".`;

const Answer = z.object({
  roles: z.array(
    z.object({
      index: z.number().int(),
      competenze: z.number().int(),
      responsabilita: z.number().int(),
      impegno: z.number().int(),
      condizioni: z.number().int(),
      motivazione: z.string(),
    }),
  ),
});

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Recent calls per tenant (best effort, per server instance): a weighting is not a chat. */
const recent = new Map<string, number[]>();
function throttled(key: string) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 10) return true;
  recent.set(key, [...list, now]);
  return false;
}

async function weigh(client: Anthropic, roles: RoleInput[], offset: number) {
  const list = roles.map((r, i) => ({
    index: offset + i,
    ruolo: r.role,
    persone: r.n,
    ...(r.level && { livello: r.level }),
    ...(r.ccnl && { ccnl: r.ccnl }),
    ...(r.qualification && { qualifica: r.qualification }),
    ...(r.description && { descrizione: r.description }),
  }));
  const message = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // on a policy decline the API retries on a suitable model inside the same call
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(Answer) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Ruoli da valutare (JSON):\n${JSON.stringify(list)}` }],
  });
  if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
  return message.parsed_output.roles;
}

/**
 * POST /api/transparency/roles: proposes the job-evaluation scores of the roles sent (titles and
 * CCNL context only, never names or pay). Needs `transparency.manage` and the module on; the HR team
 * reviews and confirms the proposals in the app.
 */
export function createRoleWeightsRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { roles?: unknown } | null;
    if (!Array.isArray(body?.roles) || !body.roles.length || body.roles.length > MAX_ROLES) return NextResponse.json({ error: "body" }, { status: 400 });
    const roles: RoleInput[] = [];
    for (const raw of body.roles as Record<string, unknown>[]) {
      const role = text(raw?.role, 120);
      if (!role) return NextResponse.json({ error: "body" }, { status: 400 });
      roles.push({
        role,
        n: Math.max(1, Math.round(Number(raw.n) || 1)),
        level: text(raw.level, 60),
        ccnl: text(raw.ccnl, 80),
        qualification: text(raw.qualification, 60),
        description: text(raw.description, 300),
      });
    }
    if (throttled(caller.tenant ?? "")) return NextResponse.json({ error: "rate" }, { status: 429 });

    const client = new Anthropic();
    const batches: RoleInput[][] = [];
    for (let i = 0; i < roles.length; i += BATCH) batches.push(roles.slice(i, i + BATCH));
    try {
      const answers = (await Promise.all(batches.map((b, i) => weigh(client, b, i * BATCH)))).flat();
      const out: { role: string; scores: RoleScores; rationale: string }[] = [];
      for (const a of answers) {
        const r = roles[a.index];
        if (!r || out.some((o) => o.role === r.role)) continue;
        out.push({ role: r.role, scores: normalizeScores(a), rationale: a.motivazione.trim().slice(0, 300) });
      }
      return NextResponse.json({ roles: out });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("role weighting failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
