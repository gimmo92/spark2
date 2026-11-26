"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Switch } from "../ui/ui";
import { tr } from "../i18n/i18n";
import { useData } from "../data/DataProvider";
import { useCore } from "../shell/SparkProvider";
import { TenantsPage } from "../people/TenantsPage";
import { PANEL_ERRORS, type SparkPanelDTO } from "./panel";

/** Modules a company uses: its own choice (or the default), among those on in the installation. */
const ownModules = (p: SparkPanelDTO, tenant: string) =>
  (p.tenantModules[tenant] ?? p.tenantDefault ?? p.installation).filter((x) => p.installation.includes(x));

/**
 * Spark control panel (route /spark of every app, Spark staff only): modules switched on for the
 * whole installation and, in multi-tenant apps, the companies with their own modules.
 */
export function SparkPanel() {
  const { viewer, setViewerModules } = useData();
  const { notify } = useCore();
  const [panel, setPanel] = useState<SparkPanelDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/spark", { cache: "no-store" }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as SparkPanelDTO & { error?: string };
    if (r?.ok && body.modules) {
      setPanel(body);
      setError(null);
    } else setError(PANEL_ERRORS[body?.error ?? "config"] ?? PANEL_ERRORS.config);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the server
    void load();
  }, [load]);

  const save = async (modules: string[], tenant?: string) => {
    const r = await fetch("/api/spark", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules, tenant }) }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { modules?: string[]; error?: string };
    if (!r?.ok || !body.modules) {
      notify(tr(PANEL_ERRORS[body?.error ?? "config"] ?? PANEL_ERRORS.config));
      return;
    }
    if (!panel) return;
    const next = tenant ? { ...panel, tenantModules: { ...panel.tenantModules, [tenant]: body.modules } } : { ...panel, installation: body.modules };
    setPanel(next);
    // this page follows at once: the installation's modules, intersected with the company's when working on one
    const here = viewer?.tenant ? ownModules(next, viewer.tenant) : next.installation;
    setViewerModules(here);
    notify(tr("Moduli salvati: gli utenti li vedono al prossimo caricamento della pagina."));
  };

  if (viewer && !viewer.staff)
    return (
      <div className="card mx-auto mt-6 max-w-md p-8 text-center">
        <Lock className="mx-auto h-6 w-6 text-faint" />
        <p className="mt-3 text-[14px] font-semibold">{tr(PANEL_ERRORS.forbidden)}</p>
      </div>
    );

  const installed = panel ? panel.modules.filter((m) => panel.installation.includes(m.id)) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-[14px] font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand" /> {tr("Pannello Spark")}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted">{tr("Riservato al team Spark: moduli di questa installazione e aziende che la usano.")}</p>
      </div>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">{tr(error)}</div>}

      {panel && (
        <section className="card p-4">
          <p className="text-[13px] font-semibold">{tr("Moduli dell'installazione")}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {panel.multiTenant
              ? tr("Moduli disponibili in questa app. Ogni azienda usa solo quelli attivi qui e scelti per lei qui sotto.")
              : tr("Un modulo spento compare bloccato nel menu e i suoi dati non sono più accessibili (restano salvati).")}
          </p>
          <ul className="mt-2 divide-y divide-line">
            {panel.modules.map((m) => {
              const on = panel.installation.includes(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-[13px] font-medium">{tr(m.label)}</span>
                  <Switch
                    checked={on}
                    label={tr(m.label)}
                    onChange={(v) => void save(v ? [...panel.installation, m.id] : panel.installation.filter((x) => x !== m.id))}
                  />
                </li>
              );
            })}
            {!panel.modules.length && <li className="py-2 text-[12.5px] text-muted">{tr("Nessun modulo in questa app.")}</li>}
          </ul>
        </section>
      )}

      {panel?.multiTenant && (
        <TenantsPage
          modules={installed}
          modulesOf={(id) => ownModules(panel, id)}
          onModules={(id, list) => void save(list, id)}
        />
      )}
    </div>
  );
}
