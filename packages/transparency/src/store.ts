"use client";

import { useCallback } from "react";
import { useCollection, type Doc } from "@spark/core";
import type { AnalysisSnapshot, SavedJustification } from "./lib/analysis/CompensationAnalysis";
import { BENCHMARKS, PAY_ANALYSES, ROLE_WEIGHTS } from "./module";
import type { AnalysisSectorDoc, BenchmarkDoc } from "./lib/benchmark";
import type { RoleWeightDoc } from "./lib/roleWeights";

/** A saved analysis: the normalised employees of one payroll file, with the justified deviations. */
export interface PayAnalysisDoc extends Doc {
  name: string;
  fileName: string;
  createdAt: string;
  createdBy?: string;
  employeeCount: number;
  snapshot: AnalysisSnapshot;
}

/** Saved analyses, newest first, with save / remove helpers. */
export function usePayAnalyses() {
  const [items, update] = useCollection<PayAnalysisDoc>(PAY_ANALYSES);
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const save = useCallback(
    (doc: Omit<PayAnalysisDoc, "id" | "createdAt"> & { id?: string }) => {
      const id = doc.id ?? `pa${Date.now()}`;
      update((prev) => {
        const old = prev.find((d) => d.id === id);
        const next: PayAnalysisDoc = { ...doc, id, createdAt: old?.createdAt ?? new Date().toISOString() };
        return old ? prev.map((d) => (d.id === id ? next : d)) : [next, ...prev];
      });
      return id;
    },
    [update],
  );
  const remove = useCallback((id: string) => update((prev) => prev.filter((d) => d.id !== id)), [update]);

  return { analyses: sorted, save, remove };
}

/** Saved role weightings (job evaluation), keyed by role title, with an upsert helper. */
export function useRoleWeights() {
  const [items, update] = useCollection<RoleWeightDoc>(ROLE_WEIGHTS);
  const byRole = new Map(items.map((d) => [d.role, d]));
  const upsert = useCallback(
    (docs: RoleWeightDoc[]) =>
      update((prev) => {
        const next = new Map(prev.map((d) => [d.id, d]));
        for (const d of docs) next.set(d.id, d);
        return [...next.values()];
      }),
    [update],
  );
  return { weights: byRole, upsert };
}

/**
 * Saved market benchmarks of the company (cache shared by every analysis, `get(key)`), plus the sector
 * recognised for each analysis.
 */
export function useBenchmarks() {
  const [items, update] = useCollection<BenchmarkDoc | AnalysisSectorDoc>(BENCHMARKS);
  const byId = new Map(items.map((d) => [d.id, d]));
  const get = (key: string) => {
    const d = byId.get(key);
    return d && d.kind !== "sector" ? (d as BenchmarkDoc) : undefined;
  };
  const sectorOf = (analysisId: string) => (byId.get(`sector:${analysisId}`) as AnalysisSectorDoc | undefined)?.sector;
  /** Adds docs; an existing benchmark is never replaced, so figures stay stable. */
  const add = useCallback(
    (docs: (BenchmarkDoc | AnalysisSectorDoc)[]) =>
      update((prev) => {
        const have = new Set(prev.map((d) => d.id));
        const fresh = docs.filter((d) => d.kind === "sector" || !have.has(d.id));
        const ids = new Set(fresh.map((d) => d.id));
        return [...fresh, ...prev.filter((d) => !ids.has(d.id))];
      }),
    [update],
  );
  // the cache stays (company knowledge); only the analysis' recognised sector goes
  const removeFor = useCallback((analysisId: string) => update((prev) => prev.filter((d) => d.id !== `sector:${analysisId}`)), [update]);
  return { get, sectorOf, add, removeFor };
}

export type { SavedJustification };
