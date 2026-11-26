import type { Doc } from "@spark/core";

/** A job ad with a declared salary, found on the web for a role (annual gross EUR). */
export interface BenchmarkAd {
  title: string;
  link: string;
  source: string;
  salaryText: string;
  min: number | null;
  max: number | null;
  value: number | null;
  note?: string;
}

export interface BenchmarkStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** Saved market benchmark of one role (collection `benchmarks`, one record per role title). */
export interface BenchmarkDoc extends Doc {
  role: string;
  /** Title searched on the market (internal titles are often not searchable). */
  query: string;
  sector?: string;
  ads: BenchmarkAd[];
  stats: BenchmarkStats | null;
  /** Web results read, before keeping only the ads with a salary. */
  scanned: number;
  fetchedAt: string;
  fetchedBy?: string;
}

/** One annual figure per ad: the declared value, else the middle of the range. */
export const adPoint = (a: Pick<BenchmarkAd, "min" | "max" | "value">) =>
  a.value ?? (a.min != null && a.max != null ? (a.min + a.max) / 2 : (a.min ?? a.max));

const percentile = (sorted: number[], p: number) => {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
};

export function benchmarkStats(ads: BenchmarkAd[]): BenchmarkStats | null {
  const values = ads
    .map(adPoint)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!values.length) return null;
  return { n: values.length, min: values[0]!, q1: percentile(values, 0.25), median: percentile(values, 0.5), q3: percentile(values, 0.75), max: values[values.length - 1]! };
}
