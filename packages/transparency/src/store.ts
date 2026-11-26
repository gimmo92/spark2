"use client";

import { useCallback } from "react";
import { useCollection, type Doc } from "@spark/core";
import type { AnalysisSnapshot, SavedJustification } from "./lib/analysis/CompensationAnalysis";
import { PAY_ANALYSES } from "./module";

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

export type { SavedJustification };
