export const SALARY_METRICS = {
  base: "base",
  livello: "livello",
  totale: "totale",
  variabile: "variabile",
  oraria: "oraria",
  mbo: "mbo",
  mboBase: "mboBase",
} as const;

export type SalaryMetric = (typeof SALARY_METRICS)[keyof typeof SALARY_METRICS];

export const DEFAULT_ANNUAL_HOURS = 1720;
export const MIN_GENDER_SAMPLE = 5;
/** Default minimum of people per gender (besides the requester) for an individual pay letter. */
export const PAY_LETTER_MIN_PER_GENDER = 3;
export const REDUCED_SAMPLE_LABEL = "n/d – campione ridotto";
export const EU_GAP_THRESHOLD_PCT = 5;
export const MAX_QUARTILE_OUTLIERS = 50;

export type Gender = "M" | "F";

export type GapSeverity = "green" | "yellow" | "red" | "na";
export type GapStatus = "green" | "yellow" | "red" | "insufficient";
