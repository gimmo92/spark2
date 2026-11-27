"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { tr, useAccess } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { benchmarkKey, marketBand, scopeParts, uncovered, type BenchmarkScope, type BenchmarkStats, type MarketBand } from "../lib/benchmark";
import { BenchmarkScopeControls } from "./BenchmarkScopeControls";
import { useBenchmarkRunner } from "./benchmarkRunner";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { eur, gap, num } from "./format";

/** Categorical slots 1–2 of the validated reference palette (blue / orange, CVD-safe on white). */
const COLOR = { M: "#257de0", F: "#f47230" } as const;
const BAND_LABEL: Record<MarketBand, string> = { sotto: "Sotto il Q1", q1: "Tra Q1 e mediana", q3: "Tra mediana e Q3", sopra: "Sopra il Q3" };

const W = 640;
const PAD_L = 72;
const PAD_R = 16;
const ROW = 46;

/** Round step for the axis ticks (1, 2, 5 × 10^n). */
function niceStep(span: number, target = 5) {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p) as number;
}

/**
 * Page /benchmarks/dettaglio?analysis=…&role=…: one role of an analysis against its market benchmark,
 * with its own comparison scope (starts from the company default; another scope is computed for this
 * role only). The route needs <Suspense> (it reads the URL on the client).
 */
export function BenchmarkDetailPage({ backHref = "/benchmarks?tab=ruoli" }: { backHref?: string }) {
  const params = useSearchParams();
  const { analyses } = usePayAnalyses();
  const { get, sectorOf } = useBenchmarks();
  const { run, scope: defaultScope, isRunning } = useBenchmarkRunner();
  const { allowed } = useAccess();
  const canManage = allowed("transparency.manage");
  const [own, setOwn] = useState<BenchmarkScope | null>(null);
  const scope = own ?? defaultScope;
  const [failed, setFailed] = useState(false);
  const doc = analyses.find((a) => a.id === params.get("analysis"));
  const roleName = params.get("role") ?? "";
  const info = useMemo(() => {
    const people = doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : [];
    return rolesOf(people).find((r) => r.role === roleName);
  }, [doc, roleName]);
  const sector = scope.sector || (doc ? sectorOf(doc.id) : undefined);
  const none = !!info && uncovered(info.role);
  const cached = info && sector && !none ? get(benchmarkKey(info, scope, sector)) : undefined;
  const loading = !!doc && isRunning(doc.id, scope);

  // this role in this scope not computed yet: compute it (short pause while the scope is being edited)
  const need = !!doc && !!info && !none && !cached && canManage && !loading && !failed;
  const needKey = need ? JSON.stringify(scope) : "";
  useEffect(() => {
    if (!needKey || !doc || !info) return;
    const t = setTimeout(() => void run(doc.id, info.people, scope).then((r) => setFailed(r === "error")), 700);
    return () => clearTimeout(t);
    // the key covers analysis, role and scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needKey]);

  return (
    <div className="space-y-3.5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr("Benchmarks")}
      </Link>
      {info && (
        <div className="card px-4 py-3">
          <p className="mb-2 text-[12.5px] font-semibold">{tr("Perimetro del confronto")}</p>
          <BenchmarkScopeControls
            scope={scope}
            disabled={!canManage}
            sectorHint={doc ? sectorOf(doc.id) : undefined}
            onChange={(s) => {
              setOwn(s);
              setFailed(false);
            }}
          />
        </div>
      )}
      {info && cached?.stats ? (
        <BenchmarkDetail
          role={info.role}
          level={info.level}
          people={info.people}
          stats={cached.stats}
          scopeText={[doc!.name, ...scopeParts({ ...scope, sector }).map((p) => tr(p))].join(" · ")}
        />
      ) : info && !none && (loading || need) ? (
        <div className="card h-56 animate-pulse" aria-label={tr("Caricamento…")} />
      ) : (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {failed ? tr("Dati di mercato non disponibili al momento.") : none || cached ? tr("Dati insufficienti per questo ruolo") : tr("Benchmark non disponibile per questo ruolo.")}
        </div>
      )}
    </div>
  );
}

/**
 * One role against its market benchmark: where each person's full-time base pay sits in the market
 * range (strip chart by gender over the Q1–Q3 band), the counts per band and a table.
 */
export function BenchmarkDetail({ role, level, people, stats, scopeText }: { role: string; level?: string; people: Employee[]; stats: BenchmarkStats; scopeText: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(
    () =>
      people
        .map((p) => ({ p, pay: personPay(p, SALARY_METRICS.base) }))
        .filter((x): x is { p: Employee; pay: number } => x.pay != null && x.pay > 0 && (x.p.gender === "M" || x.p.gender === "F"))
        .map((x) => ({ ...x, ratio: x.pay / stats.median, band: marketBand(x.pay, stats) }))
        .sort((a, b) => b.pay - a.pay),
    [people, stats],
  );
  const avg = (g?: "M" | "F") => {
    const v = rows.filter((r) => !g || r.p.gender === g).map((r) => r.pay);
    return v.length ? SalaryMath.mean(v) : null;
  };
  const all = avg();
  const counts = (["sotto", "q1", "q3", "sopra"] as MarketBand[]).map((b) => ({ band: b, n: rows.filter((r) => r.band === b).length }));

  // x scale over market range and people
  const values = [stats.min, stats.max, ...rows.map((r) => r.pay)];
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const x = (v: number) => PAD_L + ((v - lo) / (hi - lo || 1)) * (W - PAD_L - PAD_R);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  const groups = (["M", "F"] as const).filter((g) => rows.some((r) => r.p.gender === g));
  const H = 28 + groups.length * ROW + 26;
  const rowY = (i: number) => 28 + i * ROW + ROW / 2;
  const hovered = hover == null ? null : rows[hover];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[14px] font-semibold">{role}</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {tr("{0} persone", [rows.length])}
          {level && ` · ${level}`} · {scopeText}
        </p>
      </div>
      <div className="card space-y-4 p-4">

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Mediana di mercato", value: eur(stats.median) },
            { label: "RAL media azienda", value: eur(all), sub: all ? gap(((all - stats.median) / stats.median) * 100) : undefined },
            { label: "Compa-ratio medio", value: all ? num(all / stats.median, 2) : "–", sub: tr("RAL / mediana") },
            { label: "Sotto il Q1", value: String(counts[0]!.n), sub: tr("su {0} persone", [rows.length]) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(k.label)}</p>
              <p className="mt-0.5 text-[16px] font-bold tabular-nums">{k.value}</p>
              {k.sub && <p className="text-[11.5px] text-muted tabular-nums">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
            {groups.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR[g] }} />
                {g === "M" ? tr("Uomini") : tr("Donne")}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-[#e3ecfb]" />
              {tr("Mercato Q1–Q3")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-0.5 bg-ink" />
              {tr("Mediana")}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("Retribuzioni delle persone rispetto al range di mercato")}>
            {/* grid + axis */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={20} y2={H - 22} stroke="#eef0f4" />
                <text x={x(t)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a93a3">
                  {`${Math.round(t / 1000)}k`}
                </text>
              </g>
            ))}
            {/* market: min–max whisker, Q1–Q3 band, median */}
            <line x1={x(stats.min)} x2={x(stats.max)} y1={14} y2={14} stroke="#9aa2b1" strokeWidth={2} strokeLinecap="round" />
            <rect x={x(stats.q1)} y={20} width={Math.max(2, x(stats.q3) - x(stats.q1))} height={H - 42} rx={4} fill="#e3ecfb" />
            <line x1={x(stats.median)} x2={x(stats.median)} y1={8} y2={H - 22} stroke="#191919" strokeWidth={2} />
            <text x={x(stats.median)} y={7} textAnchor="middle" fontSize="10.5" fontWeight={700} fill="#191919">
              {tr("mediana {0}", [`${Math.round(stats.median / 1000)}k`])}
            </text>
            {/* people, one row per gender */}
            {groups.map((g, gi) => (
              <g key={g}>
                <text x={PAD_L - 10} y={rowY(gi) + 4} textAnchor="end" fontSize="11.5" fill="#666666">
                  {g === "M" ? tr("Uomini") : tr("Donne")}
                </text>
                {rows.map((r, i) =>
                  r.p.gender !== g ? null : (
                    <circle
                      key={i}
                      cx={x(r.pay)}
                      cy={rowY(gi) + ((i % 5) - 2) * 4}
                      r={hover === i ? 6 : 4.5}
                      fill={COLOR[g]}
                      stroke="#ffffff"
                      strokeWidth={2}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      className="cursor-default"
                    />
                  ),
                )}
              </g>
            ))}
          </svg>
          {hovered && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] text-white shadow-lg"
              style={{ left: `${(x(hovered.pay) / W) * 100}%`, top: 18 }}
            >
              <p className="font-semibold">{hovered.p.name || hovered.p.employeeId || tr("Dipendente")}</p>
              <p className="tabular-nums">
                {eur(hovered.pay)} · {tr("compa-ratio {0}", [num(hovered.ratio, 2)])}
              </p>
              <p className="text-white/70">{tr(BAND_LABEL[hovered.band])}</p>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {counts.map((c) => (
            <div key={c.band} className="rounded-lg bg-canvas px-3 py-1.5 text-[12px]">
              <span className="text-muted">{tr(BAND_LABEL[c.band])}</span>
              <span className="float-right font-semibold tabular-nums">{c.n}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted">
          {tr("Uomini: media {0} ({1} rispetto alla mediana) · Donne: media {2} ({3})", [
            eur(avg("M")),
            avg("M") ? gap(((avg("M")! - stats.median) / stats.median) * 100) : "n/d",
            eur(avg("F")),
            avg("F") ? gap(((avg("F")! - stats.median) / stats.median) * 100) : "n/d",
          ])}
        </p>

      </div>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                <th className="px-3 py-2">{tr("Persona")}</th>
                <th className="px-3 py-2">{tr("Sesso")}</th>
                <th className="px-3 py-2 text-right">{tr("RAL a tempo pieno")}</th>
                <th className="px-3 py-2 text-right">{tr("Compa-ratio")}</th>
                <th className="px-3 py-2">{tr("Posizione")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <td className="px-3 py-1.5 font-semibold">{r.p.name || r.p.employeeId || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR[r.p.gender as "M" | "F"] }} />
                      {r.p.gender === "F" ? tr("Donna") : tr("Uomo")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.pay)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(r.ratio, 2)}</td>
                  <td className="px-3 py-1.5 text-muted">{tr(BAND_LABEL[r.band])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
