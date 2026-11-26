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

/** Saved market benchmark of one role (collection `benchmarks`, one record per role title). */
export interface BenchmarkDoc extends Doc {
  role: string;
  /** Title the role has on the market (internal titles are often unclear). */
  query: string;
  sector?: string;
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
  query: string;
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
