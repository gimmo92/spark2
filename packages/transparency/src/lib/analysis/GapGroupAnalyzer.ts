import { Employee } from "../models/Employee";
import type { GapStatus } from "../models/constants";
import { SalaryMath } from "./SalaryMath";
import { LevelTaxonomy } from "./LevelTaxonomy";

export class GapStats {
  nM: number;
  nF: number;
  nTotal: number;
  avgM: number | null;
  avgF: number | null;
  gapMean: number | null;
  gapMedian: number | null;
  status: GapStatus;
  insufficientSample: boolean;
  sampleMsg: string;
  hasJustification: boolean;

  constructor(init: Partial<GapStats> & { nM: number; nF: number }) {
    this.nM = init.nM;
    this.nF = init.nF;
    this.nTotal = init.nTotal ?? init.nM + init.nF;
    this.avgM = init.avgM ?? null;
    this.avgF = init.avgF ?? null;
    this.gapMean = init.gapMean ?? null;
    this.gapMedian = init.gapMedian ?? null;
    this.status = init.status ?? "green";
    this.insufficientSample = init.insufficientSample ?? false;
    this.sampleMsg = init.sampleMsg ?? "";
    this.hasJustification = init.hasJustification ?? false;
  }
}

export class ComparisonRow extends GapStats {
  groupKey: string;
  groupLabel: string;
  people: Employee[];
  costCenterKey?: string;
  costCenterLabel?: string;
  levelKey?: string;
  levelLabel?: string;
  sortOrder?: number;
  avgHourly: number | null;

  constructor(
    init: ConstructorParameters<typeof GapStats>[0] & {
      groupKey: string;
      groupLabel: string;
      people: Employee[];
      costCenterKey?: string;
      costCenterLabel?: string;
      levelKey?: string;
      levelLabel?: string;
      sortOrder?: number;
      avgHourly?: number | null;
    }
  ) {
    super(init);
    this.groupKey = init.groupKey;
    this.groupLabel = init.groupLabel;
    this.people = init.people;
    this.costCenterKey = init.costCenterKey;
    this.costCenterLabel = init.costCenterLabel;
    this.levelKey = init.levelKey;
    this.levelLabel = init.levelLabel;
    this.sortOrder = init.sortOrder;
    this.avgHourly = init.avgHourly ?? reportedHourlyMean(init.people);
  }
}

export function reportedHourlyMean(people: Employee[]): number | null {
  const values = (people || [])
    .map((person) => person.reportedHourly)
    .filter((value): value is number => value != null && value > 0);
  return values.length ? SalaryMath.mean(values) : null;
}

export class CcnlGroup {
  ccnlKey!: string;
  ccnlLabel!: string;
  levels!: ComparisonRow[];
  nTotal!: number;
  nLevels!: number;

  constructor(init: CcnlGroup) {
    Object.assign(this, init);
  }
}

export class GapGroupAnalyzer {
  static analyze(
    people: Employee[],
    getSalary: (p: Employee) => number | null,
    { hasJustification = false } = {}
  ): GapStats {
    const withSal = (people || []).filter(
      (p) => (p.gender === "M" || p.gender === "F") && getSalary(p) != null
    );
    const nM = withSal.filter((p) => p.gender === "M").length;
    const nF = withSal.filter((p) => p.gender === "F").length;
    const mVals = withSal.filter((p) => p.gender === "M").map(getSalary) as number[];
    const fVals = withSal.filter((p) => p.gender === "F").map(getSalary) as number[];
    const avgM = mVals.length ? SalaryMath.mean(mVals) : null;
    const avgF = fVals.length ? SalaryMath.mean(fVals) : null;
    const gapMean =
      mVals.length && fVals.length ? SalaryMath.genderPayGapPct(avgM as number, avgF as number) : null;
    const gapMedian =
      mVals.length && fVals.length
        ? SalaryMath.genderPayGapPct(SalaryMath.median(mVals), SalaryMath.median(fVals))
        : null;
    const status = SalaryMath.classifyGapStatus(gapMean, { hasJustification });
    const insufficientSample = !SalaryMath.gapSampleSufficient(nM, nF);
    return new GapStats({
      nM,
      nF,
      nTotal: nM + nF,
      avgM,
      avgF,
      gapMean,
      gapMedian,
      status,
      insufficientSample,
      hasJustification,
      sampleMsg: "",
    });
  }

  static grouped(
    people: Employee[],
    getGroupKey: (p: Employee) => string,
    getSalary: (p: Employee) => number | null
  ): ComparisonRow[] {
    const map = new Map<string, Employee[]>();
    for (const p of people || []) {
      if (p.gender !== "M" && p.gender !== "F") continue;
      const key = getGroupKey(p);
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }
    return Array.from(map.entries())
      .map(([key, groupPeople]) => {
        const stats = GapGroupAnalyzer.analyze(groupPeople, getSalary);
        return new ComparisonRow({
          ...stats,
          groupKey: key,
          groupLabel: key,
          people: groupPeople,
        });
      })
      .sort((a, b) => String(a.groupLabel).localeCompare(String(b.groupLabel), "it"));
  }

  static byCostCenter(
    people: Employee[],
    getSalary: (p: Employee) => number | null
  ): ComparisonRow[] {
    return GapGroupAnalyzer.grouped(
      people,
      (p) => {
        const s = String(p.category ?? "").trim();
        return s || "N/D";
      },
      getSalary
    ).map(
      (row) =>
        new ComparisonRow({
          ...row,
          costCenterKey: row.groupKey,
          costCenterLabel: row.groupLabel,
        })
    );
  }

  static byRole(
    people: Employee[],
    getSalary: (p: Employee) => number | null
  ): ComparisonRow[] {
    return GapGroupAnalyzer.grouped(
      people,
      (p) => {
        const s = String(p.role ?? "").trim();
        return s || "N/D";
      },
      getSalary
    );
  }

  static byLevel(
    people: Employee[],
    getSalary: (p: Employee) => number | null
  ): ComparisonRow[] {
    const map = new Map<string, { sortOrder: number; people: Employee[] }>();
    for (const p of people || []) {
      if (p.gender !== "M" && p.gender !== "F") continue;
      const levelKey = LevelTaxonomy.normalize(p.level) || "N/D";
      const bucket = map.get(levelKey);
      if (bucket) bucket.people.push(p);
      else {
        map.set(levelKey, {
          sortOrder: LevelTaxonomy.sortOrder(p.level),
          people: [p],
        });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => (b[1].sortOrder ?? 0) - (a[1].sortOrder ?? 0))
      .map(([levelKey, { sortOrder, people: groupPeople }]) => {
        const stats = GapGroupAnalyzer.analyze(groupPeople, getSalary);
        const label = LevelTaxonomy.displayLabel(levelKey);
        return new ComparisonRow({
          ...stats,
          groupKey: levelKey,
          groupLabel: label,
          people: groupPeople,
          levelKey,
          levelLabel: label,
          sortOrder,
        });
      });
  }

  static byCcnlThenLevel(
    people: Employee[],
    getSalary: (p: Employee) => number | null
  ): CcnlGroup[] {
    const ccnlMap = new Map<string, Employee[]>();
    for (const p of people || []) {
      if (p.gender !== "M" && p.gender !== "F") continue;
      const ccnlKey = String(p.ccnl ?? "").trim() || "N/D";
      const bucket = ccnlMap.get(ccnlKey);
      if (bucket) bucket.push(p);
      else ccnlMap.set(ccnlKey, [p]);
    }
    return Array.from(ccnlMap.entries())
      .map(([ccnlKey, groupPeople]) => {
        const levels = GapGroupAnalyzer.byLevel(groupPeople, getSalary);
        return new CcnlGroup({
          ccnlKey,
          ccnlLabel: ccnlKey,
          levels,
          nTotal: levels.reduce((s, r) => s + (r.nTotal || 0), 0),
          nLevels: levels.length,
        });
      })
      .sort((a, b) => String(a.ccnlLabel).localeCompare(String(b.ccnlLabel), "it"));
  }
}
