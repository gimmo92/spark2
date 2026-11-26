"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useData, useSettings } from "@spark/core";
import { DEFAULT_SCOPE, benchmarkId, cleanScope, type BenchmarkDoc, type BenchmarkScope, type BenchmarkStats } from "../lib/benchmark";
import type { Employee } from "../lib/models/Employee";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks } from "../store";

/** Analyses whose benchmarks are being computed (shared by every screen, survives page changes). */
const running = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => [...running].join("|");

/**
 * Computes the market benchmarks of an analysis' roles in the background (server route
 * /api/transparency/benchmark) and saves them; started when an analysis is saved and by the
 * Benchmarks page for roles still missing. One run per analysis at a time.
 */
export function useBenchmarkRunner() {
  const { upsertMany } = useBenchmarks();
  const email = useData().viewer?.email;
  const [stored] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const scope = cleanScope(stored);
  const busy = useSyncExternalStore(subscribe, snapshot, () => "");

  const run = useCallback(
    async (analysisId: string, people: Employee[], only?: string[]): Promise<"ok" | "error"> => {
      if (running.has(analysisId)) return "ok";
      const roles = rolesOf(people).filter((r) => !only || only.includes(r.role));
      if (!roles.length) return "ok";
      running.add(analysisId);
      emit();
      try {
        const r = await fetch("/api/transparency/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, roles: roles.map(({ role, level, ccnl, qualification }) => ({ role, level, ccnl, qualification })) }),
        });
        const body = (await r.json().catch(() => ({}))) as {
          roles?: { role: string; stats: BenchmarkStats | null }[];
          scope?: BenchmarkScope;
          sector?: string;
          source?: string;
        };
        if (!r.ok || !body.roles) return "error";
        const now = new Date().toISOString();
        upsertMany(
          body.roles.map(
            (x): BenchmarkDoc => ({
              id: benchmarkId(analysisId, x.role),
              analysisId,
              role: x.role,
              scope: cleanScope(body.scope ?? scope),
              ...(body.sector && { sector: body.sector }),
              stats: x.stats,
              source: body.source ?? "",
              fetchedAt: now,
              fetchedBy: email,
            }),
          ),
        );
        return "ok";
      } catch {
        return "error";
      } finally {
        running.delete(analysisId);
        emit();
      }
    },
    [scope, upsertMany, email],
  );

  return { run, scope, isRunning: (analysisId: string) => busy.split("|").includes(analysisId) };
}
