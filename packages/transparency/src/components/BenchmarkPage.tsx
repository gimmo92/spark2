"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Tooltip, inputCls, localeTag, tr, useAccess, useSettings } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { AREAS, DEFAULT_SCOPE, REGIONS, SENIORITIES, SIZES, cleanScope, sameScope, scopeParts, type BenchmarkScope } from "../lib/benchmark";
import { SALARY_METRICS } from "../lib/models/constants";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { useBenchmarkRunner } from "./benchmarkRunner";
import { eur, gap } from "./format";

const selectCls = "rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand disabled:bg-canvas";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? SalaryMath.mean(v) : null;
};

/**
 * Market benchmarks of the company's roles (annual gross full-time pay, chosen scope: geography,
 * company size, sector, seniority), compared with the company's mean full-time base pay. Figures
 * are prepared in the background when an analysis is saved; missing ones are filled when the page opens.
 */
export function BenchmarkPage({ transparencyHref = "/trasparenza" }: { transparencyHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { get } = useBenchmarks();
  const { run, isRunning } = useBenchmarkRunner();
  const { allowed } = useAccess();
  const canManage = allowed("transparency.manage");
  const [stored, saveScope] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const scope = cleanScope(stored);
  const setScope = (patch: Partial<BenchmarkScope>) => saveScope(cleanScope({ ...scope, ...patch }));
  const [id, setId] = useState("");
  const [failed, setFailed] = useState(false);

  const doc = analyses.find((a) => a.id === id) ?? analyses[0];
  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);
  const roles = useMemo(
    () =>
      rolesOf(people).map((r) => {
        const pay = (g?: "M" | "F") => mean(r.people.filter((p) => !g || p.gender === g).map((p) => personPay(p, SALARY_METRICS.base)));
        return { ...r, avg: pay(), avgM: pay("M"), avgF: pay("F") };
      }),
    [people],
  );
  const loading = !!doc && isRunning(doc.id);
  // roles without figures for the current scope: filled automatically (after a short pause while the scope is being edited)
  const missing = roles.filter((r) => {
    const b = doc && get(doc.id, r.role);
    return !b || !sameScope(cleanScope(b.scope), scope);
  });
  const missingKey = doc && canManage && !loading && !failed ? `${doc.id}|${missing.map((r) => r.role).join(",")}|${JSON.stringify(scope)}` : "";
  useEffect(() => {
    if (!missingKey || !doc || !missing.length) return;
    const t = setTimeout(() => {
      void run(
        doc.id,
        people,
        missing.map((r) => r.role),
      ).then((res) => setFailed(res === "error"));
    }, 900);
    return () => clearTimeout(t);
    // the key covers analysis, missing roles and scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  const sector = roles.map((r) => doc && get(doc.id, r.role)?.sector).find(Boolean);
  const updated = roles
    .map((r) => doc && get(doc.id, r.role)?.fetchedAt)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold">{tr("Benchmarks")}</h1>
          <p className="mt-0.5 max-w-3xl text-[12.5px] text-muted">{tr("Range di mercato per ruolo (RAL annua lorda a tempo pieno), confrontati con la RAL media a tempo pieno dell'azienda.")}</p>
        </div>
        {analyses.length > 1 && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Analisi")}
            <select
              value={doc?.id ?? ""}
              onChange={(e) => {
                setId(e.target.value);
                setFailed(false);
              }}
              className={`${selectCls} font-semibold text-ink`}
            >
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
                <select
                  disabled={!canManage}
                  className={selectCls}
                  value={scope.area}
                  onChange={(e) => setScope({ area: e.target.value as BenchmarkScope["area"], region: e.target.value === "regione" ? (scope.region ?? REGIONS[0]) : undefined })}
                >
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
                <span className={labelCls}>{tr("Settore")}</span>
                <input disabled={!canManage} className={inputCls} value={scope.sector ?? ""} onChange={(e) => setScope({ sector: e.target.value })} placeholder={sector ?? tr("dal profilo dei ruoli")} />
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
            </div>
            <p className="mt-2 text-[11.5px] text-muted">
              {tr("Benchmark di mercato Spark")}
              {updated && ` · ${tr("aggiornato al {0}", [new Date(updated).toLocaleDateString(localeTag(), { day: "numeric", month: "long", year: "numeric" })])}`}
              {` · ${scopeParts({ ...scope, sector: scope.sector || sector }).map((p) => tr(p)).join(" · ")}`}
            </p>
          </div>
          {failed && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
              <span className="flex-1">{tr("Dati di mercato non disponibili al momento.")}</span>
              <button type="button" onClick={() => setFailed(false)} className="rounded-lg px-2 py-1 underline hover:bg-amber-100">
                {tr("Riprova")}
              </button>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("RAL media azienda")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Mercato (Q1 · mediana · Q3)")}</th>
                  <th className="px-3 py-2.5 pr-4 text-right">{tr("Rispetto alla mediana")}</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => {
                  const b = get(doc.id, r.role);
                  const fresh = b && sameScope(cleanScope(b.scope), scope);
                  const s = fresh ? b.stats : null;
                  const diff = s && r.avg ? (r.avg - s.median) / s.median : null;
                  const pending = !fresh && (loading || (!failed && canManage));
                  return (
                    <tr key={r.role} className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                      <td className="max-w-[320px] px-3 py-2 pl-4">
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
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s ? (
                          <Tooltip label={tr("Minimo {0} · massimo {1}", [eur(s.min), eur(s.max)])}>
                            <span>
                              {eur(s.q1)} · <span className="font-semibold">{eur(s.median)}</span> · {eur(s.q3)}
                            </span>
                          </Tooltip>
                        ) : pending ? (
                          <span className="ml-auto block h-3.5 w-48 animate-pulse rounded bg-canvas" aria-label={tr("Caricamento…")} />
                        ) : fresh ? (
                          <span className="text-[12px] text-muted">{tr("Dati insufficienti per questo ruolo")}</span>
                        ) : (
                          <span className="text-muted">–</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 pr-4 text-right font-semibold tabular-nums ${diff == null ? "text-muted" : diff < -0.1 ? "text-red-600" : diff > 0.1 ? "text-emerald-700" : ""}`}>
                        {diff == null ? "–" : gap(diff * 100)}
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
