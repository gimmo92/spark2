"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { Badge, tr, useAccess, useCore, useSettings } from "@spark/core";
import { CompensationAnalysis, canonicalEmployeeId, type SavedJustification } from "../lib/analysis/CompensationAnalysis";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { defaultRgaSelection, personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { DEFAULT_SCOPE, benchmarkKey, cleanScope, uncovered, type BenchmarkScope } from "../lib/benchmark";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS, type SalaryMetric } from "../lib/models/constants";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { EmployeeProfile, JustificationSection, PayLetterSection } from "./EmployeePanel";
import { PayStripChart } from "./PayStripChart";
import { eur, gap, gapTone, num } from "./format";

const METRICS: { id: SalaryMetric; label: string }[] = [
  { id: SALARY_METRICS.base, label: "Retribuzione base" },
  { id: SALARY_METRICS.variabile, label: "Componenti variabili" },
  { id: SALARY_METRICS.totale, label: "Retribuzione totale" },
];

const bandKey = (e: Employee) => `${String(e.ccnl ?? "").trim().toLowerCase()}|${LevelTaxonomy.normalize(e.level) ?? ""}`;

const stats = (values: number[]) => (values.length ? { mean: SalaryMath.mean(values), median: SalaryMath.median(values) } : null);

/**
 * Page /trasparenza/dipendente?analisi=…&dip=…: one employee of a saved analysis. Profile, position
 * in their CCNL level (base / variable / total), the level's gender gaps, the market benchmark of the
 * role, the justification of a deviation (saved in the analysis, listed in the report) and the
 * individual pay information letter. The route needs <Suspense> (it reads the URL on the client).
 */
export function EmployeePage({ backHref = "/trasparenza", benchmarkHref = "/benchmarks/dettaglio" }: { backHref?: string; benchmarkHref?: string }) {
  const params = useSearchParams();
  const { analyses, save } = usePayAnalyses();
  const { get, sectorOf } = useBenchmarks();
  const { allowed } = useAccess();
  const { notify } = useCore();
  const canManage = allowed("transparency.manage");
  const [scopeStored] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const scope = cleanScope(scopeStored);
  const [metric, setMetric] = useState<SalaryMetric>(SALARY_METRICS.base);

  const doc = analyses.find((a) => a.id === params.get("analisi"));
  const analysis = useMemo(() => (doc ? CompensationAnalysis.fromSnapshot(doc.snapshot) : null), [doc]);
  const all = useMemo(() => analysis?.employees ?? [], [analysis]);
  const person = all.find((e) => String(e.index) === params.get("dip"));
  const excluded = useMemo(() => CompensationAnalysis.exclusionMap(all, analysis?.justifications), [all, analysis]);
  const back = doc ? `${backHref}?analisi=${encodeURIComponent(doc.id)}&vista=${params.get("vista") ?? "ccnl"}` : backHref;

  // the CCNL level of the person: colleagues with the same contract and level (justified ones left out, the person kept)
  const peers = useMemo(() => (person ? all.filter((e) => bandKey(e) === bandKey(person) && (!excluded[e.index] || e.index === person.index)) : []), [all, person, excluded]);
  const rga = defaultRgaSelection();
  const pay = (e: Employee, m: SalaryMetric) => {
    const v = personPay(e, m, m === SALARY_METRICS.base ? null : rga);
    return v != null && v > 0 ? v : null;
  };

  if (!doc || !analysis || !person) {
    return (
      <div className="space-y-3.5">
        <Link href={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> {tr("Trasparenza salariale")}
        </Link>
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Dipendente non trovato in questa analisi.")}</div>
      </div>
    );
  }

  const own = pay(person, metric);
  const values = (g?: "M" | "F") => peers.filter((e) => !g || e.gender === g).map((e) => pay(e, metric)).filter((v): v is number => v != null);
  const level = stats(values());
  const sorted = values().sort((a, b) => a - b);
  const below = own == null ? 0 : sorted.filter((v) => v < own).length;
  const percentile = own == null || !sorted.length ? null : Math.round((below / sorted.length) * 100);

  // market benchmark of the role (company cache, effective sector of this analysis)
  const roleInfo = rolesOf([person])[0];
  const sector = scope.sector || sectorOf(doc.id);
  const market = roleInfo && sector && !uncovered(roleInfo.role) ? get(benchmarkKey(roleInfo, scope, sector))?.stats : undefined;
  const ownBase = pay(person, SALARY_METRICS.base);

  const setNote = (note: string) => {
    const id = canonicalEmployeeId(person.employeeId);
    if (!id) {
      notify(tr("Questo dipendente non ha una matricola nel file: non si può giustificare."));
      return;
    }
    const list: SavedJustification[] = (analysis.justifications ?? []).filter((j) => canonicalEmployeeId(j.employeeId) !== id);
    if (note) list.push({ employeeId: id, name: person.name ?? null, note });
    save({ ...doc, snapshot: { ...doc.snapshot, justifications: list } });
    notify(note ? tr("Giustificazione salvata: la persona esce dal calcolo dei divari") : tr("Persona rimessa nell'analisi"));
  };

  return (
    <div className="space-y-3.5">
      <Link href={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr("Trasparenza salariale")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[14px] font-semibold">{person.name || person.employeeId || tr("Dipendente")}</h1>
        {excluded[person.index] && <Badge tone="grey">{tr("Esclusa dal calcolo (giustificata)")}</Badge>}
        <span className="text-[12.5px] text-muted">
          · {LevelTaxonomy.displayLabel(person.level)} · {person.ccnl || "—"} · {doc.name}
        </span>
      </div>

      <div className="card p-4">
        <EmployeeProfile person={person} />
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{tr("Posizionamento nel livello")}</p>
            <p className="text-[12px] text-muted">{tr("{0} persone con lo stesso livello e contratto ({1} uomini, {2} donne).", [peers.length, values("M").length, values("F").length])}</p>
          </div>
          <select value={metric} onChange={(e) => setMetric(e.target.value as SalaryMetric)} className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-brand">
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {tr(m.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Il dipendente", value: eur(own) },
            { label: "Media del livello", value: eur(level?.mean), sub: own != null && level ? gap(((own - level.mean) / level.mean) * 100) : undefined },
            { label: "Mediana del livello", value: eur(level?.median), sub: own != null && level?.median ? gap(((own - level.median) / level.median) * 100) : undefined },
            { label: "Percentile", value: percentile == null ? "–" : `${percentile}°`, sub: tr("guadagna più del {0}% del livello", [percentile ?? 0]) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(k.label)}</p>
              <p className="mt-0.5 text-[16px] font-bold tabular-nums">{k.value}</p>
              {k.sub && <p className="text-[11.5px] text-muted tabular-nums">{k.sub}</p>}
            </div>
          ))}
        </div>
        {own != null || values().length ? (
          <PayStripChart
            ariaLabel={tr("Retribuzione del dipendente rispetto ai colleghi del livello")}
            points={peers
              .map((e) => ({ e, v: pay(e, metric) }))
              .filter((x): x is { e: Employee; v: number } => x.v != null && (x.e.gender === "M" || x.e.gender === "F"))
              .map(({ e, v }) => ({ key: e.index, value: v, gender: e.gender as "M" | "F", label: e.index === person.index ? person.name || tr("Il dipendente") : tr("Collega"), highlight: e.index === person.index }))}
            lines={level ? [{ value: level.mean, label: tr("Media del livello") }, { value: level.median, label: tr("Mediana del livello"), dashed: true }] : []}
          />
        ) : (
          <p className="text-[12.5px] text-muted">{tr("Nessun valore per questa componente.")}</p>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        <p className="text-[13px] font-semibold">{tr("Divario di genere nel livello")}</p>
        <table className="mt-2 w-full min-w-[640px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="py-2 pr-3">{tr("Componente")}</th>
              <th className="px-3 py-2 text-right">{tr("Media uomini")}</th>
              <th className="px-3 py-2 text-right">{tr("Media donne")}</th>
              <th className="px-3 py-2 text-right">{tr("Gap medio")}</th>
              <th className="px-3 py-2 text-right">{tr("Mediana uomini")}</th>
              <th className="px-3 py-2 text-right">{tr("Mediana donne")}</th>
              <th className="py-2 pl-3 text-right">{tr("Gap mediano")}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const of = (g: "M" | "F") => stats(peers.filter((e) => e.gender === g).map((e) => pay(e, m.id)).filter((v): v is number => v != null));
              const [sm, sf] = [of("M"), of("F")];
              const gMean = sm && sf ? SalaryMath.genderPayGapPct(sm.mean, sf.mean) : null;
              const gMedian = sm && sf ? SalaryMath.genderPayGapPct(sm.median, sf.median) : null;
              return (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3 font-semibold">{tr(m.label)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(sm?.mean)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(sf?.mean)}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${gapTone(gMean)}`}>{gap(gMean)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(sm?.median)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(sf?.median)}</td>
                  <td className={`py-1.5 pl-3 text-right font-semibold tabular-nums ${gapTone(gMedian)}`}>{gap(gMedian)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{tr("Benchmark di mercato del ruolo")}</p>
          {market && ownBase != null ? (
            <p className="text-[12.5px] text-muted">
              {person.role} · {tr("Q1 {0} · mediana {1} · Q3 {2}", [eur(market.q1), eur(market.median), eur(market.q3)])} ·{" "}
              <span className="font-semibold text-ink">{tr("compa-ratio {0}", [num(ownBase / market.median, 2)])}</span> ({gap(((ownBase - market.median) / market.median) * 100)})
            </p>
          ) : (
            <p className="text-[12.5px] text-muted">{roleInfo && uncovered(roleInfo.role) ? tr("Dati di mercato insufficienti per questo ruolo.") : tr("Benchmark non ancora disponibile per questo ruolo.")}</p>
          )}
        </div>
        {market && roleInfo && (
          <Link
            href={`${benchmarkHref}?analysis=${encodeURIComponent(doc.id)}&role=${encodeURIComponent(roleInfo.role)}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand-soft"
          >
            <Eye className="h-4 w-4" /> {tr("Confronto completo")}
          </Link>
        )}
      </div>

      {canManage && (
        <div className="card p-4">
          <JustificationSection note={excluded[person.index] ?? ""} onNote={setNote} />
        </div>
      )}

      <div className="card p-4">
        <PayLetterSection person={person} peers={all.filter((e) => !excluded[e.index] || e.index === person.index)} />
      </div>
    </div>
  );
}
