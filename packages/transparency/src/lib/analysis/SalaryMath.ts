import {
  DEFAULT_ANNUAL_HOURS,
  EU_GAP_THRESHOLD_PCT,
  MIN_GENDER_SAMPLE,
  type GapSeverity,
  type GapStatus,
} from "../models/constants";

export class SalaryMath {
  static mean(values: number[]): number {
    const arr = values.filter((v) => Number.isFinite(v));
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  static median(values: number[]): number {
    const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  }

  static pctGap(male: number, female: number): number | null {
    if (!Number.isFinite(male) || !Number.isFinite(female)) return null;
    if (male === 0) return null;
    return ((male - female) / male) * 100;
  }

  static genderPayGapPct(avgMen: number, avgWomen: number): number | null {
    if (!Number.isFinite(avgMen) || !Number.isFinite(avgWomen)) return null;
    if (avgMen <= 0) return null;
    return ((avgMen - avgWomen) / avgMen) * 100;
  }

  /** Signed (M−F)/M. Positive when men earn more, negative when women earn more. */
  static formatSignedGap(gap: number | null | undefined, digits = 2): string {
    if (gap == null || !Number.isFinite(gap)) return "–";
    if (Math.abs(gap) < 1e-9) return "0%";
    const text = gap.toFixed(digits).replace(".", ",");
    return `${gap > 0 ? "+" : ""}${text}%`;
  }

  static parseSalaryAmount(value: unknown): number {
    if (value == null || value === "") return 0;
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0 ? value : 0;
    }
    const cleaned = String(value)
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  static parseNumber(value: unknown): number {
    if (value == null || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value)
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  static parsePartTimePct(value: unknown): number {
    if (value == null || value === "") return 100;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value <= 0) return 100;
      if (value <= 1) return Math.round(value * 100);
      return Math.min(100, value);
    }
    const s = String(value).trim().replace("%", "").replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return 100;
    if (n <= 1) return Math.round(n * 100);
    return Math.min(100, n);
  }

  static effectiveBaseSalary(
    rawBase: number,
    superminimo = 0,
    superminimoAssoluto = 0
  ): number {
    const raw = Number.isFinite(rawBase) ? rawBase : 0;
    const sm = SalaryMath.parseSalaryAmount(superminimo);
    const sma = SalaryMath.parseSalaryAmount(superminimoAssoluto);
    return Math.max(0, raw - sm - sma);
  }

  static gapSampleSufficient(
    nM: number,
    nF: number,
    min = MIN_GENDER_SAMPLE
  ): boolean {
    return nM >= min && nF >= min;
  }

  static classifyGapStatus(
    gapPct: number | null,
    { hasJustification = false }: { hasJustification?: boolean } = {}
  ): GapStatus {
    if (
      gapPct == null ||
      !Number.isFinite(gapPct) ||
      Math.abs(gapPct) <= EU_GAP_THRESHOLD_PCT
    ) {
      return "green";
    }
    if (hasJustification) return "yellow";
    return "red";
  }

  static gapSeverity(pct: number | null): GapSeverity {
    if (pct == null || !Number.isFinite(pct)) return "na";
    const a = Math.abs(pct);
    if (a < 4) return "green";
    if (a <= EU_GAP_THRESHOLD_PCT) return "yellow";
    return "red";
  }

  static gapSeverityClass(pct: number | null): string {
    return `gap-severity-${SalaryMath.gapSeverity(pct)}`;
  }

  static gapStatusCssClass(status: GapStatus): string {
    if (status === "red") return "gap-status-red";
    if (status === "yellow") return "gap-status-yellow";
    if (status === "insufficient") return "gap-status-insufficient";
    return "gap-status-green";
  }

  static toFte(amount: number, partTimePct: number): number {
    const pct = partTimePct > 0 ? partTimePct : 100;
    const fteFactor = pct / 100;
    return Number.isFinite(amount) && amount > 0 ? amount / fteFactor : 0;
  }

  static toHourly(
    fteAmount: number,
    annualHours = DEFAULT_ANNUAL_HOURS
  ): number {
    return fteAmount > 0 ? fteAmount / annualHours : 0;
  }

  /**
   * Full-time annual hours from the contractual weekly schedule.
   * 40 hours → 1720. A 38-hour week uses 38/40 of 1720.
   */
  static annualHoursFromWeekly(
    weekly: unknown,
    fallback = DEFAULT_ANNUAL_HOURS
  ): number {
    const hours = Number(weekly);
    if (!Number.isFinite(hours) || hours <= 0) return fallback;
    return (hours / 40) * fallback;
  }

  /** TEA score on a 1–5 scale. Values outside the scale (for example 0–100) stay null. */
  static parseScoreOnFive(value: unknown): number | null {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : SalaryMath.parseNumber(value);
    if (!Number.isFinite(n) || n <= 0 || n > 5) return null;
    return Math.round(n * 100) / 100;
  }
}
