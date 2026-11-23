"use client";

import { useCallback, useMemo } from "react";
import { useAccess, useCollection, useCore, useSettings } from "@spark/core";
import { SCHEDA_EDIT } from "./module";
import type { GlobalGate, ObjectiveDef, Preset, Scheda } from "./lib/mbo";
import type { Workflow } from "./lib/workflow";

export interface MboSettings {
  /** Global threshold objective (catalog id): if missed, no scheda pays out. */
  globalThresholdId?: string;
  /** Actual result of the global threshold objective (undefined = not measured yet). */
  globalThresholdActual?: number;
  /** Completed activities, when the global threshold is a "progetto" objective. */
  globalThresholdDone?: string[];
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
    (id: string, patch: Partial<Scheda>) =>
      setSchede((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: today() } : s))),
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
  const updateObjective = useCallback(
    (id: string, patch: Partial<ObjectiveDef>) =>
      setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: today() } : o))),
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
    (id: string, patch: Partial<Workflow>) =>
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: today() } : w))),
    [setWorkflows],
  );

  const globalGate = useMemo<GlobalGate>(
    () => ({ objectiveId: mboSettings.globalThresholdId, actual: mboSettings.globalThresholdActual }),
    [mboSettings],
  );

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
