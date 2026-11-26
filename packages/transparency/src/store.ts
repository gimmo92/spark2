"use client";

import { useCallback } from "react";
import { useCollection, type Doc } from "@spark/core";
import type { AnalysisSnapshot, SavedJustification } from "./lib/analysis/CompensationAnalysis";
import { BENCHMARKS, PAY_ANALYSES, ROLE_WEIGHTS } from "./module";
import type { BenchmarkDoc } from "./lib/benchmark";
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

/** Saved market benchmarks, keyed by role title. */
export function useBenchmarks() {
  const [items, update] = useCollection<BenchmarkDoc>(BENCHMARKS);
  const byRole = new Map(items.map((d) => [d.role, d]));
  const upsert = useCallback((doc: BenchmarkDoc) => update((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]), [update]);
  return { benchmarks: byRole, upsert };
}

export type { SavedJustification };
