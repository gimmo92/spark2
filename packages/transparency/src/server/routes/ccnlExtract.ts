import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AI_MODEL, Anthropic, aiConfigured, claude, requireCaller, throttled, type CallerConfig } from "@spark/core/server";
import type { CcnlRow } from "../../lib/ccnl";

/** Pages sent at most (the browser cuts the PDF to the pages with the tables). */
const MAX_BYTES = 3_500_000;

const SYSTEM = `Ricevi le pagine di un contratto collettivo (CCNL) o di un accordo di rinnovo con le tabelle dei minimi retributivi.
Estrai la tabella dei minimi IN VIGORE PIÙ RECENTE (l'ultima decorrenza presente nelle pagine), senza inventare valori:
- per ogni livello, il minimo MENSILE in euro; se la tabella ha classi/scatti di anzianità, un valore per classe in ordine crescente di anzianità;
- se il contratto fissa solo un minimo ANNUO complessivo (es. dirigenti), usa "annuo" e lascia "mensili" vuoto;
- il numero di mensilità (13, 14...) se indicato o deducibile (es. "importo mensile (1/14)");
- la data di decorrenza della tabella (AAAA-MM-GG) e, se indicata, la scadenza del contratto;
- se ci sono classi di anzianità, gli anni coperti dalla prima classe e l'ampiezza delle successive.
Usa i nomi dei livelli come scritti nel documento. Gli importi con la virgola decimale italiana vanno convertiti in numeri.
Nella nota indica eventuali dubbi (righe illeggibili, più tabelle per categorie diverse di personale, valori da verificare).`;

const Answer = z.object({
  decorrenza: z.string(),
  scadenza: z.string(),
  mensilita: z.number(),
  classi_primi_anni: z.number(),
  classi_passo_anni: z.number(),
  livelli: z.array(z.object({ livello: z.string(), mensili: z.array(z.number()), annuo: z.number().nullable() })),
  nota: z.string(),
});

const date = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : undefined);

/**
 * POST /api/transparency/ccnl-extract `{ pdf (base64 of the table pages), ccnl, levels }`: the
 * minimum-pay table read by Claude from an official agreement, for the user to review and save.
 * Needs `transparency.manage`.
 */
export function createCcnlExtractRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!aiConfigured()) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { pdf?: unknown; ccnl?: unknown; levels?: unknown } | null;
    const pdf = typeof body?.pdf === "string" ? body.pdf : "";
    if (!pdf || pdf.length > (MAX_BYTES * 4) / 3) return NextResponse.json({ error: "body" }, { status: 400 });
    const ccnl = typeof body?.ccnl === "string" ? body.ccnl.slice(0, 120) : "";
    const levels = Array.isArray(body?.levels) ? body.levels.filter((x): x is string => typeof x === "string").slice(0, 60) : [];
    if (throttled(`ccnl:${caller.tenant ?? ""}`, 15)) return NextResponse.json({ error: "rate" }, { status: 429 });

    try {
      const message = await claude().beta.messages.parse({
        model: AI_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: betaZodOutputFormat(Answer) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
              {
                type: "text",
                text: `Contratto nei dati dell'azienda: ${ccnl || "non indicato"}\nLivelli presenti nei dati: ${levels.join(", ") || "non indicati"}\nEstrai la tabella dei minimi.`,
              },
            ],
          },
        ],
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
      const a = message.parsed_output;
      const rows: CcnlRow[] = a.livelli
        .map((l): CcnlRow => ({
          level: l.livello.trim().slice(0, 60),
          ...(l.annuo != null && l.annuo > 0 ? { annual: Math.round(l.annuo * 100) / 100 } : { monthly: l.mensili.filter((v) => v > 0 && v < 100000).map((v) => Math.round(v * 100) / 100) }),
        }))
        .filter((r) => r.level && (r.annual != null || (r.monthly?.length ?? 0) > 0));
      const classes = rows.some((r) => (r.monthly?.length ?? 0) > 1) && a.classi_primi_anni > 0 ? { first: a.classi_primi_anni, step: Math.max(1, a.classi_passo_anni) } : undefined;
      return NextResponse.json({
        validFrom: date(a.decorrenza),
        expires: date(a.scadenza),
        mensilita: a.mensilita >= 12 && a.mensilita <= 16 ? Math.round(a.mensilita) : 13,
        classes,
        rows,
        note: a.nota.trim().slice(0, 600),
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("ccnl extraction failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
