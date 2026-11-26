import { localeTag } from "@spark/core";
import { SalaryMath } from "../lib/analysis/SalaryMath";

/** Euro amount, no decimals ("–" when missing). */
export const eur = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "–" : `${Math.round(n).toLocaleString(localeTag())} €`;

export const num = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "–" : n.toLocaleString(localeTag(), { maximumFractionDigits: digits });

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "n/d" : `${n.toLocaleString(localeTag(), { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;

/** Signed gap (M − F) / M: positive when men earn more. */
export const gap = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "n/d";
  if (Math.abs(n) < 1e-9) return "0%";
  return `${n > 0 ? "+" : ""}${n.toLocaleString(localeTag(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
};

/** Text colour of a gap: green < 4 %, amber 4–5 %, red > 5 % (EU directive threshold). */
export const gapTone = (n: number | null | undefined) => {
  const s = SalaryMath.gapSeverity(n ?? null);
  return s === "red" ? "text-red-600" : s === "yellow" ? "text-amber-600" : s === "green" ? "text-emerald-600" : "text-muted";
};
