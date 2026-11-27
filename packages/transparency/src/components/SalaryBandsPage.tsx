"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { localeTag, tr, useAccess, useOrg, useSettings } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { benchmarkKey, effectiveSector, uncovered } from "../lib/benchmark";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { bandName, rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { useBenchmarkRunner } from "./benchmarkRunner";
import { eur, gap, num } from "./format";
import { ExpandToggle, GroupPeople, type PersonOpener } from "./GroupPeople";
import { PayStripChart } from "./PayStripChart";
import { useEqualValueBands } from "./RoleWeights";

type Approach = "ccnl" | "jobgrading" | "mercato";

const APPROACHES: { id: Approach; label: string }[] = [
  { id: "ccnl", label: "Per livello CCNL" },
  { id: "jobgrading", label: "Per fascia di job grading" },
  { id: "mercato", label: "Dal mercato (benchmark per ruolo)" },
];

/** Company choices for the salary bands (settings doc "salaryBands"). */
interface BandSettings {
  approach: Approach;
  /** Half-width of internal bands around the midpoint, % (min = mid − spread, max = mid + spread). */
  spread: number;
}
const DEFAULTS: BandSettings = { approach: "ccnl", spread: 15 };

interface Band {
  key: string;
  label: string;
  sub?: string;
  people: Employee[];
  min: number;
  mid: number;
  max: number;
}

const base = (e: Employee) => {
  const v = personPay(e, SALARY_METRICS.base);
  return v != null && v > 0 ? v : null;
};
const median = (people: Employee[]) => {
  const v = people.map(base).filter((x): x is number => x != null);
  return v.length ? SalaryMath.median(v) : null;
};

/**
 * Compensation → Salary bands: pay ranges (min · midpoint · max of full-time base pay) built with
 * the approach the company picks: by CCNL level or job-grading band (midpoint = the group's median,
 * ± a chosen spread) or from the market benchmarks of each role (Q1 · median · Q3). Each band shows
 * who is below the minimum or above the maximum and expands into its people.
 */
export function SalaryBandsPage({ uploadHref = "/caricamento-dati", employeeHref = "/trasparenza/dipendente" }: { uploadHref?: string; employeeHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { allowed } = useAccess();
  const canManage = allowed("transparency.manage");
  const [stored, patch] = useSettings<BandSettings>("salaryBands", DEFAULTS);
  const settings = { approach: APPROACHES.some((a) => a.id === stored.approach) ? stored.approach : DEFAULTS.approach, spread: Math.min(50, Math.max(1, Number(stored.spread) || DEFAULTS.spread)) };
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const doc = analyses.find((a) => a.id === params.get("analisi")) ?? analyses[0];
  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // job-grading bands and market benchmarks (same figures as their own pages)
  const { bands: gradeBands } = useEqualValueBands(people, base);
  const { get, sectorOf, familyOf } = useBenchmarks();
  const { scope } = useBenchmarkRunner();
  const org = useOrg();
  const sector = effectiveSector(scope, org.sector, doc ? sectorOf(doc.id) : undefined);

  const spread = settings.spread / 100;
  const around = (mid: number) => ({ min: mid * (1 - spread), mid, max: mid * (1 + spread) });
  let bands: Band[] = [];
  if (settings.approach === "ccnl") {
    const groups = new Map<string, Employee[]>();
    for (const e of people) {
      const k = `${String(e.ccnl ?? "").trim()}|${LevelTaxonomy.normalize(e.level) ?? ""}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    bands = [...groups.entries()]
      .map(([key, list]): Band | null => {
        const mid = median(list);
        const first = list[0]!;
        return mid == null ? null : { key, label: LevelTaxonomy.displayLabel(first.level), sub: String(first.ccnl ?? "").trim() || undefined, people: list, ...around(mid) };
      })
      .filter((b): b is Band => !!b);
  } else if (settings.approach === "jobgrading") {
    bands = gradeBands
      .map(({ band, row }): Band | null => {
        const mid = median(row.people);
        return mid == null ? null : { key: `jg-${band}`, label: bandName(band), sub: tr("{0} punti", [row.groupLabel]), people: row.people, ...around(mid) };
      })
      .filter((b): b is Band => !!b);
  } else {
    bands = rolesOf(people)
      .map((r): Band | null => {
        const stats = sector && !uncovered(r.role) ? get(benchmarkKey({ ...r, aliases: familyOf(r.role)?.titles }, scope, sector))?.stats : undefined;
        return stats ? { key: `mk-${r.role}`, label: r.role, sub: r.level, people: r.people, min: stats.q1, mid: stats.median, max: stats.q3 } : null;
      })
      .filter((b): b is Band => !!b);
  }
  bands.sort((a, b) => b.mid - a.mid);

  const opener: PersonOpener = { href: (e) => `${employeeHref}?analisi=${encodeURIComponent(doc?.id ?? "")}&dip=${e.index}` };
  const stat = (b: Band) => {
    const pays = b.people.map(base).filter((x): x is number => x != null);
    return {
      n: pays.length,
      below: pays.filter((p) => p < b.min).length,
      above: pays.filter((p) => p > b.max).length,
      cr: pays.length ? SalaryMath.mean(pays.map((p) => p / b.mid)) : null,
    };
  };
  const totals = bands.reduce((t, b) => {
    const s = stat(b);
    return { n: t.n + s.n, below: t.below + s.below, above: t.above + s.above };
  }, { n: 0, below: 0, above: 0 });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[14px] font-semibold">{tr("Salary bands")}</h1>
        {analyses.length > 1 && doc && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Dati")}
            <select
              value={doc.id}
              onChange={(e) => router.replace(`${pathname}?analisi=${encodeURIComponent(e.target.value)}`, { scroll: false })}
              className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand"
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
          {tr("Nessun dato caricato.")}{" "}
          {canManage && (
            <Link href={uploadHref} className="font-semibold text-brand hover:underline">
              {tr("Carica il tracciato retributivo")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
            <label>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Approccio")}</span>
              <select
                disabled={!canManage}
                value={settings.approach}
                onChange={(e) => patch({ approach: e.target.value as Approach })}
                className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-brand disabled:bg-canvas"
              >
                {APPROACHES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {tr(a.label)}
                  </option>
                ))}
              </select>
            </label>
            {settings.approach !== "mercato" && (
              <label className="w-[150px]">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Ampiezza ±")}</span>
                <span className="relative block">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={!canManage}
                    value={settings.spread}
                    onChange={(e) => patch({ spread: Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                    className="w-full rounded-lg border border-[#dfe3ea] bg-white py-1.5 pl-2 pr-6 text-[12.5px] tabular-nums outline-none focus:border-brand disabled:bg-canvas"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11.5px] text-muted">%</span>
                </span>
              </label>
            )}
            <div className="ml-auto flex gap-4 text-[12.5px]">
              <span>
                <span className="text-muted">{tr("Sotto il minimo")}</span> <span className="font-semibold tabular-nums text-red-600">{totals.below}</span>
              </span>
              <span>
                <span className="text-muted">{tr("Sopra il massimo")}</span> <span className="font-semibold tabular-nums text-amber-700">{totals.above}</span>
              </span>
              <span>
                <span className="text-muted">{tr("Nelle fasce")}</span> <span className="font-semibold tabular-nums">{totals.n - totals.below - totals.above}</span>
              </span>
            </div>
          </div>

          {!bands.length ? (
            <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
              {settings.approach === "mercato" ? tr("Nessun benchmark di mercato ancora disponibile per questi dati: apri Benchmarks per prepararli.") : tr("Nessuna fascia: mancano i dati necessari.")}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                    <th className="px-3 py-2.5 pl-4">{tr("Fascia")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Persone")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Minimo")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Punto medio")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Massimo")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Sotto il minimo")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Sopra il massimo")}</th>
                    <th className="px-3 py-2.5 pr-4 text-right">{tr("Compa-ratio medio")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b) => {
                    const s = stat(b);
                    return (
                      <Fragment key={b.key}>
                        <tr className="border-b border-line text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                          <td className="px-3 py-2 pl-3">
                            <ExpandToggle open={!!open[b.key]} label={b.label} onClick={() => setOpen((o) => ({ ...o, [b.key]: !o[b.key] }))} />
                            <span className="font-semibold">{b.label}</span>
                            {b.sub && <span className="block pl-6 text-[11.5px] text-muted">{b.sub}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{s.n}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(b.min)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{eur(b.mid)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(b.max)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${s.below ? "font-semibold text-red-600" : "text-muted"}`}>{s.below}</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${s.above ? "font-semibold text-amber-700" : "text-muted"}`}>{s.above}</td>
                          <td className="px-3 py-2 pr-4 text-right tabular-nums">
                            {s.cr == null ? "–" : num(s.cr, 2)}
                            {s.cr != null && <span className="ml-1 text-[11px] text-muted">{gap((s.cr - 1) * 100)}</span>}
                          </td>
                        </tr>
                        {open[b.key] && (
                          <tr className="border-b border-line">
                            <td colSpan={8} className="p-0">
                              <div className="bg-[#fafbfd] px-4 pt-3">
                                <PayStripChart
                                  ariaLabel={tr("Retribuzioni rispetto alla fascia")}
                                  points={b.people
                                    .map((e) => ({ e, v: base(e) }))
                                    .filter((x): x is { e: Employee; v: number } => x.v != null && (x.e.gender === "M" || x.e.gender === "F"))
                                    .map(({ e, v }) => ({ key: e.index, value: v, gender: e.gender as "M" | "F", label: e.name || e.employeeId || tr("Dipendente") }))}
                                  band={{ from: b.min, to: b.max, label: tr("Fascia retributiva") }}
                                  lines={[{ value: b.mid, label: tr("Punto medio") }]}
                                />
                              </div>
                              <GroupPeople people={b.people} opener={opener} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
