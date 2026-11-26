"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, Search } from "lucide-react";
import { Tooltip, inputCls, localeTag, tr, useAccess, useData } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { adPoint, type BenchmarkDoc } from "../lib/benchmark";
import { SALARY_METRICS } from "../lib/models/constants";
import { roleId, rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { eur, gap, pct } from "./format";

const ERRORS: Record<string, string> = {
  ai_config: "Benchmark non configurato: servono SERPER_API_KEY e ANTHROPIC_API_KEY sul server.",
  ai: "Ricerca non riuscita. Riprova tra poco.",
  rate: "Troppe ricerche ravvicinate: riprova tra qualche minuto.",
  forbidden: "Non hai il permesso di aggiornare i benchmark.",
  body: "Scrivi il ruolo da cercare.",
};

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? SalaryMath.mean(v) : null;
};

/**
 * Market benchmarks of the company's roles: salary ranges from job ads with a declared salary
 * (LinkedIn / Indeed Italy), compared with the company's mean base pay (FTE) for the same role.
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
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doc = analyses.find((a) => a.id === id) ?? analyses[0];
  const roles = useMemo(() => {
    const people = doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : [];
    return rolesOf(people).map((r) => {
      const pay = (g?: "M" | "F") => mean(r.people.filter((p) => !g || p.gender === g).map((p) => personPay(p, SALARY_METRICS.base)));
      return { ...r, avg: pay(), avgM: pay("M"), avgF: pay("F") };
    });
  }, [doc]);

  const run = async (role: string) => {
    const query = (queries[role] ?? benchmarks.get(role)?.query ?? role).trim();
    const sec = sector.trim() || benchmarks.get(role)?.sector || "";
    setBusy((b) => ({ ...b, [role]: true }));
    setError(null);
    const r = await fetch("/api/transparency/benchmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, sector: sec }) }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as Partial<BenchmarkDoc> & { error?: string };
    setBusy((b) => ({ ...b, [role]: false }));
    if (!r?.ok || !Array.isArray(body.ads)) {
      setError(tr(ERRORS[body?.error ?? "ai"] ?? ERRORS.ai));
      return;
    }
    upsert({ id: roleId(role), role, query, sector: sec || undefined, ads: body.ads, stats: body.stats ?? null, scanned: body.scanned ?? 0, fetchedAt: new Date().toISOString(), fetchedBy: email });
    setOpen(role);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold">{tr("Benchmarks")}</h1>
          <p className="mt-0.5 max-w-3xl text-[12.5px] text-muted">
            {tr("Range di mercato per ruolo dagli annunci di lavoro con retribuzione dichiarata (LinkedIn e Indeed Italia), confrontati con la RAL media a tempo pieno dell'azienda.")}
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
              {tr("Molti titoli interni non si trovano negli annunci: scrivi nella colonna \"Cerca come\" il nome con cui il ruolo compare sul mercato. Una ricerca legge fino a 30 annunci.")}
            </p>
          </div>
          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">{error}</div>}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
                  <th className="px-3 py-2.5">{tr("Cerca come")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("RAL media azienda")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Mercato (Q1 · mediana · Q3)")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Rispetto alla mediana")}</th>
                  <th className="w-[150px] px-3 py-2.5 pr-4" />
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const b = benchmarks.get(r.role);
                  const s = b?.stats;
                  const diff = s && r.avg ? (r.avg - s.median) / s.median : null;
                  const isOpen = open === r.role && !!b;
                  return (
                    <Fragment key={r.role}>
                      <tr className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
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
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s ? (
                            <>
                              <p>
                                {eur(s.q1)} · <span className="font-semibold">{eur(s.median)}</span> · {eur(s.q3)}
                              </p>
                              <p className="text-[11px] text-muted">{tr("{0} annunci con RAL", [s.n])}</p>
                            </>
                          ) : b ? (
                            <span className="text-[12px] text-muted">{tr("Nessuna RAL negli annunci trovati ({0})", [b.scanned])}</span>
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${diff == null ? "text-muted" : diff < -0.1 ? "text-red-600" : diff > 0.1 ? "text-emerald-700" : ""}`}>
                          {diff == null ? "–" : gap(diff * 100)}
                        </td>
                        <td className="px-3 py-2 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <button
                                type="button"
                                disabled={busy[r.role]}
                                onClick={() => void run(r.role)}
                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-60"
                              >
                                {busy[r.role] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                                {b ? tr("Aggiorna") : tr("Cerca")}
                              </button>
                            )}
                            {b && (
                              <Tooltip label={isOpen ? tr("Nascondi annunci") : tr("Mostra annunci")}>
                                <button
                                  type="button"
                                  aria-label={isOpen ? tr("Nascondi annunci") : tr("Mostra annunci")}
                                  aria-expanded={isOpen}
                                  onClick={() => setOpen(isOpen ? null : r.role)}
                                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                                >
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                          {b && <p className="mt-0.5 text-[11px] text-faint">{new Date(b.fetchedAt).toLocaleDateString(localeTag())}</p>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-line bg-[#fafbfd]">
                          <td colSpan={6} className="px-4 py-2.5">
                            {b.ads.length ? (
                              <ul className="space-y-1 text-[12px]">
                                {b.ads.map((a) => (
                                  <li key={a.link} className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="w-[90px] shrink-0 text-right font-semibold tabular-nums">{eur(adPoint(a))}</span>
                                    <a href={a.link} target="_blank" rel="noreferrer noopener" className="inline-flex min-w-0 items-center gap-1 text-brand hover:underline">
                                      <span className="truncate">{a.title}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                    <span className="text-muted">
                                      {a.salaryText}
                                      {a.note && ` · ${a.note}`}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[12px] text-muted">{tr("Nessun annuncio con RAL dichiarata: prova un altro nome del ruolo o togli il settore.")}</p>
                            )}
                            {b.stats && (
                              <p className="mt-2 text-[11.5px] text-muted">
                                {tr("Minimo {0} · massimo {1} · ricerca \"{2}\"", [eur(b.stats.min), eur(b.stats.max), b.query])}
                                {b.sector && ` · ${b.sector}`}
                                {" · "}
                                {tr("{0} su {1} annunci letti riportano la RAL", [b.ads.length, b.scanned])} ({pct(b.scanned ? (b.ads.length / b.scanned) * 100 : 0)})
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
