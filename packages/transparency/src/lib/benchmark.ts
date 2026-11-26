import type { Doc } from "@spark/core";

/** Estimated market range of a role, annual gross EUR, full time. */
export interface BenchmarkStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export type BenchmarkConfidence = "alta" | "media" | "bassa";

export const AREAS = [
  { id: "italia", label: "Tutta Italia" },
  { id: "nord-ovest", label: "Nord-Ovest" },
  { id: "nord-est", label: "Nord-Est" },
  { id: "centro", label: "Centro" },
  { id: "sud-isole", label: "Sud e Isole" },
  { id: "regione", label: "Una regione" },
] as const;
export type Area = (typeof AREAS)[number]["id"];

export const REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

export const SIZES = [
  { id: "", label: "Qualsiasi dimensione" },
  { id: "micro", label: "Micro (meno di 10 dipendenti)" },
  { id: "piccola", label: "Piccola (10–49)" },
  { id: "media", label: "Media (50–249)" },
  { id: "grande", label: "Grande (250 e oltre)" },
] as const;
export type Size = (typeof SIZES)[number]["id"];

export const SENIORITIES = [
  { id: "auto", label: "Dal livello CCNL" },
  { id: "junior", label: "Junior (0–3 anni)" },
  { id: "intermedio", label: "Intermedio (3–8 anni)" },
  { id: "senior", label: "Senior (oltre 8 anni)" },
] as const;
export type Seniority = (typeof SENIORITIES)[number]["id"];

/** How fine-grained the estimate is: where, which kind of company, which seniority. */
export interface BenchmarkScope {
  area: Area;
  region?: string;
  city?: string;
  size: Size;
  sector?: string;
  seniority: Seniority;
}

export const DEFAULT_SCOPE: BenchmarkScope = { area: "italia", size: "", seniority: "auto" };

const label = <T extends { id: string; label: string }>(list: readonly T[], id: string) => list.find((x) => x.id === id)?.label ?? id;

/** Valid scope from untrusted input (request body, old records). */
export function cleanScope(v: unknown): BenchmarkScope {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const area = AREAS.some((a) => a.id === o.area) ? (o.area as Area) : "italia";
  const region = area === "regione" && REGIONS.includes(str(o.region, 40)) ? str(o.region, 40) : undefined;
  return {
    area: area === "regione" && !region ? "italia" : area,
    ...(region && { region }),
    ...(region && str(o.city, 40) && { city: str(o.city, 40) }),
    size: SIZES.some((s) => s.id === o.size) ? (o.size as Size) : "",
    ...(str(o.sector, 60) && { sector: str(o.sector, 60) }),
    seniority: SENIORITIES.some((s) => s.id === o.seniority) ? (o.seniority as Seniority) : "auto",
  };
}

/** Where: "Tutta Italia", "Nord-Est", "Lombardia · Milano". */
export const geoLabel = (s: BenchmarkScope) => (s.area === "regione" ? [s.region, s.city].filter(Boolean).join(" · ") : label(AREAS, s.area));

/** Short description of a scope (Italian; translated where rendered piece by piece). */
export function scopeParts(s: BenchmarkScope): string[] {
  return [geoLabel(s), s.size ? label(SIZES, s.size) : "", s.sector ?? "", s.seniority !== "auto" ? label(SENIORITIES, s.seniority) : ""].filter(Boolean);
}

export const sameScope = (a: BenchmarkScope, b: BenchmarkScope) => JSON.stringify(cleanScope(a)) === JSON.stringify(cleanScope(b));

/** Saved market benchmark of one role (collection `benchmarks`, one record per role title). */
export interface BenchmarkDoc extends Doc {
  role: string;
  scope: BenchmarkScope;
  stats: BenchmarkStats | null;
  confidence?: BenchmarkConfidence;
  rationale?: string;
  /** Model that made the estimate. */
  source: string;
  fetchedAt: string;
  fetchedBy?: string;
}

/** What the model sees about a role: no names, no company pay. */
export interface BenchmarkInput {
  role: string;
  level?: string;
  ccnl?: string;
  qualification?: string;
}

/** Five figures in increasing order, rounded to 100 €, within a plausible range; null if unusable. */
export function cleanStats(v: Partial<Record<keyof BenchmarkStats, unknown>>): BenchmarkStats | null {
  const nums = [v.min, v.q1, v.median, v.q3, v.max].map((x) => Number(x));
  if (nums.some((n) => !Number.isFinite(n) || n < 8_000 || n > 1_000_000)) return null;
  const [min, q1, median, q3, max] = nums.sort((a, b) => a - b).map((n) => Math.round(n / 100) * 100) as [number, number, number, number, number];
  return { min, q1, median, q3, max };
}
