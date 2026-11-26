"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, Building2, Check, LogIn, Plus } from "lucide-react";
import { Badge, Field, GhostButton, Modal, PrimaryButton, inputCls } from "../ui/ui";
import { localeTag, tr } from "../i18n/i18n";
import { TENANT_ERRORS, type TenantDTO } from "./tenants";

/** Work on another tenant (or go back to the list with ""): the whole app reloads on its data, on `next` (default home). */
export async function switchTenant(id: string, next = "/") {
  const r = await fetch("/api/tenants", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  // full reload on purpose: data store and invites are loaded once per page load, for the new tenant
  if (r.ok) window.location.assign(next);
  return r.ok;
}

/**
 * Multi-tenant apps, staff who haven't picked a company and open a company page (e.g. Trasparenza):
 * pick the company, then stay on that page.
 */
export function TenantPicker({ path }: { path: string }) {
  const [tenants, setTenants] = useState<TenantDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/tenants", { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { tenants?: TenantDTO[]; error?: string };
        if (!alive) return;
        if (r.ok && body.tenants) setTenants(body.tenants);
        else setError(TENANT_ERRORS[body.error ?? "config"] ?? TENANT_ERRORS.config);
      })
      .catch(() => alive && setError(TENANT_ERRORS.config));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="card mx-auto mt-6 max-w-md p-6">
      <Building2 className="mx-auto h-6 w-6 text-brand" />
      <p className="mt-3 text-center text-[14px] font-semibold">{tr("Scegli l'azienda")}</p>
      <p className="mt-1 text-center text-[12.5px] text-muted">{tr("Questa pagina mostra i dati di un'azienda: entra in quella su cui vuoi lavorare.")}</p>
      {error && <p className="mt-3 text-center text-[12.5px] font-semibold text-amber-900">{tr(error)}</p>}
      {!tenants && !error && <p className="mt-3 text-center text-[12.5px] text-muted">{tr("Caricamento…")}</p>}
      {tenants && tenants.length === 0 && <p className="mt-3 text-center text-[12.5px] text-muted">{tr("Nessuna azienda: creane una dal Pannello Spark.")}</p>}
      {tenants && tenants.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
          {tenants.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.name}</span>
              <button
                type="button"
                onClick={() => void switchTenant(t.id, path)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft"
              >
                <LogIn className="h-3.5 w-3.5" /> {tr("Entra")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-center">
        <Link href="/spark" className="text-[12.5px] font-semibold text-brand hover:underline">{tr("Vai al Pannello Spark")}</Link>
      </p>
    </div>
  );
}

/**
 * Multi-tenant apps, Spark staff only (inside the Spark panel): the companies using the app. Staff
 * create a company (with its first admin, who gets the registration invite by email), choose its
 * modules and enter it to give support.
 */
export function TenantsPage({
  modules,
  modulesOf,
  onModules,
}: {
  /** Modules on in the installation, offered per company. */
  modules: { id: string; label: string }[];
  modulesOf: (tenant: string) => string[];
  onModules: (tenant: string, modules: string[]) => void;
}) {
  const [tenants, setTenants] = useState<TenantDTO[] | null>(null);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenants", { cache: "no-store" }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { tenants?: TenantDTO[]; current?: string; error?: string };
    if (r?.ok && body.tenants) {
      setTenants(body.tenants);
      setCurrent(body.current ?? "");
      setError(null);
    } else setError(TENANT_ERRORS[body?.error ?? "config"] ?? TENANT_ERRORS.config);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the server
    void load();
  }, [load]);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">{tr("Aziende")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {tenants ? tr("{0} aziende · scegli quella su cui lavorare", [tenants.length]) : tr("Caricamento…")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-gradient ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {tr("Nuova azienda")}
        </button>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-900">{notice}</div>}
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">{tr(error)}</div>}

      {tenants && tenants.length === 0 && (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessuna azienda: creane una per attivare il primo account.")}</div>
      )}
      {tenants && tenants.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                <th className="px-3 py-2.5 pl-4">{tr("Azienda")}</th>
                <th className="px-3 py-2.5">{tr("Piano")}</th>
                <th className="px-3 py-2.5">{tr("Moduli")}</th>
                <th className="px-3 py-2.5">{tr("Creata il")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Utenti")}</th>
                <th className="w-[110px] px-3 py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-[#f8fafd]">
                  <td className="px-3 py-[9px] pl-4">
                    <span className="text-[13.5px] font-semibold">{t.name}</span>
                    {t.id === current && <span className="ml-2 text-[11.5px] text-brand">{tr("in uso")}</span>}
                  </td>
                  <td className="px-3 py-[9px]">
                    <Badge tone={t.plan === "free" ? "grey" : "blue"}>{t.plan === "free" ? "Free" : t.plan}</Badge>
                  </td>
                  <td className="px-3 py-[7px]">
                    <div className="flex flex-wrap gap-1">
                      {modules.map((m) => {
                        const own = modulesOf(t.id);
                        const on = own.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onModules(t.id, on ? own.filter((x) => x !== m.id) : [...own, m.id])}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold transition-colors ${
                              on ? "border-brand bg-brand-soft text-brand" : "border-[#dfe3ea] text-faint hover:border-[#c6ccd6] hover:text-muted"
                            }`}
                          >
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                            {tr(m.label)}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-[9px] text-[12.5px] text-muted">{new Date(t.created_at).toLocaleDateString(localeTag())}</td>
                  <td className="px-3 py-[9px] text-right text-[12.5px] font-semibold tabular-nums">{t.users}</td>
                  <td className="px-3 py-[5px] pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => void switchTenant(t.id)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft"
                    >
                      <LogIn className="h-3.5 w-3.5" /> {tr("Entra")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <NewTenantModal
          onClose={() => setCreating(false)}
          onCreated={(t, warning) => {
            setCreating(false);
            setNotice(warning ? tr(TENANT_ERRORS[warning] ?? TENANT_ERRORS.send) : tr("{0} creata: invito inviato all'amministratore.", [t.name]));
            void load();
          }}
        />
      )}
    </div>
  );
}

function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: TenantDTO, warning?: string) => void }) {
  const [form, setForm] = useState({ name: "", firstName: "", lastName: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { tenant?: TenantDTO; warning?: string; error?: string };
    setBusy(false);
    if (r?.ok && body.tenant) onCreated(body.tenant, body.warning);
    else setError(TENANT_ERRORS[body?.error ?? "config"] ?? TENANT_ERRORS.config);
  };

  return (
    <Modal
      title="Nuova azienda"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton disabled={busy} onClick={() => void submit()}>
            {tr("Crea e invita")}
          </PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <Field label="Nome azienda">
          <input autoFocus className={inputCls} value={form.name} onChange={set("name")} placeholder={tr("es. Rossi Assicurazioni S.p.A.")} />
        </Field>
        <p className="flex items-center gap-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <Building2 className="h-3.5 w-3.5" /> {tr("Primo amministratore")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nome">
            <input className={inputCls} value={form.firstName} onChange={set("firstName")} />
          </Field>
          <Field label="Cognome">
            <input className={inputCls} value={form.lastName} onChange={set("lastName")} />
          </Field>
        </div>
        <Field label="Email">
          <input type="email" className={inputCls} value={form.email} onChange={set("email")} />
        </Field>
        <p className="text-[12px] text-muted">{tr("Riceve l'email con il codice di registrazione e può invitare i colleghi.")}</p>
        {error && <p className="text-[12px] font-semibold text-red-600">{tr(error)}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Shown to staff above every page of a multi-tenant app: which company they are working on. */
export function TenantBar({ name }: { name?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#d8e6fb] bg-brand-soft/60 px-3 py-1.5 text-[12.5px] print:hidden">
      <Building2 className="h-4 w-4 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate">
        {tr("Stai lavorando su")} <span className="font-semibold">{name}</span>
      </span>
      <button
        type="button"
        onClick={() => void switchTenant("")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-brand hover:bg-white"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" /> {tr("Cambia azienda")}
      </button>
    </div>
  );
}
