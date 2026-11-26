"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useData, useSettings } from "@spark/core";
import { DEFAULT_SCOPE, benchmarkKey, cleanScope, uncovered, type BenchmarkDoc, type BenchmarkScope, type BenchmarkStats } from "../lib/benchmark";
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
 * Fills the company's benchmark cache for an analysis' roles in the background (server route
 * /api/transparency/benchmark): only roles not cached yet for the current scope, never the
 * uncovered ones; started when an analysis is saved and by the Benchmarks page.
 */
export function useBenchmarkRunner() {
  const { get, sectorOf, add } = useBenchmarks();
  const email = useData().viewer?.email;
  const [stored] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const scope = cleanScope(stored);
  const busy = useSyncExternalStore(subscribe, snapshot, () => "");

  const run = useCallback(
    async (analysisId: string, people: Employee[]): Promise<"ok" | "error"> => {
      if (running.has(analysisId)) return "ok";
      const known = scope.sector || sectorOf(analysisId);
      const roles = rolesOf(people).filter((r) => !uncovered(r.role));
      // with the sector still unknown every role goes: the answer also recognises the sector
      const todo = known ? roles.filter((r) => !get(benchmarkKey(r, scope, known))) : roles;
      if (!todo.length) return "ok";
      running.add(analysisId);
      emit();
      try {
        const r = await fetch("/api/transparency/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: { ...scope, sector: known }, roles: todo.map(({ role, level, ccnl, qualification }) => ({ role, level, ccnl, qualification })) }),
        });
        const body = (await r.json().catch(() => ({}))) as { roles?: { role: string; stats: BenchmarkStats | null }[]; sector?: string; source?: string };
        if (!r.ok || !body.roles) return "error";
        const sector = known || body.sector || "";
        const now = new Date().toISOString();
        const byRole = new Map(todo.map((x) => [x.role, x]));
        add([
          ...(!scope.sector && sector ? [{ id: `sector:${analysisId}`, kind: "sector" as const, analysisId, sector }] : []),
          ...body.roles.flatMap((x): BenchmarkDoc[] => {
            const info = byRole.get(x.role);
            if (!info) return [];
            return [
              {
                id: benchmarkKey(info, scope, sector),
                kind: "role",
                role: x.role,
                ...(info.level && { level: info.level }),
                ...(info.ccnl && { ccnl: info.ccnl }),
                scope,
                ...(sector && { sector }),
                stats: x.stats,
                source: body.source ?? "",
                fetchedAt: now,
                fetchedBy: email,
              },
            ];
          }),
        ]);
        return "ok";
      } catch {
        return "error";
      } finally {
        running.delete(analysisId);
        emit();
      }
    },
    [scope, get, sectorOf, add, email],
  );

  return { run, scope, isRunning: (analysisId: string) => busy.split("|").includes(analysisId) };
}
