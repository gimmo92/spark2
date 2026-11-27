"use client";

import { useCallback } from "react";
import { useCollection, useSettings, type Doc } from "@spark/core";
import type { AnalysisSnapshot, SavedJustification } from "./lib/analysis/CompensationAnalysis";
import { BENCHMARKS, PAY_ANALYSES, ROLE_PROFILES, ROLE_WEIGHTS } from "./module";
import { familyId, type AnalysisSectorDoc, type BenchmarkDoc, type RoleFamilyDoc } from "./lib/benchmark";
import { DEFAULT_WEIGHTS, cleanWeights, type CriteriaWeights, type RoleProfileDoc, type RoleWeightDoc } from "./lib/roleWeights";

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
  const [items, update] = useCollection<BenchmarkDoc | AnalysisSectorDoc | RoleFamilyDoc>(BENCHMARKS);
  const byId = new Map(items.map((d) => [d.id, d]));
  const get = (key: string) => {
    const d = byId.get(key);
    return d && (d.kind === "role" || d.kind === undefined) ? (d as BenchmarkDoc) : undefined;
  };
  const familyOf = (role: string) => {
    const d = byId.get(familyId(role));
    return d?.kind === "family" ? (d as RoleFamilyDoc) : undefined;
  };
  const setFamily = useCallback((doc: RoleFamilyDoc) => update((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]), [update]);
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
  return { get, sectorOf, add, removeFor, familyOf, setFamily };
}

/** Weights of the job-grading criteria chosen by the company (settings doc "jobGrading", sum 100). */
export function useCriteriaWeights() {
  const [stored, patch] = useSettings<{ weights: CriteriaWeights }>("jobGrading", { weights: DEFAULT_WEIGHTS });
  const weights = cleanWeights(stored.weights);
  const setWeights = useCallback((w: CriteriaWeights) => patch({ weights: w }), [patch]);
  return { weights, setWeights };
}

/** Role profiles (job description, required skills), keyed by role title. */
export function useRoleProfiles() {
  const [items, update] = useCollection<RoleProfileDoc>(ROLE_PROFILES);
  const byRole = new Map(items.map((d) => [d.role, d]));
  const upsert = useCallback(
    (docs: RoleProfileDoc[]) =>
      update((prev) => {
        const ids = new Set(docs.map((d) => d.id));
        return [...docs, ...prev.filter((d) => !ids.has(d.id))];
      }),
    [update],
  );
  return { profiles: byRole, upsert };
}

export type { SavedJustification };
