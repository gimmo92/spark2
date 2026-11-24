"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buOfTeam, collectionsOf, type OrgConfig, type SparkConfig } from "../config";
import { DataProvider, useCollection, useData } from "../data/DataProvider";
import type { User } from "../people/data";
import { INVITE_ERRORS, type InviteDTO, type InvitesStatus } from "../people/invites";
import { addMessages } from "../i18n/i18n";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { tr } from "../i18n/i18n";

interface Toast {
  id: number;
  message: string;
}

interface CoreCtx {
  config: SparkConfig;
  toasts: Toast[];
  notify: (message: string) => void;
  /** Registration invites keyed by lowercase email (from /api/invites). */
  invites: Record<string, InviteDTO>;
  invitesStatus: InvitesStatus;
  invitesMessage: string | null;
  sendInvite: (email: string, fullName: string) => Promise<{ ok: boolean; message?: string }>;
}

const Ctx = createContext<CoreCtx | null>(null);

/** Root provider of every Spark app: config, data store, toasts, invites. */
export function SparkProvider({ config, children }: { config: SparkConfig; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [invites, setInvites] = useState<Record<string, InviteDTO>>({});
  const [invitesStatus, setInvitesStatus] = useState<InvitesStatus>("loading");
  const [invitesMessage, setInvitesMessage] = useState<string | null>(null);
  const collections = useMemo(() => collectionsOf(config), [config]);
  // module + client dictionaries (idempotent: same texts every render)
  useMemo(() => {
    for (const m of config.modules) addMessages(m.messages);
    addMessages(config.messages);
  }, [config]);

  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const onSaveError = useCallback(() => notify(tr("Salvataggio nel database non riuscito: riprovo alla prossima modifica.")), [notify]);
  const onRejected = useCallback(
    (n: number) => notify(n === 1 ? tr("Una modifica non è consentita dal tuo livello di accesso: non è stata salvata.") : tr("{0} modifiche non consentite dal tuo livello di accesso: non sono state salvate.", [n])),
    [notify],
  );

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
    return { ok: false, message: tr(INVITE_ERRORS[data.error ?? ""] ?? "Invio non riuscito. Riprova.") };
  }, []);

  const value = useMemo(
    () => ({ config, toasts, notify, invites, invitesStatus, invitesMessage, sendInvite }),
    [config, toasts, notify, invites, invitesStatus, invitesMessage, sendInvite],
  );

  return (
    <Ctx.Provider value={value}>
      <DataProvider
        collections={collections}
        seed={config.seed}
        migrate={config.migrate}
        storagePrefix={config.storagePrefix ?? "spark.v5"}
        onSaveError={onSaveError}
        onRejected={onRejected}
      >
        {/* below the data store: switching language remounts the UI, not the data */}
        <LocaleProvider defaultLocale={config.locale}>{children}</LocaleProvider>
      </DataProvider>
    </Ctx.Provider>
  );
}

function useCoreCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Spark hooks must be used inside SparkProvider");
  return ctx;
}

export const useSparkConfig = () => useCoreCtx().config;

/** Organisation data from the client config, plus helpers. */
export function useOrg(): OrgConfig & {
  teamNames: string[];
  buNames: string[];
  companyForTeam: (team: string) => string;
  buForTeam: (team: string) => string | undefined;
} {
  const { org } = useCoreCtx().config;
  return useMemo(
    () => ({
      ...org,
      teamNames: org.teams.map((t) => t.name),
      buNames: (org.businessUnits ?? []).map((b) => b.name),
      companyForTeam: (team: string) => org.teams.find((t) => t.name === team)?.company ?? org.companies[0] ?? "",
      buForTeam: buOfTeam(org),
    }),
    [org],
  );
}

/** Core state: users, invites, toasts, data status. */
export function useCore() {
  const core = useCoreCtx();
  const { hydrated, dataSource, dataMessage, viewer, reset } = useData();
  const [users, setUsers] = useCollection<User>("users");

  const addUser = useCallback(
    (u: Omit<User, "id" | "createdAt">) => {
      const user: User = { ...u, id: `u${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) };
      setUsers((prev) => [user, ...prev]);
      return user;
    },
    [setUsers],
  );
  const updateUser = useCallback(
    (id: string, patch: Partial<User>) => setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u))),
    [setUsers],
  );

  return { ...core, users, addUser, updateUser, hydrated, dataSource, dataMessage, viewer, resetData: reset };
}
