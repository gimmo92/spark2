"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useData, useOrg, useSettings } from "@spark/core";
import { DEFAULT_SCOPE, benchmarkKey, cleanScope, effectiveSector, uncovered, type BenchmarkDoc, type BenchmarkScope, type BenchmarkStats } from "../lib/benchmark";
import type { Employee } from "../lib/models/Employee";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks } from "../store";

/** Runs in progress, one per analysis + scope (shared by every screen, survives page changes). */
const running = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => [...running].join("\n");
const runKey = (analysisId: string, scope: BenchmarkScope) => `${analysisId}|${JSON.stringify(cleanScope(scope))}`;

/**
 * Fills the company's benchmark cache for an analysis' roles in the background (server route
 * /api/transparency/benchmark): only roles not cached yet for the scope, never the uncovered ones.
 * Default scope: the company's (settings doc "benchmark"); the role page passes its own.
 */
export function useBenchmarkRunner() {
  const { get, sectorOf, add } = useBenchmarks();
  const email = useData().viewer?.email;
  const { sector: companySector } = useOrg();
  const [stored] = useSettings<BenchmarkScope>("benchmark", DEFAULT_SCOPE);
  const defaultScope = cleanScope(stored);
  const busy = useSyncExternalStore(subscribe, snapshot, () => "");

  const run = useCallback(
    async (analysisId: string, people: Employee[], scopeArg?: BenchmarkScope, aliases?: Record<string, string[]>): Promise<"ok" | "error"> => {
      const scope = cleanScope(scopeArg ?? defaultScope);
      const key = runKey(analysisId, scope) + (aliases ? `|${JSON.stringify(aliases)}` : "");
      if (running.has(key)) return "ok";
      const known = effectiveSector(scope, companySector, sectorOf(analysisId));
      const roles = rolesOf(people)
        .filter((r) => !uncovered(r.role) && (!aliases || r.role in aliases))
        .map((r) => ({ ...r, aliases: aliases?.[r.role] }));
      // with the sector still unknown every role goes: the answer also recognises the sector
      const todo = known ? roles.filter((r) => !get(benchmarkKey(r, scope, known))) : roles;
      if (!todo.length) return "ok";
      running.add(key);
      emit();
      try {
        const r = await fetch("/api/transparency/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, sector: known, roles: todo.map(({ role, aliases: aka, level, ccnl, qualification }) => ({ role, aliases: aka, level, ccnl, qualification })) }),
        });
        const body = (await r.json().catch(() => ({}))) as { roles?: { role: string; stats: BenchmarkStats | null }[]; sector?: string; source?: string };
        if (!r.ok || !body.roles) return "error";
        const sector = known || body.sector || "";
        const now = new Date().toISOString();
        const byRole = new Map(todo.map((x) => [x.role, x]));
        add([
          ...(!known && sector ? [{ id: `sector:${analysisId}`, kind: "sector" as const, analysisId, sector }] : []),
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
        running.delete(key);
        emit();
      }
    },
    [defaultScope, get, sectorOf, add, email, companySector],
  );

  return {
    run,
    scope: defaultScope,
    isRunning: (analysisId: string, scope?: BenchmarkScope, aliases?: Record<string, string[]>) =>
      busy.split("\n").includes(runKey(analysisId, scope ?? defaultScope) + (aliases ? `|${JSON.stringify(aliases)}` : "")),
  };
}
