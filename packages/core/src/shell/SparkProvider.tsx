"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { applyModules, buOfTeam, collectionsOf, type OrgConfig, type SparkConfig } from "../config";
import { DataProvider, useCollection, useData, useSettings } from "../data/DataProvider";
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
        <ModuleScope value={value}>
          {/* below the data store: switching language remounts the UI, not the data */}
          <LocaleProvider defaultLocale={config.locale}>{children}</LocaleProvider>
        </ModuleScope>
      </DataProvider>
    </Ctx.Provider>
  );
}

/** Below the data store: the config with only the modules the server says are on (Spark panel). */
function ModuleScope({ value, children }: { value: CoreCtx; children: React.ReactNode }) {
  const enabled = useData().viewer?.modules;
  const key = enabled?.join(",");
  const scoped = useMemo(
    () => (key === undefined ? value : { ...value, config: applyModules(value.config, key ? key.split(",") : []) }),
    [value, key],
  );
  return <Ctx.Provider value={scoped}>{children}</Ctx.Provider>;
}

function useCoreCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Spark hooks must be used inside SparkProvider");
  return ctx;
}

export const useSparkConfig = () => useCoreCtx().config;

/** Organisation data edited in the app (settings document "org"); missing fields fall back to the client config. */
export interface OrgSettings {
  /** Companies of the group (La mia azienda → Lista Società). */
  companies?: string[];
  /** Teams (Lista Team, permission "teams.manage"). */
  teams?: OrgConfig["teams"];
  /** Business units (permission "teams.manage"). */
  businessUnits?: OrgConfig["businessUnits"];
  /** Sector of the company (La mia azienda → Modifica azienda), used e.g. by market benchmarks. */
  sector?: string;
}

const NO_BUS: NonNullable<OrgConfig["businessUnits"]> = [];

/** Organisation data from the client config and the in-app settings, plus helpers. */
export function useOrg(): OrgConfig & {
  teamNames: string[];
  buNames: string[];
  companyForTeam: (team: string) => string;
  buForTeam: (team: string) => string | undefined;
  /** Saves the companies list (permission "companies.manage"). */
  setCompanies: (companies: string[]) => void;
  /** Saves the teams / business units (permission "teams.manage"). */
  setTeams: (teams: OrgConfig["teams"]) => void;
  setBusinessUnits: (bus: NonNullable<OrgConfig["businessUnits"]>) => void;
  /** Sector of the company ("" = not set). */
  sector: string;
  setSector: (sector: string) => void;
} {
  const { org } = useCoreCtx().config;
  const [stored, patch] = useSettings<OrgSettings>("org", {});
  const companies = stored.companies ?? org.companies;
  const teams = stored.teams ?? org.teams;
  const businessUnits = stored.businessUnits ?? org.businessUnits ?? NO_BUS;
  return useMemo(
    () => ({
      ...org,
      companies,
      teams,
      businessUnits,
      teamNames: teams.map((t) => t.name),
      buNames: businessUnits.map((b) => b.name),
      companyForTeam: (team: string) => teams.find((t) => t.name === team)?.company ?? companies[0] ?? "",
      buForTeam: buOfTeam({ teams }),
      setCompanies: (list: string[]) => patch({ companies: list }),
      setTeams: (list: OrgConfig["teams"]) => patch({ teams: list }),
      setBusinessUnits: (list: NonNullable<OrgConfig["businessUnits"]>) => patch({ businessUnits: list }),
      sector: stored.sector ?? "",
      setSector: (sector: string) => patch({ sector }),
    }),
    [org, companies, teams, businessUnits, stored.sector, patch],
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
