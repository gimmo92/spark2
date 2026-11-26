import type { ColumnMapping } from "../columnRoles";
import { Employee, type EmployeeJson } from "../models/Employee";
import {
  EU_GAP_THRESHOLD_PCT,
  SALARY_METRICS,
  type SalaryMetric,
} from "../models/constants";
import { EmployeeNormalizer } from "./EmployeeNormalizer";
import { EuGenderDashboardCalculator, type EuDashboardResult } from "./EuGenderDashboardCalculator";
import { GapGroupAnalyzer, type CcnlGroup, type ComparisonRow } from "./GapGroupAnalyzer";
import { JobGradingAnalyzer, type FasciaLevelGroup } from "./JobGradingAnalyzer";
import { SalaryMath } from "./SalaryMath";
import { LevelTaxonomy } from "./LevelTaxonomy";
import { personPay, type RgaSelection } from "./RgaComponents";
import { groupByTeaBand, type TeaBandRow } from "./TeaBandAnalyzer";
import {
  buildRoleRows,
  cdrLabel,
  sortRoleRows,
  type RoleRow,
} from "./RoleAnalyzer";

export const ANALYSIS_SNAPSHOT_KIND_V1 = "compensation-analysis-v1";
export const ANALYSIS_SNAPSHOT_KIND = "compensation-analysis-v2";

export type SavedJustification = {
  employeeId: string;
  name: string | null;
  note: string;
};

export type FilterDimension = "ccnl" | "level" | "qualification";

export type PopulationFilter = {
  dimension: FilterDimension;
  enabled: boolean;
  mode: "include" | "exclude";
  values: string[];
};

export type AnalysisSnapshot = {
  kind: typeof ANALYSIS_SNAPSHOT_KIND | typeof ANALYSIS_SNAPSHOT_KIND_V1;
  employees: EmployeeJson[];
  employeeCount: number;
  justifications?: SavedJustification[];
  savedName?: string;
  populationFilters?: PopulationFilter[];
};

export function canonicalEmployeeId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeJustifications(value: unknown): SavedJustification[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedJustification>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<SavedJustification>;
    const employeeId = canonicalEmployeeId(record.employeeId);
    const note = String(record.note || "").trim();
    if (!employeeId || !note) continue;
    const name = String(record.name || "").trim() || null;
    byId.set(employeeId, { employeeId, name, note });
  }
  return [...byId.values()];
}

export function justificationsFromDocuments(
  documents: Array<{ dummy_results_json?: unknown }> | null | undefined
): SavedJustification[] {
  const ordered = [...(documents || [])].reverse();
  return normalizeJustifications(
    ordered.flatMap((document) => {
      let json = document?.dummy_results_json;
      if (typeof json === "string") {
        try {
          json = JSON.parse(json);
        } catch {
          return [];
        }
      }
      if (!json || typeof json !== "object") return [];
      return (json as AnalysisSnapshot).justifications || [];
    })
  );
}

export class AnalysisFormatters {
  static gapMforF(gap: number | null, hasJustification = false): string {
    const body = SalaryMath.formatSignedGap(gap);
    if (body === "–") return body;
    const rettificato =
      hasJustification &&
      Number.isFinite(gap) &&
      Math.abs(gap as number) <= EU_GAP_THRESHOLD_PCT;
    return rettificato ? `Gap rett.: ${body}` : body;
  }

  static number(n: number | null | undefined): string {
    if (n == null) return "–";
    return Number(n).toLocaleString("it-IT", { maximumFractionDigits: 2 });
  }

  static percent(n: number | null | undefined, digits = 1): string {
    if (n == null || !Number.isFinite(n)) return "n/d";
    return `${n.toFixed(digits)}%`;
  }

  static quartileBarHeightPx(pct: number, trackPx = 100): string {
    const p = Number(pct);
    if (!Number.isFinite(p) || p <= 0) return "2px";
    return `${Math.max(2, Math.round((p / 100) * trackPx))}px`;
  }

  static severityClass(pct: number | null): string {
    return SalaryMath.gapSeverityClass(pct);
  }

  static levelBarWidth(gap: number | null): string {
    if (gap == null || !Number.isFinite(gap)) return "0%";
    return `${Math.min(100, Math.abs(gap) * 1.5)}%`;
  }
}

const FILTER_DIMENSIONS: FilterDimension[] = ["ccnl", "level", "qualification"];

export function filterDimensionValue(person: Employee, dimension: FilterDimension): string {
  if (dimension === "ccnl") return String(person.ccnl || "").trim();
  if (dimension === "qualification") return String(person.qualification || "").trim();
  return LevelTaxonomy.normalize(person.level) || String(person.level || "").trim();
}

export function normalizePopulationFilters(value: unknown): PopulationFilter[] {
  const incoming = Array.isArray(value) ? value : [];
  return FILTER_DIMENSIONS.map((dimension) => {
    const found = incoming.find(
      (item) => item && typeof item === "object" && (item as PopulationFilter).dimension === dimension
    ) as Partial<PopulationFilter> | undefined;
    const values = Array.isArray(found?.values)
      ? found.values.map((item) => String(item).trim()).filter(Boolean)
      : [];
    return {
      dimension,
      enabled: Boolean(found?.enabled),
      mode: found?.mode === "exclude" ? "exclude" : "include",
      values,
    };
  });
}

/** Enabled filters combine with AND. Values inside one filter combine with OR. */
export function applyPopulationFilters(
  people: Employee[],
  filters: PopulationFilter[] | null | undefined
): Employee[] {
  const active = (filters || []).filter((filter) => filter.enabled && filter.values.length);
  if (!active.length) return people || [];
  return (people || []).filter((person) =>
    active.every((filter) => {
      const selected = filter.values.includes(filterDimensionValue(person, filter.dimension));
      return filter.mode === "exclude" ? !selected : selected;
    })
  );
}

export class CompensationAnalysis {
  readonly employees: Employee[];
  justifications: SavedJustification[] = [];
  populationFilters: PopulationFilter[] = normalizePopulationFilters(null);

  constructor(employees: Employee[]) {
    this.employees = employees || [];
  }

  static exclusionMap(
    employees: Employee[],
    justifications: SavedJustification[] | null | undefined
  ): Record<number, string> {
    const map: Record<number, string> = {};
    for (const item of normalizeJustifications(justifications)) {
      const person = (employees || []).find(
        (employee) => canonicalEmployeeId(employee.employeeId) === item.employeeId
      );
      if (person) map[person.index] = item.note;
    }
    return map;
  }

  static fromWorkbook(
    rows: unknown[][],
    headers: unknown[],
    mapping: ColumnMapping
  ): CompensationAnalysis {
    return new CompensationAnalysis(
      EmployeeNormalizer.fromWorkbook(rows, headers, mapping)
    );
  }

  static fromSnapshot(snapshot: AnalysisSnapshot | null | undefined): CompensationAnalysis | null {
    if (
      !snapshot ||
      (snapshot.kind !== ANALYSIS_SNAPSHOT_KIND &&
        snapshot.kind !== ANALYSIS_SNAPSHOT_KIND_V1)
    ) {
      return null;
    }
    const employees = (snapshot.employees || []).map((e) => Employee.fromJson(e));
    const analysis = new CompensationAnalysis(employees);
    analysis.justifications = normalizeJustifications(snapshot.justifications);
    analysis.populationFilters = normalizePopulationFilters(snapshot.populationFilters);
    return analysis;
  }

  get employeeCount(): number {
    return this.employees.length;
  }

  hasCostCenterData(): boolean {
    return this.employees.some((r) => String(r.category ?? "").trim());
  }

  salaryOf(
    metric: SalaryMetric,
    fte = true,
    hourly = false,
    rga: RgaSelection | null = null
  ) {
    return (p: Employee) => {
      if (hourly) return p.comparisonValue(metric, { fte, hourly });
      return personPay(p, metric, rga);
    };
  }

  dashboard(
    metric: SalaryMetric = SALARY_METRICS.base,
    fte = true,
    rga: RgaSelection | null = null
  ): EuDashboardResult {
    return EuGenderDashboardCalculator.compute(this.employees, metric, {
      fte,
      payOf: this.salaryOf(metric, fte, false, rga),
    });
  }

  ccnlGroups(
    metric: SalaryMetric = SALARY_METRICS.base,
    fte = true,
    rga: RgaSelection | null = null
  ): CcnlGroup[] {
    return GapGroupAnalyzer.byCcnlThenLevel(
      this.employees,
      this.salaryOf(metric, fte, false, rga)
    );
  }

  qualificationGroups(
    metric: SalaryMetric = SALARY_METRICS.base,
    fte = true,
    rga: RgaSelection | null = null
  ): ComparisonRow[] {
    const order = ["operaio", "impiegato", "quadro", "dirigente"];
    return GapGroupAnalyzer.grouped(
      this.employees,
      (person) => String(person.qualification || "").trim() || "N/D",
      this.salaryOf(metric, fte, false, rga)
    ).sort((a, b) => {
      const rank = (label: string) => {
        const index = order.indexOf(label.toLowerCase());
        return index < 0 ? order.length : index;
      };
      return rank(a.groupLabel) - rank(b.groupLabel)
        || a.groupLabel.localeCompare(b.groupLabel, "it");
    });
  }

  costCenters(
    metric: SalaryMetric = SALARY_METRICS.base,
    fte = true,
    rga: RgaSelection | null = null
  ): ComparisonRow[] {
    return GapGroupAnalyzer.byCostCenter(this.employees, this.salaryOf(metric, fte, false, rga));
  }

  costCenterHotspots(
    metric: SalaryMetric = SALARY_METRICS.base,
    fte = true,
    rga: RgaSelection | null = null
  ) {
    const rows = this.costCenters(metric, fte, rga);
    const total = rows.reduce((s, r) => s + (r.nTotal || 0), 0);
    return rows
      .filter(
        (r) =>
          !r.insufficientSample &&
          r.gapMean != null &&
          Number.isFinite(r.gapMean) &&
          Math.abs(r.gapMean) > EU_GAP_THRESHOLD_PCT
      )
      .sort((a, b) => Math.abs(b.gapMean ?? 0) - Math.abs(a.gapMean ?? 0))
      .map((row, i) => ({
        rank: i + 1,
        row,
        weightPct: total > 0 ? (row.nTotal / total) * 100 : 0,
      }));
  }

  fasciaByRole(metric: SalaryMetric = SALARY_METRICS.base, fte = true): ComparisonRow[] {
    return GapGroupAnalyzer.byRole(this.employees, this.salaryOf(metric, fte));
  }

  fasciaByLevel(): FasciaLevelGroup[] {
    return JobGradingAnalyzer.byLevel(this.employees);
  }

  /**
   * One grading cluster per rounded role score, across CCNL levels.
   * Fascia 1 is the highest score.
   */
  gradingClusters(metric: SalaryMetric = SALARY_METRICS.totale, rga: RgaSelection | null = null) {
    const buckets = new Map<
      number,
      { score: number; people: Employee[]; levels: string[] }
    >();
    for (const level of this.fasciaByLevel()) {
      for (const band of level.bands) {
        for (const role of band.roles) {
          const score = Math.min(
            100,
            Math.max(0, Math.round(role.punteggio / 5) * 5)
          );
          const bucket = buckets.get(score) ?? { score, people: [], levels: [] };
          bucket.people.push(...role.people);
          if (!bucket.levels.includes(level.levelLabel)) {
            bucket.levels.push(level.levelLabel);
          }
          buckets.set(score, bucket);
        }
      }
    }
    return Array.from(buckets.values())
      .sort((a, b) => b.score - a.score)
      .map((bucket, index) => {
        const getPay = this.salaryOf(metric, true, false, rga);
        const stats = GapGroupAnalyzer.analyze(bucket.people, getPay);
        const meanOf = (salaryMetric: SalaryMetric) => {
          const pays = bucket.people
            .map((person) => personPay(
              person,
              salaryMetric,
              salaryMetric === metric ? rga : null
            ))
            .filter((value): value is number => value != null);
          return pays.length ? SalaryMath.mean(pays) : null;
        };
        return {
          fasciaId: `Fascia ${index + 1}`,
          fasciaLabel: `Punteggio ${bucket.score}/100`,
          score: bucket.score,
          levelLabel: bucket.levels.join(", ") || "–",
          gap: stats.gapMean,
          status: stats.status,
          insufficientSample: stats.insufficientSample,
          nM: stats.nM,
          nF: stats.nF,
          nTotal: stats.nTotal,
          avgTotal: meanOf(metric),
          avgBase: meanOf(SALARY_METRICS.base),
          avgVar: meanOf(SALARY_METRICS.variabile),
          avgMen: stats.avgM,
          avgWomen: stats.avgF,
        };
      });
  }

  /** Grading clusters over the 5% threshold, largest gap first. */
  criticalAlerts(metric: SalaryMetric = SALARY_METRICS.totale, limit = 3) {
    return this.gradingClusters(metric)
      .filter((row) => row.status === "red" && row.gap != null)
      .sort((a, b) => Math.abs(b.gap as number) - Math.abs(a.gap as number))
      .slice(0, limit);
  }

  teaBands(): TeaBandRow[] {
    return groupByTeaBand(this.employees);
  }

  roleRows(): RoleRow[] {
    return sortRoleRows(buildRoleRows(this.employees));
  }

  hasJobCodeData(): boolean {
    return this.employees.some((person) => String(person.jobCode ?? "").trim());
  }

  hasTeaBandData(): boolean {
    return this.employees.some((person) => String(person.payBand ?? "").trim());
  }

  companyOptions(): string[] {
    return uniqueSorted(this.employees.map((person) => person.company));
  }

  qualificationOptions(): string[] {
    return uniqueSorted(this.employees.map((person) => person.qualification));
  }

  cdrOptions(): string[] {
    return uniqueSorted(this.employees.map((person) => cdrLabel(person)));
  }

  toSnapshot(): AnalysisSnapshot {
    return {
      kind: ANALYSIS_SNAPSHOT_KIND,
      employees: this.employees.map((e) => e.toJSON()),
      employeeCount: this.employeeCount,
      justifications: normalizeJustifications(this.justifications),
      populationFilters: normalizePopulationFilters(this.populationFilters),
    };
  }
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "it"));
}
