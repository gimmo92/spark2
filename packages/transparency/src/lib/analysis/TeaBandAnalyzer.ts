import { Employee } from "../models/Employee";
import { SalaryMath } from "./SalaryMath";

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => Number.isFinite(v) && (v as number) > 0);
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export type TeaBandRow = {
  band: string;
  bandNum: number | null;
  n: number;
  nMen: number;
  nWomen: number;
  grades: string[];
  gradeLabel: string;
  avgMen: number | null;
  avgWomen: number | null;
  avgAll: number | null;
  gapPct: number | null;
  insufficientSample: boolean;
  people: Employee[];
};

/** Bands taken from the TEA Banda column. Grade is the file value, not a calculated score. */
export function groupByTeaBand(people: Employee[]): TeaBandRow[] {
  const groups = new Map<string, Employee[]>();
  for (const person of people || []) {
    const label = String(person?.payBand ?? "").trim() || "N/D";
    const list = groups.get(label);
    if (list) list.push(person);
    else groups.set(label, [person]);
  }

  const rows: TeaBandRow[] = [];
  for (const [band, list] of groups) {
    const men = list.filter((p) => p.gender === "M");
    const women = list.filter((p) => p.gender === "F");
    const grades = [...new Set(list.map((p) => String(p.grade ?? "").trim()).filter(Boolean))]
      .sort((a, b) => (asNumber(a) ?? 0) - (asNumber(b) ?? 0));
    const insufficientSample = !SalaryMath.gapSampleSufficient(men.length, women.length);
    const avgMen = average(men.map((p) => p.baseSalaryFte));
    const avgWomen = average(women.map((p) => p.baseSalaryFte));
    rows.push({
      band,
      bandNum: asNumber(band),
      n: list.length,
      nMen: men.length,
      nWomen: women.length,
      grades,
      gradeLabel: grades.length ? grades.join(", ") : "–",
      avgMen,
      avgWomen,
      avgAll: average(list.map((p) => p.baseSalaryFte)),
      gapPct: SalaryMath.genderPayGapPct(avgMen ?? 0, avgWomen ?? 0),
      insufficientSample,
      people: list.slice().sort((a, b) => (asNumber(b.grade) ?? 0) - (asNumber(a.grade) ?? 0)),
    });
  }

  rows.sort((a, b) => (a.bandNum ?? 999) - (b.bandNum ?? 999) || a.band.localeCompare(b.band, "it"));
  return rows.map((row) => ({
    ...row,
    gapPct: row.avgMen == null || row.avgWomen == null
      ? null
      : SalaryMath.genderPayGapPct(row.avgMen, row.avgWomen),
  }));
}
