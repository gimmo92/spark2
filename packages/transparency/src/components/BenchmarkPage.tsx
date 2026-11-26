"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Badge, PrimaryButton, Tooltip, inputCls, localeTag, tr, useAccess, useData } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import type { BenchmarkConfidence, BenchmarkDoc, BenchmarkStats } from "../lib/benchmark";
import { SALARY_METRICS } from "../lib/models/constants";
import { roleId, rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { eur, gap } from "./format";

const ERRORS: Record<string, string> = {
  ai_config: "Servizio AI non configurato: manca la chiave ANTHROPIC_API_KEY sul server.",
  ai: "Stima non riuscita. Riprova tra poco.",
  rate: "Troppe richieste ravvicinate: riprova tra qualche minuto.",
  forbidden: "Non hai il permesso di aggiornare i benchmark.",
  body: "Elenco dei ruoli non valido (massimo 400 ruoli).",
};

const CONFIDENCE: Record<BenchmarkConfidence, { label: string; tone: "navy" | "blue" | "grey" }> = {
  alta: { label: "Affidabilità alta", tone: "navy" },
  media: { label: "Affidabilità media", tone: "blue" },
  bassa: { label: "Affidabilità bassa", tone: "grey" },
};

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? SalaryMath.mean(v) : null;
};

/**
 * Market benchmarks of the company's roles: salary range estimated by Claude from title, CCNL level
 * and qualification, compared with the company's mean full-time base pay for the same role.
 */
export function BenchmarkPage({ transparencyHref = "/trasparenza" }: { transparencyHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { benchmarks, upsert } = useBenchmarks();
  const { allowed } = useAccess();
  const email = useData().viewer?.email;
  const canManage = allowed("transparency.manage");
  const [id, setId] = useState("");
  const [sector, setSector] = useState("");
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const doc = analyses.find((a) => a.id === id) ?? analyses[0];
  const roles = useMemo(() => {
    const people = doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : [];
    return rolesOf(people).map((r) => {
      const pay = (g?: "M" | "F") => mean(r.people.filter((p) => !g || p.gender === g).map((p) => personPay(p, SALARY_METRICS.base)));
      return { ...r, avg: pay(), avgM: pay("M"), avgF: pay("F") };
    });
  }, [doc]);
  const missing = roles.filter((r) => !benchmarks.get(r.role));

  const queryOf = (role: string) => (queries[role] ?? benchmarks.get(role)?.query ?? role).trim() || role;

  /** Estimates the given roles (one call for all of them) and saves the results. */
  const run = async (list: typeof roles, key: string) => {
    setBusy(key);
    setMessage(null);
    const sec = sector.trim();
    const r = await fetch("/api/transparency/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector: sec, roles: list.map(({ role, level, ccnl, qualification }) => ({ role, query: queryOf(role), level, ccnl, qualification })) }),
    }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as {
      roles?: { role: string; stats: BenchmarkStats | null; confidence: BenchmarkConfidence; rationale: string }[];
      source?: string;
      error?: string;
    };
    setBusy(null);
    if (!r?.ok || !body.roles) {
      setMessage({ text: tr(ERRORS[body?.error ?? "ai"] ?? ERRORS.ai), tone: "warn" });
      return;
    }
    const now = new Date().toISOString();
    for (const x of body.roles)
      upsert({
        id: roleId(x.role),
        role: x.role,
        query: queryOf(x.role),
        sector: sec || undefined,
        stats: x.stats,
        confidence: x.confidence,
        rationale: x.rationale,
        source: body.source ?? "AI",
        fetchedAt: now,
        fetchedBy: email,
      } satisfies BenchmarkDoc);
    if (list.length > 1) setMessage({ text: tr("{0} ruoli stimati.", [body.roles.length]), tone: "ok" });
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold">{tr("Benchmarks")}</h1>
          <p className="mt-0.5 max-w-3xl text-[12.5px] text-muted">
            {tr("Range di mercato per ruolo stimati dall'AI (RAL annua lorda a tempo pieno in Italia), confrontati con la RAL media a tempo pieno dell'azienda. All'AI vanno solo titoli, livelli e qualifiche.")}
          </p>
        </div>
        {analyses.length > 1 && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Ruoli dall'analisi")}
            <select value={doc?.id ?? ""} onChange={(e) => setId(e.target.value)} className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand">
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {new Date(a.createdAt).toLocaleDateString(localeTag())}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!doc ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {tr("Per i benchmark serve un'analisi salvata.")}{" "}
          <Link href={transparencyHref} className="font-semibold text-brand hover:underline">
            {tr("Carica il tracciato in Trasparenza salariale")}
          </Link>
        </div>
      ) : (
        <>
          <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
            <label className="block w-full max-w-xs">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Settore (opzionale)")}</span>
              <input className={inputCls} value={sector} onChange={(e) => setSector(e.target.value)} placeholder={tr("es. assicurazioni")} />
            </label>
            <p className="min-w-0 flex-1 text-[12px] text-muted">
              {tr("Se un titolo interno non è chiaro, scrivi nella colonna \"Cerca come\" il nome con cui il ruolo è noto sul mercato. Sono stime: usale come riferimento, non come dato puntuale.")}
            </p>
            {canManage && roles.length > 0 && (
              <PrimaryButton disabled={!!busy} onClick={() => void run(missing.length ? missing : roles, "all")} className="flex items-center gap-1.5">
                {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {missing.length ? tr("Stima {0} ruoli", [missing.length]) : tr("Ristima tutti")}
              </PrimaryButton>
            )}
          </div>
          {message && (
            <div className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {message.text}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
                  <th className="px-3 py-2.5">{tr("Cerca come")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("RAL media azienda")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Mercato (Q1 · mediana · Q3)")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Rispetto alla mediana")}</th>
                  <th className="w-[110px] px-3 py-2.5 pr-4" />
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const b = benchmarks.get(r.role);
                  const s = b?.stats;
                  const diff = s && r.avg ? (r.avg - s.median) / s.median : null;
                  const conf = b?.confidence ? CONFIDENCE[b.confidence] : null;
                  return (
                    <tr key={r.role} className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                      <td className="max-w-[260px] px-3 py-2 pl-4">
                        <p className="font-semibold">{r.role}</p>
                        <p className="text-[11.5px] text-muted">
                          {tr("{0} persone", [r.n])}
                          {r.level && ` · ${r.level}`}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          aria-label={tr("Cerca come")}
                          disabled={!canManage}
                          className="w-full min-w-[180px] rounded-md border border-[#dfe3ea] bg-white px-2 py-1 text-[12.5px] outline-none focus:border-brand disabled:bg-transparent"
                          value={queries[r.role] ?? b?.query ?? r.role}
                          onChange={(e) => setQueries((q) => ({ ...q, [r.role]: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <p className="font-semibold">{eur(r.avg)}</p>
                        <p className="text-[11px] text-muted">
                          {tr("U")} {eur(r.avgM)} · {tr("D")} {eur(r.avgF)}
                        </p>
                      </td>
                      <td className="max-w-[300px] px-3 py-2 text-right tabular-nums">
                        {s ? (
                          <>
                            <Tooltip label={tr("Minimo {0} · massimo {1}", [eur(s.min), eur(s.max)])}>
                              <p>
                                {eur(s.q1)} · <span className="font-semibold">{eur(s.median)}</span> · {eur(s.q3)}
                              </p>
                            </Tooltip>
                            {conf && (
                              <div className="mt-0.5">
                                <Badge tone={conf.tone}>{tr(conf.label)}</Badge>
                              </div>
                            )}
                            {b?.rationale && <p className="mt-0.5 text-left text-[11.5px] text-faint">{b.rationale}</p>}
                          </>
                        ) : b ? (
                          <span className="text-[12px] text-muted">{tr("Stima non disponibile: prova un altro nome del ruolo.")}</span>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${diff == null ? "text-muted" : diff < -0.1 ? "text-red-600" : diff > 0.1 ? "text-emerald-700" : ""}`}>
                        {diff == null ? "–" : gap(diff * 100)}
                      </td>
                      <td className="px-3 py-2 pr-4 text-right">
                        {canManage && (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => void run([r], r.role)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-60"
                          >
                            {busy === r.role ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {b ? tr("Ristima") : tr("Stima")}
                          </button>
                        )}
                        {b && <p className="mt-0.5 text-[11px] text-faint">{new Date(b.fetchedAt).toLocaleDateString(localeTag())}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
