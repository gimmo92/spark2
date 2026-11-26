import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCaller, type CallerConfig } from "@spark/core/server";
import { benchmarkStats, type BenchmarkAd } from "../../lib/benchmark";
import { MODEL, throttled } from "../ai";

const SERPER_URL = "https://google.serper.dev/search";

type Organic = { title?: string; snippet?: string; link?: string; source?: string };

const isJobAd = (link: string) => {
  const u = link.toLowerCase();
  return u.includes("linkedin.com/jobs/view") || u.includes("indeed.com/viewjob") || u.includes("indeed.com/job");
};

async function search(key: string, queries: string[]) {
  const settled = await Promise.allSettled(
    queries.map((q) =>
      fetch(SERPER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": key },
        body: JSON.stringify({ q, gl: "it", hl: "it", num: 10 }),
      }).then((r) => (r.ok ? (r.json() as Promise<{ organic?: Organic[] }>) : null)),
    ),
  );
  return settled.flatMap((s) => (s.status === "fulfilled" && Array.isArray(s.value?.organic) ? s.value.organic : []));
}

const SYSTEM = `Estrai dagli annunci di lavoro solo la retribuzione annua lorda in euro (RAL) dichiarata esplicitamente.
Regole:
- Includi un annuncio solo se la cifra è scritta nel testo o ricavabile senza ipotesi.
- Range: min e max. Valore unico annuo: value.
- Importo mensile: annualizza x13 (default Italia) e scrivilo in note. Importo orario: escludi l'annuncio.
- Numeri interi in euro annui lordi. Non inventare cifre e non stimare dal ruolo.
- Usa lo stesso "i" dell'annuncio in input.`;

const Answer = z.object({
  ads: z.array(
    z.object({
      i: z.number().int(),
      salaryText: z.string(),
      min: z.number().nullable(),
      max: z.number().nullable(),
      value: z.number().nullable(),
      note: z.string(),
    }),
  ),
});

const plausible = (n: number | null) => (n != null && n >= 8_000 && n <= 500_000 ? Math.round(n) : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * POST /api/transparency/benchmark `{ query, sector? }`: market salary range of a role from job ads
 * with a declared salary (LinkedIn / Indeed Italy via Serper; Claude extracts the figures, the
 * statistics are computed here). Needs `transparency.manage`, SERPER_API_KEY and ANTHROPIC_API_KEY.
 */
export function createBenchmarkRoute(config: CallerConfig) {
  async function POST(request: NextRequest) {
    const caller = await requireCaller(config);
    if (caller instanceof NextResponse) return caller;
    if (!caller.modules.includes("transparency") || !caller.can(caller.person, "transparency.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const serperKey = process.env.SERPER_API_KEY ?? process.env.SERP_API_KEY;
    if (!serperKey || !process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ai_config" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const query = text(body?.query, 100).replace(/"/g, "");
    const sector = text(body?.sector, 60).replace(/"/g, "");
    if (!query) return NextResponse.json({ error: "body" }, { status: 400 });
    if (throttled(`bench:${caller.tenant ?? ""}`, 30)) return NextResponse.json({ error: "rate" }, { status: 429 });

    const role = `"${query}"`;
    const sectorText = sector ? ` "${sector}"` : "";
    const money = ' ("RAL" OR "retribuzione" OR "stipendio" OR "lordo" OR "€")';
    const sites = ["site:it.linkedin.com/jobs/view", "site:it.indeed.com/viewjob", "site:it.indeed.com/job"];
    let organic = await search(serperKey, sites.map((s) => `${s} ${role}${sectorText}${money}`));
    if (!organic.length) organic = await search(serperKey, sites.map((s) => `${s} ${role}${sectorText}`));

    const seen = new Set<string>();
    const raw = organic
      .filter((r) => r.link && isJobAd(r.link) && !seen.has(r.link) && seen.add(r.link))
      .slice(0, 30)
      .map((r, i) => ({ i, title: r.title ?? "", snippet: r.snippet ?? "", link: r.link!, source: r.source ?? "" }));
    if (!raw.length) return NextResponse.json({ ads: [], stats: null, scanned: 0 });

    try {
      const message = await new Anthropic().beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Ruolo cercato: ${query}${sector ? `\nSettore: ${sector}` : ""}\n\nAnnunci (JSON, titolo e anteprima dai risultati di ricerca):\n${JSON.stringify(raw.map(({ i, title, snippet }) => ({ i, title, snippet })))}`,
          },
        ],
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) throw new Error(`no_output:${message.stop_reason}`);
      const ads: BenchmarkAd[] = [];
      for (const a of message.parsed_output.ads) {
        const src = raw[a.i];
        const ad = { min: plausible(a.min), max: plausible(a.max), value: plausible(a.value) };
        if (!src || (ad.min == null && ad.max == null && ad.value == null) || ads.some((x) => x.link === src.link)) continue;
        ads.push({ title: src.title, link: src.link, source: src.source, salaryText: a.salaryText.slice(0, 120), note: a.note.slice(0, 160) || undefined, ...ad });
      }
      return NextResponse.json({ ads, stats: benchmarkStats(ads), scanned: raw.length });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "rate" }, { status: 429 });
      console.error("benchmark failed", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      return NextResponse.json({ error: "ai" }, { status: 502 });
    }
  }
  return { POST };
}
