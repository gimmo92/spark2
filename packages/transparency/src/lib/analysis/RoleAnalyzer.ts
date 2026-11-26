import { Employee } from "../models/Employee";
import { EU_GAP_THRESHOLD_PCT } from "../models/constants";
import { SalaryMath } from "./SalaryMath";
import { reportedHourlyMean } from "./GapGroupAnalyzer";

export function cdrLabel(person: Employee | null | undefined): string {
  const desc = String(person?.costCenterDescription ?? "").trim();
  const code = String(person?.costCenterCode ?? "").trim();
  if (desc && code) return `${code} · ${desc}`;
  return desc || code || String(person?.category ?? "").trim();
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 20000 && value < 120000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

/** Years from hire date to termination, or to `asOf` when the person is still employed. */
export function yearsOfService(person: Employee, asOf = new Date()): number | null {
  const hire = coerceDate(person?.hireDate);
  if (!hire) return null;
  const end = coerceDate(person?.terminationDate) ?? asOf;
  const years = (end.getTime() - hire.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!Number.isFinite(years) || years < 0 || years >= 80) return null;
  return Math.round(years * 10) / 10;
}

function modeText(people: Employee[], read: (person: Employee) => unknown): string {
  const counts = new Map<string, number>();
  for (const person of people) {
    const value = String(read(person) ?? "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  if (!counts.size) return "";
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")
  )[0][0];
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => Number.isFinite(value));
  if (!nums.length) return null;
  return SalaryMath.mean(nums);
}

function salaryOf(person: Employee): number | null {
  const value = Number(person?.baseSalaryFte);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function variableOf(person: Employee): number {
  const value = Number(person?.variableComponentsFte);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export type RolePerson = {
  index: number;
  employeeId: string | null;
  name: string;
  gender: string;
  ralFte: number | null;
  ralNominal: number;
  variableFte: number;
  deviationPct: number | null;
  grade: string;
  level: string;
  seniorityYears: number | null;
  performanceOnFive: number | null;
};

export type RoleRow = {
  code: string;
  description: string;
  titles: string[];
  n: number;
  nM: number;
  nF: number;
  insufficientSample: boolean;
  median: number | null;
  min: number | null;
  max: number | null;
  gapMean: number | null;
  gapMedian: number | null;
  overThreshold: boolean;
  thresholdPct: number;
  avgFixedM: number | null;
  avgFixedF: number | null;
  avgVarM: number | null;
  avgVarF: number | null;
  avgHourly: number | null;
  people: RolePerson[];
};

export function buildRoleRows(
  people: Employee[],
  { thresholdPct = EU_GAP_THRESHOLD_PCT } = {}
): RoleRow[] {
  const groups = new Map<string, Employee[]>();
  for (const person of people || []) {
    const code = String(person?.role ?? "").trim()
      || String(person?.jobCode ?? "").trim()
      || "N/D";
    const list = groups.get(code);
    if (list) list.push(person);
    else groups.set(code, [person]);
  }

  return [...groups.entries()].map(([code, list]) => {
    const men = list.filter((person) => person.gender === "M");
    const women = list.filter((person) => person.gender === "F");
    const maleSalaries = men.map(salaryOf).filter((value): value is number => value != null);
    const femaleSalaries = women.map(salaryOf).filter((value): value is number => value != null);
    const salaries = [...maleSalaries, ...femaleSalaries];
    const mid = salaries.length ? SalaryMath.median(salaries) : null;
    const gapMean = maleSalaries.length && femaleSalaries.length
      ? SalaryMath.genderPayGapPct(SalaryMath.mean(maleSalaries), SalaryMath.mean(femaleSalaries))
      : null;
    const gapMedian = maleSalaries.length && femaleSalaries.length
      ? SalaryMath.genderPayGapPct(
        SalaryMath.median(maleSalaries),
        SalaryMath.median(femaleSalaries)
      )
      : null;
    const insufficientSample = !SalaryMath.gapSampleSufficient(men.length, women.length);
    const overThreshold =
      (gapMean != null && Math.abs(gapMean) > thresholdPct) ||
      (gapMedian != null && Math.abs(gapMedian) > thresholdPct);
    const description = modeText(list, (person) => person.role) || "Ruolo non indicato";
    const titles = [...new Set(list.map((person) => String(person.role ?? "").trim()).filter(Boolean))];

    const detailPeople: RolePerson[] = list
      .map((person) => {
        const ralFte = salaryOf(person);
        const deviationPct =
          ralFte != null && mid != null && mid > 0
            ? ((ralFte - mid) / mid) * 100
            : null;
        const score = Number(person.performanceOnFive);
        return {
          index: person.index,
          employeeId: person.employeeId ?? null,
          name: person.name || "",
          gender: person.gender,
          ralFte,
          ralNominal: person.baseSalaryRaw,
          variableFte: variableOf(person),
          deviationPct,
          grade: person.grade ?? "",
          level: person.level ?? "",
          seniorityYears: yearsOfService(person),
          performanceOnFive: Number.isFinite(score) && score > 0 ? score : null,
        };
      })
      .sort((a, b) => (b.ralFte ?? -1) - (a.ralFte ?? -1));

    return {
      code,
      description,
      titles,
      n: list.length,
      nM: men.length,
      nF: women.length,
      insufficientSample,
      median: salaries.length ? mid : null,
      min: salaries.length ? Math.min(...salaries) : null,
      max: salaries.length ? Math.max(...salaries) : null,
      gapMean,
      gapMedian,
      overThreshold,
      thresholdPct,
      avgFixedM: average(maleSalaries),
      avgFixedF: average(femaleSalaries),
      avgVarM: average(men.map(variableOf)),
      avgVarF: average(women.map(variableOf)),
      avgHourly: reportedHourlyMean(list),
      people: detailPeople,
    };
  });
}

export function roleGapMagnitude(row: RoleRow | null | undefined): number | null {
  const values = [row?.gapMean, row?.gapMedian].filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  if (!values.length) return null;
  return Math.max(...values.map((value) => Math.abs(value)));
}

export function sortRoleRows(rows: RoleRow[]): RoleRow[] {
  return rows.slice().sort((a, b) => {
    const magA = roleGapMagnitude(a);
    const magB = roleGapMagnitude(b);
    if (magA == null && magB == null) return a.code.localeCompare(b.code, "it");
    if (magA == null) return 1;
    if (magB == null) return -1;
    return magB - magA;
  });
}

/** Observed min / median / max text for a job posting. */
export function roleRangeText(
  row: RoleRow,
  context: { company?: string; qualification?: string; cdr?: string } = {}
): string {
  const euro = (value: number | null) =>
    value == null || !Number.isFinite(value)
      ? "–"
      : `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const lines = [
    "Fascia retributiva per annuncio",
    `Codice mansione: ${row?.code || "–"}`,
    `Descrizione: ${row?.description || "–"}`,
    `Società: ${context.company || "Tutte le società"}`,
  ];
  if (context.qualification) lines.push(`Qualifica: ${context.qualification}`);
  if (context.cdr) lines.push(`CdR: ${context.cdr}`);
  lines.push(
    `Organico nel perimetro: ${row?.n ?? 0} (F ${row?.nF ?? 0} · M ${row?.nM ?? 0})`,
    `RAL annua FTE minima: ${euro(row?.min)}`,
    `RAL annua FTE mediana: ${euro(row?.median)}`,
    `RAL annua FTE massima: ${euro(row?.max)}`,
    "La RAL è annua e normalizzata solo sulla percentuale di part-time.",
    "Minimo, mediana e massimo sono la fascia osservata sulle persone in questo perimetro.",
  );
  return lines.join("\n");
}
