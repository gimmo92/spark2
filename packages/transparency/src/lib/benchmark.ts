import type { Doc } from "@spark/core";

/** Estimated market range of a role, annual gross EUR, full time. */
export interface BenchmarkStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

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

/**
 * Saved market benchmark (collection `benchmarks`): one record per role + level + contract + scope +
 * sector, shared by every analysis of the company, so the same role always shows the same figures.
 */
export interface BenchmarkDoc extends Doc {
  kind?: "role";
  role: string;
  level?: string;
  ccnl?: string;
  scope: BenchmarkScope;
  /** Sector used: the scope's, or the one recognised from the analysis' roles. */
  sector?: string;
  stats: BenchmarkStats | null;
  /** Internal: what computed the figures (not shown). */
  source: string;
  fetchedAt: string;
  fetchedBy?: string;
}

/**
 * Titles counted as the same job as a role (collection `benchmarks`, id `family:<title>`): proposed
 * automatically once and stored, so the same role always gets the same set; a person can change it
 * and save it ("manuale").
 */
export interface RoleFamilyDoc extends Doc {
  kind: "family";
  role: string;
  /** Equivalent titles, without the role itself, sorted. */
  titles: string[];
  source: "auto" | "manuale";
  updatedAt: string;
  updatedBy?: string;
}

export const familyId = (role: string) => `family:${norm(role)}`;

/** Sector recognised from an analysis' roles (same collection, id `sector:<analysisId>`). */
export interface AnalysisSectorDoc extends Doc {
  kind: "sector";
  analysisId: string;
  sector: string;
}

const norm = (s?: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** FNV-1a 32-bit: stable short hash of a string. */
function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Cache key of a role's benchmark in a scope with an effective sector. */
export function benchmarkKey(r: { role: string; level?: string; ccnl?: string; aliases?: string[] }, scope: BenchmarkScope, sector?: string) {
  const s = cleanScope(scope);
  const aliases = [...new Set((r.aliases ?? []).map(norm).filter(Boolean))].sort().join(",");
  const parts = [r.role, r.level, r.ccnl, sector ?? s.sector, s.area, s.region, s.city, s.size, s.seniority, ...(aliases ? [`aka:${aliases}`] : [])].map(norm);
  return `bm-${fnv(parts.join("|")).toString(36)}-${norm(r.role).replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
}

/**
 * Roles without market coverage: about 8% of role titles, always the same ones (stable hash of the
 * title), shown as "not enough data" and never computed.
 */
export const uncovered = (role: string) => fnv(`cov|${norm(role)}`) % 100 < 8;

/** Where a pay sits in the market range. */
export type MarketBand = "sotto" | "q1" | "q3" | "sopra";
export const marketBand = (pay: number, s: BenchmarkStats): MarketBand => (pay < s.q1 ? "sotto" : pay < s.median ? "q1" : pay <= s.q3 ? "q3" : "sopra");

/** What the model sees about a role: no names, no company pay. */
export interface BenchmarkInput {
  role: string;
  /** Other titles of the same job (Ruoli inclusi nel confronto). */
  aliases?: string[];
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
