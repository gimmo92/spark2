"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "../config";
import { DATA_ERRORS, diffById, type DataChanges, type DataSource, type ViewerDTO } from "./sync";

type Data = Record<string, Doc[]>;

interface DataCtx {
  data: Data;
  setCollection: (collection: string, update: (prev: Doc[]) => Doc[]) => void;
  /** True once data has been loaded (from the database or this browser). */
  hydrated: boolean;
  /** "db" = saved on Supabase, "local" = only in this browser (reason in dataMessage). */
  dataSource: DataSource;
  dataMessage: string | null;
  /** Logged-in user as resolved by the server (null in browser-only mode: everything is allowed there). */
  viewer: ViewerDTO | null;
  /** Replace everything with the seed data. */
  reset: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

interface Props {
  collections: string[];
  seed?: () => Partial<Record<string, Doc[]>>;
  migrate?: (collection: string, items: Doc[]) => Doc[];
  storagePrefix: string;
  onSaveError: () => void;
  /** Some changes were refused by the server (permissions). */
  onRejected?: (count: number) => void;
  children: React.ReactNode;
}

const fill = (collections: string[], from?: Partial<Record<string, Doc[]>>): Data =>
  Object.fromEntries(collections.map((c) => [c, from?.[c] ?? []]));

/**
 * Generic record store for every collection of the app. Loads from /api/data (Supabase) and saves
 * only what changed, 500 ms after each edit. Without a database session it falls back to localStorage.
 */
export function DataProvider({ collections, seed, migrate, storagePrefix, onSaveError, onRejected, children }: Props) {
  const [data, setData] = useState<Data>(() => fill(collections, seed?.()));
  const [hydrated, setHydrated] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerDTO | null>(null);

  /** Last state known to be in the database (diffed so only changes are sent). */
  const synced = useRef<Data | null>(null);
  const current = useRef<Data>(data);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onError = useRef(onSaveError);
  const onRefused = useRef(onRejected);
  useEffect(() => {
    onError.current = onSaveError;
    onRefused.current = onRejected;
    current.current = data;
  });

  const key = useCallback((c: string) => `${storagePrefix}.${c}`, [storagePrefix]);

  // load: database first (needs the full login), otherwise fall back to this browser
  useEffect(() => {
    let alive = true;
    const up = (c: string, items: Doc[]) => (migrate ? migrate(c, items) : items);
    const fromLocal = (): Data => {
      const out: Data = { ...current.current };
      for (const c of collections) {
        try {
          const raw = localStorage.getItem(key(c));
          if (raw) out[c] = JSON.parse(raw);
        } catch {}
        out[c] = up(c, out[c]);
      }
      return out;
    };

    (async () => {
      let res: Response | null = null;
      let body: { data?: Data; empty?: boolean; error?: string; viewer?: ViewerDTO } = {};
      try {
        res = await fetch("/api/data", { cache: "no-store" });
        body = await res.json().catch(() => ({}));
      } catch {}
      if (!alive) return;

      if (res?.ok && body.viewer) setViewer(body.viewer);
      if (res?.ok && body.data && !body.empty) {
        const db = fill(collections, body.data);
        const upgraded: Data = Object.fromEntries(collections.map((c) => [c, up(c, db[c])]));
        // admins save shape upgrades back to the database; others only see a filtered subset, so they don't
        synced.current = body.viewer?.isAdmin === false ? upgraded : db;
        setData(upgraded);
        setDataSource("db");
      } else if (res?.ok && body.empty) {
        // first run on this database: upload what this browser has (or the seed data)
        synced.current = fill(collections);
        setData(fromLocal());
        setDataSource("db");
      } else if (body.error === "tenant") {
        // multi-tenant app, Spark staff: no tenant picked yet (the shell shows the tenant list)
        if (body.viewer) setViewer(body.viewer);
        setData(fill(collections));
        setDataSource("denied");
        setDataMessage(DATA_ERRORS.tenant);
      } else if (body.error === "unlinked") {
        // logged in, but not a Spark user: show nothing
        setData(fill(collections));
        setDataSource("denied");
        setDataMessage(DATA_ERRORS.unlinked);
      } else {
        setData(fromLocal());
        setDataSource("local");
        setDataMessage(DATA_ERRORS[body.error ?? "network"] ?? DATA_ERRORS.network);
      }
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [collections, key, migrate]);

  // browser-only mode: keep using localStorage
  useEffect(() => {
    if (!hydrated || dataSource !== "local") return;
    for (const c of collections) {
      try {
        localStorage.setItem(key(c), JSON.stringify(data[c]));
      } catch {}
    }
  }, [data, hydrated, dataSource, collections, key]);

  /** Send what changed since the last successful save. */
  const flush = useCallback(
    async (keepalive = false) => {
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
      }
      const before = synced.current;
      if (!before) return;
      const now = current.current;
      const changes: Required<DataChanges> = { upserts: {}, deletes: {} };
      let count = 0;
      for (const c of collections) {
        const { upserts, deletes } = diffById(before[c] ?? [], now[c] ?? []);
        if (upserts.length) changes.upserts[c] = upserts;
        if (deletes.length) changes.deletes[c] = deletes;
        count += upserts.length + deletes.length;
      }
      if (!count) return;
      synced.current = now;
      try {
        const r = await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
          keepalive,
        });
        if (!r.ok) throw new Error(String(r.status));
        const result = (await r.json().catch(() => ({}))) as { rejected?: number };
        if (result.rejected) onRefused.current?.(result.rejected);
      } catch {
        // put the changes back in the queue: they are retried with the next save
        if (synced.current === now) synced.current = before;
        onError.current();
      }
    },
    [collections],
  );

  // database mode: save changes shortly after they happen
  useEffect(() => {
    if (!hydrated || dataSource !== "db") return;
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => void flush(), 500);
  }, [data, hydrated, dataSource, flush]);

  // don't lose the last edit when the tab is closed
  useEffect(() => {
    if (dataSource !== "db") return;
    const onHide = () => {
      if (pending.current) void flush(true);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [dataSource, flush]);

  const setCollection = useCallback((c: string, update: (prev: Doc[]) => Doc[]) => {
    setData((d) => {
      const next = update(d[c] ?? []);
      return next === d[c] ? d : { ...d, [c]: next };
    });
  }, []);

  const reset = useCallback(() => setData(fill(collections, seed?.())), [collections, seed]);

  const value = useMemo(
    () => ({ data, setCollection, hydrated, dataSource, dataMessage, viewer, reset }),
    [data, setCollection, hydrated, dataSource, dataMessage, viewer, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

/** Records of one collection plus an immutable updater. */
export function useCollection<T extends Doc>(collection: string) {
  const { data, setCollection } = useData();
  const items = (data[collection] ?? []) as T[];
  const update = useCallback(
    (fn: (prev: T[]) => T[]) => setCollection(collection, (prev) => fn(prev as T[])),
    [collection, setCollection],
  );
  return [items, update] as const;
}

/** A single settings document (collection "settings") with defaults and a patch function. */
export function useSettings<T extends object>(id: string, defaults: T) {
  const [docs, update] = useCollection<Doc & T>("settings");
  const doc = docs.find((d) => d.id === id);
  const value = useMemo<T>(() => {
    const merged = { ...defaults, ...doc } as T & Partial<Doc>;
    delete merged.id;
    return merged;
    // defaults is a literal at the call site: only the stored doc matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);
  const patch = useCallback(
    (p: Partial<T>) =>
      update((prev) => {
        const old = prev.find((d) => d.id === id);
        const next = { ...defaults, ...old, ...p, id } as Doc & T;
        return old ? prev.map((d) => (d.id === id ? next : d)) : [...prev, next];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, update],
  );
  return [value, patch] as const;
}
