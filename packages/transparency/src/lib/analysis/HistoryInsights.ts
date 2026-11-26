import { CompensationAnalysis } from "./CompensationAnalysis";
import { LevelTaxonomy } from "./LevelTaxonomy";
import { SalaryMath } from "./SalaryMath";
import { Employee } from "../models/Employee";
import { EU_GAP_THRESHOLD_PCT, SALARY_METRICS, type SalaryMetric } from "../models/constants";

export type HistoryBandCell = {
  level: string | null;
  fasciaId: string;
  fasciaLabel: string;
  score: number;
  n: number;
  nMen: number;
  nWomen: number;
  avgTotal: number | null;
  avgBase: number | null;
  avgVar: number | null;
  avgMen: number | null;
  avgWomen: number | null;
  gapPct: number | null;
};

export type HistoryLevelCell = {
  level: string;
  n: number;
  nMen: number;
  nWomen: number;
  avgTotal: number | null;
  avgBase: number | null;
  avgVar: number | null;
  gapPct: number | null;
};

export type HistorySnapshot = {
  n: number;
  nMen: number;
  nWomen: number;
  avgTotal: number | null;
  avgBase: number | null;
  avgVar: number | null;
  avgMen: number | null;
  avgWomen: number | null;
  gapMean: number | null;
  gapMedian: number | null;
  levels: HistoryLevelCell[];
  bands: HistoryBandCell[];
};

export type HistoryPoint = {
  id: string;
  createdAt: string;
  label: string;
  snapshot: HistorySnapshot;
};

const TOTAL = SALARY_METRICS.totale;

function amounts(people: Employee[], metric: SalaryMetric): number[] {
  return people
    .map((person) => person.comparisonValue(metric, { fte: true }))
    .filter((value): value is number => value != null);
}

function meanOf(people: Employee[], metric: SalaryMetric): number | null {
  const values = amounts(people, metric);
  return values.length ? SalaryMath.mean(values) : null;
}

export function payKpis(employees: Employee[]): Omit<HistorySnapshot, "levels" | "bands"> {
  const valid = (employees || []).filter(
    (person) =>
      (person.gender === "M" || person.gender === "F") &&
      person.comparisonValue(TOTAL, { fte: true }) != null
  );
  const men = valid.filter((person) => person.gender === "M");
  const women = valid.filter((person) => person.gender === "F");
  const avgMen = meanOf(men, TOTAL);
  const avgWomen = meanOf(women, TOTAL);
  const menTotals = amounts(men, TOTAL);
  const womenTotals = amounts(women, TOTAL);
  return {
    n: valid.length,
    nMen: men.length,
    nWomen: women.length,
    avgTotal: meanOf(valid, TOTAL),
    avgBase: meanOf(valid, SALARY_METRICS.base),
    avgVar: meanOf(valid, SALARY_METRICS.variabile),
    avgMen,
    avgWomen,
    gapMean:
      avgMen != null && avgWomen != null
        ? SalaryMath.genderPayGapPct(avgMen, avgWomen)
        : null,
    gapMedian:
      menTotals.length && womenTotals.length
        ? SalaryMath.genderPayGapPct(
            SalaryMath.median(menTotals),
            SalaryMath.median(womenTotals)
          )
        : null,
  };
}

export function snapshotFromAnalysis(analysis: CompensationAnalysis): HistorySnapshot {
  const levelMap = new Map<string, Employee[]>();
  for (const person of analysis.employees) {
    if (person.gender !== "M" && person.gender !== "F") continue;
    const level = LevelTaxonomy.displayLabel(person.level);
    const bucket = levelMap.get(level);
    if (bucket) bucket.push(person);
    else levelMap.set(level, [person]);
  }
  const levels = Array.from(levelMap.entries())
    .map(([level, people]) => ({
      level,
      ...(() => {
        const stats = payKpis(people);
        return {
          n: stats.n,
          nMen: stats.nMen,
          nWomen: stats.nWomen,
          avgTotal: stats.avgTotal,
          avgBase: stats.avgBase,
          avgVar: stats.avgVar,
          gapPct: stats.gapMean,
        };
      })(),
    }))
    .sort(
      (a, b) =>
        LevelTaxonomy.sortOrder(b.level) - LevelTaxonomy.sortOrder(a.level) ||
        a.level.localeCompare(b.level, "it")
    );

  const bands: HistoryBandCell[] = analysis.gradingClusters(TOTAL).map((cluster) => ({
    level: null,
    fasciaId: cluster.fasciaId,
    fasciaLabel: cluster.fasciaLabel,
    score: cluster.score,
    n: cluster.nTotal,
    nMen: cluster.nM,
    nWomen: cluster.nF,
    avgTotal: cluster.avgTotal,
    avgBase: cluster.avgBase,
    avgVar: cluster.avgVar,
    avgMen: cluster.avgMen,
    avgWomen: cluster.avgWomen,
    gapPct: cluster.gap,
  }));

  return {
    ...payKpis(analysis.employees),
    levels,
    bands,
  };
}

type StoredDocument = {
  id?: string;
  created_at?: string;
  original_filename?: string;
  display_name?: string | null;
  dummy_results_json?: unknown;
};

export function buildHistoryView(documents: StoredDocument[], { maxPoints = 8 } = {}) {
  const points: HistoryPoint[] = (documents || [])
    .map((document) => {
      const analysis = CompensationAnalysis.fromSnapshot(
        document.dummy_results_json as Parameters<
          typeof CompensationAnalysis.fromSnapshot
        >[0]
      );
      if (!analysis?.employeeCount) return null;
      return {
        id: String(document.id || document.created_at || document.original_filename),
        createdAt: document.created_at || "",
        label:
          String(document.display_name || "").trim() ||
          String(
            (document.dummy_results_json as { savedName?: string } | null)?.savedName || ""
          ).trim() ||
          String(document.original_filename || "").trim() ||
          "Analisi",
        snapshot: snapshotFromAnalysis(analysis),
      };
    })
    .filter((point): point is HistoryPoint => point != null)
    .sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

  const shown = points.slice(-maxPoints);
  const levelOrder: string[] = [];
  const bandOrder: { key: string; score: number; fasciaLabel: string }[] = [];
  for (const point of shown) {
    for (const level of point.snapshot.levels) {
      if (!levelOrder.includes(level.level)) levelOrder.push(level.level);
    }
    for (const band of point.snapshot.bands) {
      const key = String(band.score);
      if (!bandOrder.some((row) => row.key === key)) {
        bandOrder.push({ key, score: band.score, fasciaLabel: band.fasciaLabel });
      }
    }
  }

  return {
    points,
    shown,
    hiddenCount: Math.max(0, points.length - shown.length),
    latest: points[points.length - 1] || null,
    previous: points.length > 1 ? points[points.length - 2] : null,
    levels: levelOrder.map((level) => ({
      level,
      cells: shown.map(
        (point) => point.snapshot.levels.find((row) => row.level === level) || null
      ),
    })),
    bands: bandOrder
      .sort((a, b) => b.score - a.score)
      .map((meta) => ({
        ...meta,
        level: null as string | null,
        cells: shown.map(
          (point) => point.snapshot.bands.find((row) => row.score === meta.score) || null
        ),
      })),
  };
}

export function gapSeverityClass(gap: number | null): string {
  if (gap == null || !Number.isFinite(gap)) return "gap-severity-na";
  const abs = Math.abs(gap);
  if (abs < 4) return "gap-severity-green";
  if (abs <= EU_GAP_THRESHOLD_PCT) return "gap-severity-yellow";
  return "gap-severity-red";
}

export function deltaOf(after: number | null | undefined, before: number | null | undefined) {
  if (after == null || before == null) return null;
  if (!Number.isFinite(Number(after)) || !Number.isFinite(Number(before))) return null;
  return Number(after) - Number(before);
}
