import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, Anthropic, aiConfigured, claude, requireCaller, throttled, type CallerConfig } from "@spark/core/server";

const MAX_CANDIDATES = 600;

const SYSTEM = `Ricevi un ruolo aziendale e un elenco di titoli di lavoro presenti nei dati.
Scegli SOLO i titoli che indicano lo stesso lavoro con un nome diverso (sinonimi, sigle, traduzioni, varianti di scrittura), per esempio "SDR", "BDR", "Sales Development Representative", "Appointment Setter".
Escludi i titoli con funzione diversa o con seniority / responsabilità diversa (es. "Sales Manager" non è un SDR; "Responsabile amministrativo" non è un "Impiegato amministrativo").
Copia i titoli scelti esattamente come scritti nell'elenco. Se nessuno è equivalente, restituisci un elenco vuoto.`;

const Answer = z.object({ equivalenti: z.array(z.string()) });

/**
 * POST /api/transparency/equivalents `{ role, candidates }`: the job titles among `candidates`
 * that are the same job as `role` (only titles, no people data). The app stores the answer, so the
 * same role always gets the same set until someone changes and saves it.
 */
export function createEquivalentsRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!aiConfigured()) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { role?: unknown; candidates?: unknown } | null;
    const role = typeof body?.role === "string" ? body.role.trim().slice(0, 120) : "";
    const raw = Array.isArray(body?.candidates) ? body.candidates : null;
    if (!role || !raw || raw.length > MAX_CANDIDATES) return NextResponse.json({ error: "body" }, { status: 400 });
    // stable input: same candidates, same order, every time
    const candidates = [...new Set(raw.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 120)).filter((c) => c && c !== role))].sort((a, b) =>
      a.localeCompare(b, "it"),
    );
    if (!candidates.length) return NextResponse.json({ titles: [] });
    if (throttled(`equiv:${caller.tenant ?? ""}`, 60)) return NextResponse.json({ error: "rate" }, { status: 429 });

    try {
      const message = await claude().beta.messages.parse({
        model: AI_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
        system: SYSTEM,
        messages: [{ role: "user", content: `Ruolo: ${role}\n\nTitoli presenti (JSON):\n${JSON.stringify(candidates)}` }],
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
      const allowed = new Set(candidates);
      const titles = [...new Set(message.parsed_output.equivalenti.map((t) => t.trim()).filter((t) => allowed.has(t)))].sort((a, b) => a.localeCompare(b, "it"));
      return NextResponse.json({ titles });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("equivalent titles failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
