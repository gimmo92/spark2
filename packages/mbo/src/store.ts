"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAccess, useCollection, useCore, useSettings, useSparkConfig, type LetterTemplate } from "@spark/core";
import { SCHEDA_EDIT } from "./module";
import type { GlobalGate, MboOptions, ObjectiveDef, Preset, Scheda, SchedaItem } from "./lib/mbo";
import type { Workflow } from "./lib/workflow";

/** Switches the client app turned on for the MBO module (`createMboModule(options)`). */
export function useMboOptions(): MboOptions {
  const { modules } = useSparkConfig();
  return useMemo(() => (modules.find((m) => m.id === "mbo")?.options ?? {}) as MboOptions, [modules]);
}

export interface MboSettings {
  /** Global threshold objective (catalog id): if missed, no scheda pays out. */
  globalThresholdId?: string;
  /** Actual result of the global threshold objective (undefined = not measured yet). */
  globalThresholdActual?: number;
  /** Completed activities, when the global threshold is a "progetto" objective. */
  globalThresholdDone?: string[];
  /** Values of the 0-100 % / KPI activities, when the global threshold is a "progetto" objective. */
  globalThresholdValues?: Record<string, number>;
}

const today = () => new Date().toISOString().slice(0, 10);
let seq = 0;
/** Unique even when several records are created in the same millisecond (bulk duplicate). */
const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** MBO state and actions. Also exposes the core helpers MBO screens need (users, notify, hydrated). */
export function useMbo() {
  const { users, notify, hydrated } = useCore();
  const { allowed } = useAccess();
  const [schede, setSchede] = useCollection<Scheda>("schede");
  const [objectives, setObjectives] = useCollection<ObjectiveDef>("objectives");
  const [presets, setPresets] = useCollection<Preset>("presets");
  const [workflows, setWorkflows] = useCollection<Workflow>("workflows");
  const [mboSettings, setMboSettings] = useSettings<MboSettings>("mbo", {});

  const addScheda = useCallback(
    (s: Omit<Scheda, "id" | "updatedAt">) => {
      const scheda: Scheda = { ...s, id: newId("s"), updatedAt: today() };
      setSchede((prev) => [scheda, ...prev]);
      return scheda;
    },
    [setSchede],
  );
  const updateScheda = useCallback(
    (id: string, patch: Partial<Scheda>) => setSchede((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: today() } : s))),
    [setSchede],
  );

  const addObjective = useCallback(
    (o: Omit<ObjectiveDef, "id" | "updatedAt">) => {
      const obj: ObjectiveDef = { ...o, id: `ob${Date.now().toString(36)}`, updatedAt: today() };
      setObjectives((prev) => [obj, ...prev]);
      return obj;
    },
    [setObjectives],
  );
  /**
   * Objectives created inside a scheda are catalog objectives like any other: each new one-off definition
   * (`item.custom`) becomes a catalog objective and the item points to it. Returns the new items.
   * Not a new objective: a catalog objective personalized for one scheda (`custom.originId`) stays a copy inside
   * the scheda, and so does a new one named like an existing catalog objective of the same cycle (it becomes
   * that objective's personalized copy) — so the catalog has one objective per name.
   */
  const catalogItems = useCallback(
    (items: SchedaItem[], cycle: string): SchedaItem[] => {
      if (!items.some((it) => it.custom)) return items;
      const created: ObjectiveDef[] = [];
      const key = (o: Pick<ObjectiveDef, "name" | "cycle">) => `${o.name.trim().toLowerCase()}|${o.cycle ?? cycle}`;
      const byName = new Map(objectives.filter((o) => !o.archived).map((o) => [key(o), o.id]));
      const next = items.map((it) => {
        if (!it.custom) return it;
        if (it.custom.originId) return it;
        const same = byName.get(key(it.custom));
        if (same) return { ...it, custom: { ...it.custom, originId: same } };
        const def = { ...it.custom };
        delete def.originId;
        // id derived from the one-off definition: running twice (e.g. React dev double effects) can't duplicate it
        const obj: ObjectiveDef = { ...def, id: `ob-${def.id}`, cycle: def.cycle ?? cycle, updatedAt: today() };
        created.push(obj);
        const rest = { ...it };
        delete rest.custom;
        delete rest.levels;
        return { ...rest, objectiveId: obj.id };
      });
      if (created.length) setObjectives((prev) => [...created, ...prev.filter((o) => !created.some((c) => c.id === o.id))]);
      return next;
    },
    [objectives, setObjectives],
  );
  const updateObjective = useCallback(
    (id: string, patch: Partial<ObjectiveDef>) => setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: today() } : o))),
    [setObjectives],
  );

  const savePreset = useCallback(
    (p: Omit<Preset, "id"> & { id?: string }) => {
      const preset: Preset = { ...p, id: p.id ?? `pr${Date.now().toString(36)}` };
      setPresets((prev) => (prev.some((x) => x.id === preset.id) ? prev.map((x) => (x.id === preset.id ? preset : x)) : [...prev, preset]));
      return preset;
    },
    [setPresets],
  );
  const deletePreset = useCallback((id: string) => setPresets((prev) => prev.filter((p) => p.id !== id)), [setPresets]);

  const saveWorkflow = useCallback(
    (w: Omit<Workflow, "id" | "updatedAt"> & { id?: string }) => {
      const wf: Workflow = { ...w, id: w.id ?? `wf${Date.now().toString(36)}`, updatedAt: today() };
      setWorkflows((prev) => (prev.some((x) => x.id === wf.id) ? prev.map((x) => (x.id === wf.id ? wf : x)) : [wf, ...prev]));
      return wf;
    },
    [setWorkflows],
  );
  const updateWorkflow = useCallback(
    (id: string, patch: Partial<Workflow>) => setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: today() } : w))),
    [setWorkflows],
  );

  const globalGate = useMemo<GlobalGate>(() => ({ objectiveId: mboSettings.globalThresholdId, actual: mboSettings.globalThresholdActual }), [mboSettings]);

  /** The logged-in user may create schede (for someone) / change this scheda (every assignee in scope). */
  const canCreateScheda = SCHEDA_EDIT.some((p) => allowed(p));
  const canEditScheda = useCallback(
    (s: Pick<Scheda, "assigneeIds">) => {
      if (!s.assigneeIds.length) return SCHEDA_EDIT.some((p) => allowed(p));
      const people = s.assigneeIds.map((id) => users.find((u) => u.id === id));
      // assignees this user can't even see need the "all" scope
      return SCHEDA_EDIT.some((p) => people.every((u) => (u ? allowed(p, u) : allowed(`${p}:all`))));
    },
    [users, allowed],
  );

  return {
    canCreateScheda,
    canEditScheda,
    users,
    notify,
    hydrated,
    schede,
    addScheda,
    updateScheda,
    objectives,
    addObjective,
    catalogItems,
    updateObjective,
    presets,
    savePreset,
    deletePreset,
    workflows,
    saveWorkflow,
    updateWorkflow,
    mboSettings,
    setMboSettings,
    globalGate,
  };
}

/** Letter templates for workflow "lettera" steps (readable with "Gestire i modelli di lettera"). */
export function useLetterTemplates() {
  const [letters] = useCollection<LetterTemplate>("letters");
  const sorted = useMemo(() => [...letters].sort((a, b) => a.name.localeCompare(b.name, "it")), [letters]);
  const letterName = useCallback((id?: string) => (id ? (letters.find((l) => l.id === id)?.name ?? id) : "—"), [letters]);
  return { letters: sorted, letterName };
}

/**
 * One-time upgrade: schede saved when objectives created inside a scheda stayed there (`item.custom`)
 * get them moved to the catalog, so the objectives list shows every objective. Needs the catalog permission.
 */
export function useCatalogCustomObjectives() {
  const { schede, hydrated, catalogItems, updateScheda, canEditScheda } = useMbo();
  const { allowed } = useAccess();
  const done = useRef(false);
  useEffect(() => {
    if (!hydrated || done.current || !allowed("mbo.catalog.manage")) return;
    done.current = true;
    for (const s of schede) if (s.items.some((it) => it.custom && !it.custom.originId) && canEditScheda(s)) updateScheda(s.id, { items: catalogItems(s.items, s.cycle) });
  }, [hydrated, schede, allowed, catalogItems, updateScheda, canEditScheda]);
}
