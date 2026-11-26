import { Employee } from "../models/Employee";
import {
  EU_GAP_THRESHOLD_PCT,
  MAX_QUARTILE_OUTLIERS,
  type SalaryMetric,
} from "../models/constants";
import { SalaryMath } from "./SalaryMath";
import type { PayOf } from "./EuGenderDashboardCalculator";

export class PayOutlier {
  index!: number;
  employeeId!: string | null;
  name!: string | null;
  gender!: string;
  salary!: number;
  quartile!: number;
  deviationPct!: number;
  reason!: string;

  constructor(init: PayOutlier) {
    Object.assign(this, init);
  }
}

export class OutlierResult {
  rows!: PayOutlier[];
  total!: number;
  truncated!: boolean;
  average!: number | null;

  constructor(init: OutlierResult) {
    Object.assign(this, init);
  }
}

export class OutlierCalculator {
  static compute(
    employees: Employee[],
    metric: SalaryMetric,
    {
      fte = true,
      quartileOf,
      payOf,
    }: { fte?: boolean; quartileOf?: Map<number, number>; payOf?: PayOf } = {}
  ): OutlierResult {
    const empty = new OutlierResult({
      rows: [],
      total: 0,
      truncated: false,
      average: null,
    });
    const salaryOf = (person: Employee): number | null => {
      const value = payOf
        ? payOf(person)
        : person.comparisonValue(metric, { fte });
      return value != null && Number.isFinite(value) && value > 0 ? value : null;
    };
    const valid = (employees || []).filter(
      (r) => (r.gender === "M" || r.gender === "F") && salaryOf(r) != null
    );
    if (valid.length < 2) return empty;
    const groups = new Map<string, Employee[]>();
    valid.forEach((person) => {
      const key = `${String(person.ccnl || "").trim()}::${String(person.level || "").trim()}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(person);
      else groups.set(key, [person]);
    });

    const outliers: PayOutlier[] = [];
    let overallAverage = 0;
    let overallCount = 0;
    groups.forEach((group) => {
      if (group.length < 2) return;
      const values = group
        .map(salaryOf)
        .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
      const avg = SalaryMath.mean(values);
      if (!avg) return;
      overallAverage += avg * values.length;
      overallCount += values.length;
      group.forEach((person) => {
        const value = salaryOf(person);
        if (value == null || !Number.isFinite(value) || value <= 0) return;
        const rounded = Math.round((((value - avg) / avg) * 100) * 10) / 10;
        if (Math.abs(rounded) <= EU_GAP_THRESHOLD_PCT) return;
        const sign = rounded > 0 ? "+" : "";
        outliers.push(
          new PayOutlier({
            index: person.index,
            employeeId: person.employeeId ?? null,
            name: person.name,
            gender: person.gender,
            salary: value,
            quartile: quartileOf?.get(person.index) ?? 1,
            deviationPct: rounded,
            reason: `${sign}${rounded.toFixed(1)}% dalla media del livello (${Math.round(avg).toLocaleString("it-IT")})`,
          })
        );
      });
    });
    const avg = overallCount ? overallAverage / overallCount : null;
    if (!outliers.length && avg == null) return empty;

    const ranked = outliers.sort(
      (a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct)
    );
    return new OutlierResult({
      rows: ranked.slice(0, MAX_QUARTILE_OUTLIERS),
      total: ranked.length,
      truncated: ranked.length > MAX_QUARTILE_OUTLIERS,
      average: avg,
    });
  }
}
