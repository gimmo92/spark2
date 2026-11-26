import { Employee } from "../models/Employee";
import type { SalaryMetric } from "../models/constants";
import { SalaryMath } from "./SalaryMath";
import { GapGroupAnalyzer } from "./GapGroupAnalyzer";
import { OutlierCalculator, type OutlierResult } from "./OutlierCalculator";

export type QuartilePerson = {
  index: number;
  employeeId: string | null;
  name: string | null;
  gender: string;
  role: string | null;
  level: string | null;
  salary: number;
};

export class LevelGapRow {
  levelKey!: string;
  levelLabel!: string;
  gap!: number | null;
  nM!: number;
  nF!: number;
  insufficientSample!: boolean;
  sampleMsg!: string;

  constructor(init: LevelGapRow) {
    Object.assign(this, init);
  }
}

export class SalaryQuartile {
  quartile!: number;
  people!: QuartilePerson[];
  maschile!: number;
  femminile!: number;
  totale!: number;
  avgMaschile!: number | null;
  avgFemminile!: number | null;
  barPctM!: number;
  barPctF!: number;
  gapPct!: number | null;
  pctOfTotalM!: number | null;
  pctOfTotalF!: number | null;

  constructor(init: SalaryQuartile) {
    Object.assign(this, init);
  }
}

export class EuDashboardResult {
  metric!: SalaryMetric;
  fte!: boolean;
  gapMean!: number | null;
  gapMedian!: number | null;
  gapHourlyMean!: number | null;
  gapHourlyMedian!: number | null;
  gapVarMean!: number | null;
  gapVarMedian!: number | null;
  pctMenWithVar!: number | null;
  pctWomenWithVar!: number | null;
  nMaschi!: number;
  nFemmine!: number;
  nTotaleAnalizzati!: number;
  quartiles!: SalaryQuartile[];
  quartilePeople!: QuartilePerson[][];
  levelRows!: LevelGapRow[];
  outliers!: OutlierResult;

  constructor(init: EuDashboardResult) {
    Object.assign(this, init);
  }
}

export type PayOf = (person: Employee) => number | null;

/** First quartiles take the remainder, so the four sizes differ by at most one. */
function quartileIndex(index: number, total: number): number {
  const base = Math.floor(total / 4);
  const extra = total % 4;
  let cursor = 0;
  for (let quartile = 0; quartile < 4; quartile += 1) {
    cursor += base + (quartile < extra ? 1 : 0);
    if (index < cursor) return quartile;
  }
  return 3;
}

function positivePay(
  person: Employee,
  metric: SalaryMetric,
  fte: boolean,
  payOf?: PayOf
): number | null {
  const value = payOf ? payOf(person) : person.comparisonValue(metric, { fte });
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

export class EuGenderDashboardCalculator {
  static assignQuartiles(
    employees: Employee[],
    metric: SalaryMetric,
    fte = true,
    payOf?: PayOf
  ): Array<{ quartile: number; people: QuartilePerson[] }> {
    const groups = [1, 2, 3, 4].map((quartile) => ({
      quartile,
      people: [] as QuartilePerson[],
    }));
    const sorted = (employees || [])
      .map((person) => ({ person, salary: positivePay(person, metric, fte, payOf) }))
      .filter((row): row is { person: Employee; salary: number } => row.salary != null)
      .sort((a, b) => a.salary - b.salary);
    if (!sorted.length) return groups;
    sorted.forEach(({ person, salary }, idx) => {
      const qIndex = quartileIndex(idx, sorted.length);
      groups[qIndex].people.push({
        index: person.index,
        employeeId: person.employeeId ?? null,
        name: person.name,
        gender: person.gender,
        role: person.role,
        level: person.level,
        salary,
      });
    });
    return groups;
  }

  static compute(
    employees: Employee[],
    metric: SalaryMetric,
    { fte = true, payOf }: { fte?: boolean; payOf?: PayOf } = {}
  ): EuDashboardResult {
    const amount = (person: Employee) => positivePay(person, metric, fte, payOf);
    const males = (employees || []).filter(
      (r) => r.gender === "M" && amount(r) != null
    );
    const females = (employees || []).filter(
      (r) => r.gender === "F" && amount(r) != null
    );
    const mVals = males.map((person) => amount(person) as number);
    const fVals = females.map((person) => amount(person) as number);
    const gapMean =
      mVals.length && fVals.length
        ? SalaryMath.pctGap(SalaryMath.mean(mVals), SalaryMath.mean(fVals))
        : null;
    const gapMedian =
      mVals.length && fVals.length
        ? SalaryMath.pctGap(SalaryMath.median(mVals), SalaryMath.median(fVals))
        : null;

    const hourlyValues = (people: Employee[]) =>
      people
        .map((person) => person.hourlyPay())
        .filter((value): value is number => value != null);
    const population = employees || [];
    const mHourly = hourlyValues(population.filter((person) => person.gender === "M"));
    const fHourly = hourlyValues(population.filter((person) => person.gender === "F"));
    const gapHourlyMean =
      mHourly.length && fHourly.length
        ? SalaryMath.pctGap(SalaryMath.mean(mHourly), SalaryMath.mean(fHourly))
        : null;
    const gapHourlyMedian =
      mHourly.length && fHourly.length
        ? SalaryMath.pctGap(SalaryMath.median(mHourly), SalaryMath.median(fHourly))
        : null;

    const paidVariable = (person: Employee) => {
      const value = fte ? person.variableComponentsFte : person.variableComponents;
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    const mVar = population
      .filter((person) => person.gender === "M")
      .map(paidVariable)
      .filter((value): value is number => value != null);
    const fVar = population
      .filter((person) => person.gender === "F")
      .map(paidVariable)
      .filter((value): value is number => value != null);
    const gapVarMean =
      mVar.length && fVar.length
        ? SalaryMath.pctGap(SalaryMath.mean(mVar), SalaryMath.mean(fVar))
        : null;
    const gapVarMedian =
      mVar.length && fVar.length
        ? SalaryMath.pctGap(SalaryMath.median(mVar), SalaryMath.median(fVar))
        : null;

    const allM = (employees || []).filter((r) => r.gender === "M");
    const allF = (employees || []).filter((r) => r.gender === "F");
    const mWithVar = allM.filter(
      (r) => Number.isFinite(r.variableComponents) && r.variableComponents > 0
    ).length;
    const fWithVar = allF.filter(
      (r) => Number.isFinite(r.variableComponents) && r.variableComponents > 0
    ).length;

    const qGroups = EuGenderDashboardCalculator.assignQuartiles(
      employees,
      metric,
      fte,
      payOf
    );
    const quartiles = qGroups.map(
      ({ quartile, people }) => {
        const mPeople = people.filter((p) => p.gender === "M");
        const fPeople = people.filter((p) => p.gender === "F");
        const mSalaries = mPeople.map((p) => p.salary);
        const fSalaries = fPeople.map((p) => p.salary);
        const avgMaschile = mSalaries.length ? SalaryMath.mean(mSalaries) : null;
        const avgFemminile = fSalaries.length ? SalaryMath.mean(fSalaries) : null;
        const maxAvg = Math.max(avgMaschile ?? 0, avgFemminile ?? 0);
        let gapPct: number | null = null;
        if (
          avgMaschile != null &&
          avgFemminile != null &&
          avgMaschile > 0
        ) {
          gapPct = SalaryMath.pctGap(avgMaschile, avgFemminile);
        }
        return new SalaryQuartile({
          quartile,
          people,
          maschile: mPeople.length,
          femminile: fPeople.length,
          totale: people.length,
          avgMaschile,
          avgFemminile,
          barPctM: maxAvg > 0 && avgMaschile != null ? (avgMaschile / maxAvg) * 100 : 0,
          barPctF: maxAvg > 0 && avgFemminile != null ? (avgFemminile / maxAvg) * 100 : 0,
          gapPct,
          pctOfTotalM: null,
          pctOfTotalF: null,
        });
      }
    );
    quartiles.forEach((q) => {
      q.pctOfTotalM = q.totale > 0 ? (q.maschile / q.totale) * 100 : null;
      q.pctOfTotalF = q.totale > 0 ? (q.femminile / q.totale) * 100 : null;
    });

    const quartileOf = new Map<number, number>();
    qGroups.forEach((g) => {
      g.people.forEach((p) => quartileOf.set(p.index, g.quartile));
    });

    const getSalary = payOf || ((p: Employee) => p.comparisonValue(metric, { fte }));
    const levelRows = GapGroupAnalyzer.byCcnlThenLevel(employees, getSalary).flatMap(
      (group) =>
        group.levels.map(
          (row) =>
            new LevelGapRow({
              levelKey: `${group.ccnlKey}::${row.levelKey || row.groupKey}`,
              levelLabel: `${group.ccnlLabel} · ${row.groupLabel}`,
              gap: row.gapMean,
              nM: row.nM,
              nF: row.nF,
              insufficientSample: row.insufficientSample,
              sampleMsg: row.sampleMsg,
            })
        )
    );

    const outliers = OutlierCalculator.compute(employees, metric, {
      fte,
      quartileOf,
      payOf,
    });

    return new EuDashboardResult({
      metric,
      fte,
      gapMean,
      gapMedian,
      gapHourlyMean,
      gapHourlyMedian,
      gapVarMean,
      gapVarMedian,
      pctMenWithVar: allM.length > 0 ? (mWithVar / allM.length) * 100 : null,
      pctWomenWithVar: allF.length > 0 ? (fWithVar / allF.length) * 100 : null,
      nMaschi: males.length,
      nFemmine: females.length,
      nTotaleAnalizzati: males.length + females.length,
      quartiles,
      quartilePeople: qGroups.map((g) => g.people),
      levelRows,
      outliers,
    });
  }
}
