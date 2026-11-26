"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Badge, PrimaryButton, Tooltip, inputCls, localeTag, tr, useAccess, useData, useSettings } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import {
  AREAS,
  DEFAULT_SCOPE,
  REGIONS,
  SENIORITIES,
  SIZES,
  cleanScope,
  sameScope,
  scopeParts,
  type BenchmarkConfidence,
  type BenchmarkDoc,
  type BenchmarkScope,
  type BenchmarkStats,
} from "../lib/benchmark";
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

const selectCls = "rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand disabled:bg-canvas";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? SalaryMath.mean(v) : null;
};

/**
 * Market benchmarks of the company's roles: salary range estimated by Claude for a chosen scope
 * (geography, company size, sector, seniority), compared with the company's mean full-time base pay.
 */
export function BenchmarkPage({ transparencyHref = "/trasparenza" }: { transparencyHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { benchmarks, upsert } = useBenchmarks();
  const { allowed } = useAccess();
  const email = useData().viewer?.email;
  const canManage = allowed("transparency.manage");
  const [stored, saveScope] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const scope = cleanScope(stored);
  const setScope = (patch: Partial<BenchmarkScope>) => saveScope(cleanScope({ ...scope, ...patch }));
  const [id, setId] = useState("");
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
  // roles never estimated, or estimated with other parameters
  const todo = roles.filter((r) => {
    const b = benchmarks.get(r.role);
    return !b || !sameScope(cleanScope(b.scope), scope);
  });

  /** Estimates the given roles (one call for all of them) and saves the results. */
  const run = async (list: typeof roles, key: string) => {
    setBusy(key);
    setMessage(null);
    const r = await fetch("/api/transparency/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, roles: list.map(({ role, level, ccnl, qualification }) => ({ role, level, ccnl, qualification })) }),
    }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as {
      roles?: { role: string; stats: BenchmarkStats | null; confidence: BenchmarkConfidence; rationale: string }[];
      scope?: BenchmarkScope;
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
        scope: cleanScope(body.scope ?? scope),
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
            {tr("Range di mercato per ruolo stimati dall'AI (RAL annua lorda a tempo pieno), confrontati con la RAL media a tempo pieno dell'azienda. All'AI vanno solo titoli, livelli e qualifiche.")}
          </p>
        </div>
        {analyses.length > 1 && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Ruoli dall'analisi")}
            <select value={doc?.id ?? ""} onChange={(e) => setId(e.target.value)} className={`${selectCls} font-semibold text-ink`}>
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
          <div className="card px-4 py-3">
            <p className="text-[12.5px] font-semibold">{tr("Perimetro del confronto")}</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label>
                <span className={labelCls}>{tr("Area geografica")}</span>
                <select disabled={!canManage} className={selectCls} value={scope.area} onChange={(e) => setScope({ area: e.target.value as BenchmarkScope["area"], region: e.target.value === "regione" ? (scope.region ?? REGIONS[0]) : undefined })}>
                  {AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {tr(a.label)}
                    </option>
                  ))}
                </select>
              </label>
              {scope.area === "regione" && (
                <>
                  <label>
                    <span className={labelCls}>{tr("Regione")}</span>
                    <select disabled={!canManage} className={selectCls} value={scope.region} onChange={(e) => setScope({ region: e.target.value })}>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-44">
                    <span className={labelCls}>{tr("Città (opzionale)")}</span>
                    <input disabled={!canManage} className={inputCls} value={scope.city ?? ""} onChange={(e) => setScope({ city: e.target.value })} placeholder={tr("es. Milano")} />
                  </label>
                </>
              )}
              <label>
                <span className={labelCls}>{tr("Dimensione azienda")}</span>
                <select disabled={!canManage} className={selectCls} value={scope.size} onChange={(e) => setScope({ size: e.target.value as BenchmarkScope["size"] })}>
                  {SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {tr(s.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-48">
                <span className={labelCls}>{tr("Settore (opzionale)")}</span>
                <input disabled={!canManage} className={inputCls} value={scope.sector ?? ""} onChange={(e) => setScope({ sector: e.target.value })} placeholder={tr("es. assicurazioni")} />
              </label>
              <label>
                <span className={labelCls}>{tr("Seniority")}</span>
                <select disabled={!canManage} className={selectCls} value={scope.seniority} onChange={(e) => setScope({ seniority: e.target.value as BenchmarkScope["seniority"] })}>
                  {SENIORITIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {tr(s.label)}
                    </option>
                  ))}
                </select>
              </label>
              {canManage && roles.length > 0 && (
                <PrimaryButton disabled={!!busy} onClick={() => void run(todo.length ? todo : roles, "all")} className="ml-auto flex items-center gap-1.5">
                  {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {todo.length ? tr("Stima {0} ruoli", [todo.length]) : tr("Ristima tutti")}
                </PrimaryButton>
              )}
            </div>
            <p className="mt-2 text-[12px] text-muted">{tr("Sono stime: usale come riferimento, non come dato puntuale. Cambiando il perimetro, i ruoli già stimati vanno ristimati.")}</p>
          </div>
          {message && (
            <div className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {message.text}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
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
                  const bScope = b ? cleanScope(b.scope) : null;
                  const stale = !!bScope && !sameScope(bScope, scope);
                  return (
                    <tr key={r.role} className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                      <td className="max-w-[280px] px-3 py-2 pl-4">
                        <p className="font-semibold">{r.role}</p>
                        <p className="text-[11.5px] text-muted">
                          {tr("{0} persone", [r.n])}
                          {r.level && ` · ${r.level}`}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <p className="font-semibold">{eur(r.avg)}</p>
                        <p className="text-[11px] text-muted">
                          {tr("U")} {eur(r.avgM)} · {tr("D")} {eur(r.avgF)}
                        </p>
                      </td>
                      <td className="max-w-[320px] px-3 py-2 text-right tabular-nums">
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
                          </>
                        ) : b ? (
                          <span className="text-[12px] text-muted">{tr("Stima non disponibile per questo ruolo.")}</span>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                        {bScope && (
                          <p className={`mt-0.5 text-left text-[11.5px] ${stale ? "font-semibold text-amber-700" : "text-faint"}`}>
                            {stale && `${tr("Perimetro diverso")}: `}
                            {scopeParts(bScope).map((p) => tr(p)).join(" · ")}
                          </p>
                        )}
                        {b?.rationale && <p className="mt-0.5 text-left text-[11.5px] text-faint">{b.rationale}</p>}
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
