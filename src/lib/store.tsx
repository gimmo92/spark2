"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeedUsers, type User } from "./data";
import { INVITE_ERRORS, type InviteDTO, type InvitesStatus } from "./invites";
import { SEED_WORKFLOWS, type Workflow } from "./workflow";
import { SEED_OBJECTIVES, SEED_PRESETS, buildSeedSchede, type GlobalGate, type ObjectiveDef, type Preset, type Scheda } from "./mbo";

const KEY = "spark.users.v4";
const SCHEDE_KEY = "spark.schede.v4";
const OBJ_KEY = "spark.objectives.v3";
const PRESET_KEY = "spark.presets.v1";
const WORKFLOW_KEY = "spark.workflows.v1";
const SETTINGS_KEY = "spark.mbo-settings.v1";

export interface MboSettings {
  /** Global threshold objective (catalog id): if missed, no scheda pays out. */
  globalThresholdId?: string;
  /** Actual result of the global threshold objective (undefined = not measured yet). */
  globalThresholdActual?: number;
}

interface Toast {
  id: number;
  message: string;
}

interface Store {
  users: User[];
  addUser: (u: Omit<User, "id" | "createdAt">) => User;
  updateUser: (id: string, patch: Partial<User>) => void;
  schede: Scheda[];
  addScheda: (s: Omit<Scheda, "id" | "updatedAt">) => Scheda;
  updateScheda: (id: string, patch: Partial<Scheda>) => void;
  objectives: ObjectiveDef[];
  addObjective: (o: Omit<ObjectiveDef, "id" | "updatedAt">) => ObjectiveDef;
  updateObjective: (id: string, patch: Partial<ObjectiveDef>) => void;
  presets: Preset[];
  workflows: Workflow[];
  saveWorkflow: (w: Omit<Workflow, "id" | "updatedAt"> & { id?: string }) => Workflow;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  /** Registration invites keyed by lowercase email (from /api/invites). */
  invites: Record<string, InviteDTO>;
  invitesStatus: InvitesStatus;
  invitesMessage: string | null;
  sendInvite: (email: string, fullName: string) => Promise<{ ok: boolean; message?: string }>;
  mboSettings: MboSettings;
  globalGate: GlobalGate;
  setMboSettings: (patch: Partial<MboSettings>) => void;
  savePreset: (p: Omit<Preset, "id"> & { id?: string }) => Preset;
  deletePreset: (id: string) => void;
  resetData: () => void;
  hydrated: boolean;
  toasts: Toast[];
  notify: (message: string) => void;
}

const Ctx = createContext<Store | null>(null);
const today = () => new Date().toISOString().slice(0, 10);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => buildSeedUsers());
  const [schede, setSchede] = useState<Scheda[]>(() => buildSeedSchede(buildSeedUsers()));
  const [objectives, setObjectives] = useState<ObjectiveDef[]>(SEED_OBJECTIVES);
  const [presets, setPresets] = useState<Preset[]>(SEED_PRESETS);
  const [workflows, setWorkflows] = useState<Workflow[]>(SEED_WORKFLOWS);
  const [mboSettings, setMboSettingsState] = useState<MboSettings>({ globalThresholdId: "ob-ebitda" });
  const [hydrated, setHydrated] = useState(false);
  const [invites, setInvites] = useState<Record<string, InviteDTO>>({});
  const [invitesStatus, setInvitesStatus] = useState<InvitesStatus>("loading");
  const [invitesMessage, setInvitesMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      if (raw) setUsers(JSON.parse(raw));
      const rawS = localStorage.getItem(SCHEDE_KEY);
      if (rawS) setSchede(JSON.parse(rawS));
      const rawO = localStorage.getItem(OBJ_KEY);
      if (rawO) setObjectives(JSON.parse(rawO));
      const rawP = localStorage.getItem(PRESET_KEY);
      if (rawP) setPresets(JSON.parse(rawP));
      const rawW = localStorage.getItem(WORKFLOW_KEY);
      if (rawW) setWorkflows(JSON.parse(rawW));
      const rawSt = localStorage.getItem(SETTINGS_KEY);
      if (rawSt) {
        const st = JSON.parse(rawSt) as MboSettings & { defaultThresholdId?: string };
        // migrate the old "default for new schede" setting to the global threshold
        if (st.defaultThresholdId && !st.globalThresholdId) st.globalThresholdId = st.defaultThresholdId;
        delete st.defaultThresholdId;
        setMboSettingsState(st);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(users));
      localStorage.setItem(SCHEDE_KEY, JSON.stringify(schede));
      localStorage.setItem(OBJ_KEY, JSON.stringify(objectives));
      localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
      localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflows));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(mboSettings));
    } catch {}
  }, [users, schede, objectives, presets, workflows, mboSettings, hydrated]);

  // invites live on the server: load once
  useEffect(() => {
    let alive = true;
    fetch("/api/invites")
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { invites?: InviteDTO[]; error?: string };
        if (!alive) return;
        if (r.ok && data.invites) {
          setInvites(Object.fromEntries(data.invites.map((i) => [i.email, i])));
          setInvitesStatus("ready");
        } else {
          setInvitesStatus("unavailable");
          setInvitesMessage(INVITE_ERRORS[data.error ?? "config"] ?? INVITE_ERRORS.config);
        }
      })
      .catch(() => {
        if (!alive) return;
        setInvitesStatus("unavailable");
        setInvitesMessage(INVITE_ERRORS.config);
      });
    return () => {
      alive = false;
    };
  }, []);

  const sendInvite = useCallback(async (email: string, fullName: string) => {
    const r = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName }),
    });
    const data = (await r.json().catch(() => ({}))) as { invite?: InviteDTO; error?: string };
    if (r.ok && data.invite) {
      setInvites((prev) => ({ ...prev, [data.invite!.email]: data.invite! }));
      setInvitesStatus("ready");
      return { ok: true };
    }
    return { ok: false, message: INVITE_ERRORS[data.error ?? ""] ?? "Invio non riuscito. Riprova." };
  }, []);

  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const addUser = useCallback((u: Omit<User, "id" | "createdAt">) => {
    const user: User = { ...u, id: `u${Date.now()}`, createdAt: today() };
    setUsers((prev) => [user, ...prev]);
    return user;
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const addScheda = useCallback((s: Omit<Scheda, "id" | "updatedAt">) => {
    const scheda: Scheda = { ...s, id: `s${Date.now()}`, updatedAt: today() };
    setSchede((prev) => [scheda, ...prev]);
    return scheda;
  }, []);

  const updateScheda = useCallback((id: string, patch: Partial<Scheda>) => {
    setSchede((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: today() } : s)));
  }, []);

  const addObjective = useCallback((o: Omit<ObjectiveDef, "id" | "updatedAt">) => {
    const obj: ObjectiveDef = { ...o, id: `ob${Date.now().toString(36)}`, updatedAt: today() };
    setObjectives((prev) => [obj, ...prev]);
    return obj;
  }, []);

  const updateObjective = useCallback((id: string, patch: Partial<ObjectiveDef>) => {
    setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: today() } : o)));
  }, []);

  const savePreset = useCallback((p: Omit<Preset, "id"> & { id?: string }) => {
    const preset: Preset = { ...p, id: p.id ?? `pr${Date.now().toString(36)}` };
    setPresets((prev) => (prev.some((x) => x.id === preset.id) ? prev.map((x) => (x.id === preset.id ? preset : x)) : [...prev, preset]));
    return preset;
  }, []);

  const setMboSettings = useCallback((patch: Partial<MboSettings>) => setMboSettingsState((s) => ({ ...s, ...patch })), []);

  const saveWorkflow = useCallback((w: Omit<Workflow, "id" | "updatedAt"> & { id?: string }) => {
    const wf: Workflow = { ...w, id: w.id ?? `wf${Date.now().toString(36)}`, updatedAt: today() };
    setWorkflows((prev) => (prev.some((x) => x.id === wf.id) ? prev.map((x) => (x.id === wf.id ? wf : x)) : [wf, ...prev]));
    return wf;
  }, []);

  const updateWorkflow = useCallback((id: string, patch: Partial<Workflow>) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: today() } : w)));
  }, []);

  const deletePreset = useCallback((id: string) => setPresets((prev) => prev.filter((p) => p.id !== id)), []);

  const globalGate = useMemo<GlobalGate>(
    () => ({ objectiveId: mboSettings.globalThresholdId, actual: mboSettings.globalThresholdActual }),
    [mboSettings],
  );

  const resetData = useCallback(() => {
    const seed = buildSeedUsers();
    setUsers(seed);
    setSchede(buildSeedSchede(seed));
    setObjectives(SEED_OBJECTIVES);
    setPresets(SEED_PRESETS);
    setWorkflows(SEED_WORKFLOWS);
  }, []);

  const value = useMemo(
    () => ({ users, addUser, updateUser, schede, addScheda, updateScheda, objectives, addObjective, updateObjective, presets, savePreset, deletePreset, workflows, saveWorkflow, updateWorkflow, mboSettings, setMboSettings, globalGate, invites, invitesStatus, invitesMessage, sendInvite, resetData, hydrated, toasts, notify }),
    [users, addUser, updateUser, schede, addScheda, updateScheda, objectives, addObjective, updateObjective, presets, savePreset, deletePreset, workflows, saveWorkflow, updateWorkflow, mboSettings, setMboSettings, globalGate, invites, invitesStatus, invitesMessage, sendInvite, resetData, hydrated, toasts, notify],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
