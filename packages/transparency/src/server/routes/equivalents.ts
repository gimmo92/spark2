import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, Anthropic, aiConfigured, claude, requireCaller, throttled, type CallerConfig } from "@spark/core/server";

const SYSTEM = `Ricevi un ruolo aziendale. Elenca i job title con cui lo STESSO lavoro compare sul mercato del lavoro italiano (annunci, survey retributive, profili professionali):
sinonimi, sigle, nomi inglesi usati in Italia, varianti di scrittura. Esempio: "SDR" → "BDR", "Sales Development Representative", "Business Development Representative", "Appointment Setter".
Escludi titoli con funzione diversa o con seniority / responsabilità diversa (es. per un SDR non "Sales Manager" né "Account Executive").
Da 3 a 10 titoli, i più diffusi, senza ripetere il ruolo ricevuto. Se il titolo è ambiguo, interpretalo con livello e qualifica indicati.`;

const Answer = z.object({ sinonimi: z.array(z.string()) });

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * POST /api/transparency/equivalents `{ role, level?, qualification? }`: market synonyms of a job
 * title (abbreviations, Italian / English variants). The app stores the answer, so the same role
 * always gets the same set until someone changes and saves it; the set is used to search the market.
 */
export function createEquivalentsRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!aiConfigured()) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const role = text(body?.role, 120);
    if (!role) return NextResponse.json({ error: "body" }, { status: 400 });
    const level = text(body?.level, 60);
    const qualification = text(body?.qualification, 60);
    if (throttled(`equiv:${caller.tenant ?? ""}`, 60)) return NextResponse.json({ error: "rate" }, { status: 429 });

    try {
      const message = await claude().beta.messages.parse({
        model: AI_MODEL,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
        system: SYSTEM,
        messages: [{ role: "user", content: [`Ruolo: ${role}`, level && `Livello: ${level}`, qualification && `Qualifica: ${qualification}`].filter(Boolean).join("\n") }],
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
      const own = role.toLowerCase();
      const seen = new Set<string>();
      const titles = message.parsed_output.sinonimi
        .map((t) => t.trim().slice(0, 120))
        .filter((t) => t && t.toLowerCase() !== own && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
        .slice(0, 10)
        .sort((a, b) => a.localeCompare(b, "it"));
      return NextResponse.json({ titles });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("equivalent titles failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
