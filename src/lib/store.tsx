"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeedUsers, type User } from "./data";
import { buildSeedSchede, type Scheda } from "./mbo";

const KEY = "spark.users.v1";
const SCHEDE_KEY = "spark.schede.v1";

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
  resetData: () => void;
  toasts: Toast[];
  notify: (message: string) => void;
}

const Ctx = createContext<Store | null>(null);
const today = () => new Date().toISOString().slice(0, 10);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => buildSeedUsers());
  const [schede, setSchede] = useState<Scheda[]>(() => buildSeedSchede(buildSeedUsers()));
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      if (raw) setUsers(JSON.parse(raw));
      const rawS = localStorage.getItem(SCHEDE_KEY);
      if (rawS) setSchede(JSON.parse(rawS));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(users));
      localStorage.setItem(SCHEDE_KEY, JSON.stringify(schede));
    } catch {}
  }, [users, schede, hydrated]);

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

  const resetData = useCallback(() => {
    const seed = buildSeedUsers();
    setUsers(seed);
    setSchede(buildSeedSchede(seed));
  }, []);

  const value = useMemo(
    () => ({ users, addUser, updateUser, schede, addScheda, updateScheda, resetData, toasts, notify }),
    [users, addUser, updateUser, schede, addScheda, updateScheda, resetData, toasts, notify],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
