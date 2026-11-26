import { CompensationAnalysis } from "./CompensationAnalysis";
import {
  deltaOf,
  snapshotFromAnalysis,
  type HistoryBandCell,
  type HistoryLevelCell,
  type HistorySnapshot,
} from "./HistoryInsights";
import { LevelTaxonomy } from "./LevelTaxonomy";
import { Employee } from "../models/Employee";
import { SalaryMath } from "./SalaryMath";
import { SALARY_METRICS } from "../models/constants";

export type HireForm = {
  name?: string;
  gender?: string;
  level?: string;
  role?: string;
  baseSalary?: unknown;
  variableComponents?: unknown;
  partTimePct?: unknown;
};

function changedNumber(after: number | null | undefined, before: number | null | undefined) {
  const delta = deltaOf(after, before);
  if (delta == null) return after !== before;
  return Math.abs(delta) > 0.5;
}

export function simulateHire(analysis: CompensationAnalysis, form: HireForm) {
  const base = SalaryMath.parseSalaryAmount(form?.baseSalary);
  if (!(base > 0)) {
    throw new Error("Inserisci una retribuzione base annua valida.");
  }
  const gender = form?.gender === "M" ? "M" : form?.gender === "F" ? "F" : null;
  if (!gender) throw new Error("Seleziona il genere.");
  const variable = SalaryMath.parseNumber(form?.variableComponents || 0);
  const partTimeRaw = Number(form?.partTimePct);
  const partTimePct =
    Number.isFinite(partTimeRaw) && partTimeRaw > 0 ? Math.min(100, partTimeRaw) : 100;
  const maxIndex = (analysis.employees || []).reduce(
    (max, person) => Math.max(max, Number(person.index) || 0),
    0
  );
  const role = String(form?.role || "").trim() || "Nuovo ruolo";
  const level = String(form?.level || "").trim() || "N/D";
  const newbie = Employee.fromTeaRecord({
    index: maxIndex + 1,
    gender,
    name: String(form?.name || "").trim() || "Nuova assunzione",
    role,
    level,
    jobCode: role,
    baseSalary: base,
    bonusMbo: variable > 0 ? variable : 0,
    partTimePct,
  });

  const before = snapshotFromAnalysis(analysis);
  const afterAnalysis = new CompensationAnalysis([...analysis.employees, newbie]);
  const after = snapshotFromAnalysis(afterAnalysis);
  const beforeByScore = new Map(before.bands.map((band) => [band.score, band]));
  const placed =
    after.bands.find((band) => band.n > (beforeByScore.get(band.score)?.n ?? 0)) || null;
  const beforeBand = placed ? beforeByScore.get(placed.score) || null : null;
  const total = newbie.comparisonValue(SALARY_METRICS.totale, { fte: true });
  const deviationPct =
    placed?.avgTotal && total != null ? ((total - placed.avgTotal) / placed.avgTotal) * 100 : null;

  const hireLevel = LevelTaxonomy.displayLabel(level);
  const levelKeys = new Set([
    ...before.levels.map((row) => row.level),
    ...after.levels.map((row) => row.level),
  ]);
  const levelGroups = [...levelKeys].map((levelKey) => {
    const beforeLevel = before.levels.find((row) => row.level === levelKey) || null;
    const afterLevel = after.levels.find((row) => row.level === levelKey) || null;
    return {
      level: levelKey,
      before: beforeLevel,
      after: afterLevel,
      isHireLevel: levelKey === hireLevel,
      affected:
        levelKey === hireLevel ||
        (beforeLevel?.n ?? 0) !== (afterLevel?.n ?? 0) ||
        changedNumber(afterLevel?.avgTotal, beforeLevel?.avgTotal),
    };
  });

  const scores = new Set([
    ...before.bands.map((band) => band.score),
    ...after.bands.map((band) => band.score),
  ]);
  const fasciaRows = [...scores]
    .sort((a, b) => b - a)
    .map((score) => {
      const beforeRow = before.bands.find((band) => band.score === score) || null;
      const afterRow = after.bands.find((band) => band.score === score) || null;
      const sample = afterRow || beforeRow;
      return {
        key: String(score),
        score,
        fasciaLabel: sample?.fasciaLabel || `Punteggio ${score}/100`,
        before: beforeRow,
        after: afterRow,
        changed:
          !beforeRow ||
          !afterRow ||
          beforeRow.n !== afterRow.n ||
          changedNumber(beforeRow.avgTotal, afterRow.avgTotal) ||
          changedNumber(beforeRow.gapPct, afterRow.gapPct),
      };
    });

  return {
    employee: {
      name: newbie.name,
      gender: newbie.gender,
      role,
      level,
      totalSalary: total,
      baseSalary: newbie.comparisonValue(SALARY_METRICS.base, { fte: true }),
      variableComponents: newbie.comparisonValue(SALARY_METRICS.variabile, { fte: true }),
      deviationPct,
    },
    placement: placed
      ? {
          fasciaLabel: placed.fasciaId,
          score: placed.score,
          nBefore: beforeBand?.n ?? 0,
          nAfter: placed.n,
          avgTotalBefore: beforeBand?.avgTotal ?? null,
          avgTotalAfter: placed.avgTotal,
          avgBaseBefore: beforeBand?.avgBase ?? null,
          avgBaseAfter: placed.avgBase,
          avgVarBefore: beforeBand?.avgVar ?? null,
          avgVarAfter: placed.avgVar,
          avgMenBefore: beforeBand?.avgMen ?? null,
          avgMenAfter: placed.avgMen,
          avgWomenBefore: beforeBand?.avgWomen ?? null,
          avgWomenAfter: placed.avgWomen,
          nMenBefore: beforeBand?.nMen ?? 0,
          nMenAfter: placed.nMen,
          nWomenBefore: beforeBand?.nWomen ?? 0,
          nWomenAfter: placed.nWomen,
          gapBefore: beforeBand?.gapPct ?? null,
          gapAfter: placed.gapPct,
          newFascia: !beforeBand,
        }
      : null,
    beforeKpi: before,
    afterKpi: after,
    levelGroups,
    fasciaRows,
  };
}

export type HireSimulationResult = ReturnType<typeof simulateHire>;
export type { HistorySnapshot, HistoryBandCell, HistoryLevelCell };
