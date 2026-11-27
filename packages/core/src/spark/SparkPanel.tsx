"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Switch } from "../ui/ui";
import { tr } from "../i18n/i18n";
import { moduleFeatures } from "../config";
import { useData } from "../data/DataProvider";
import { useCore, useSparkConfig } from "../shell/SparkProvider";
import { TenantsPage } from "../people/TenantsPage";
import { PANEL_ERRORS, type SparkPanelDTO } from "./panel";
import { FeatureToggles } from "./FeatureToggles";

/** Modules a company uses: its own choice (or the default), among those on in the installation. */
const ownModules = (p: SparkPanelDTO, tenant: string) =>
  (p.tenantModules[tenant] ?? p.tenantDefault ?? p.installation).filter((x) => p.installation.includes(x));

/**
 * Spark control panel (route /spark of every app, Spark staff only): modules and their menu entries
 * switched on for the whole installation and, in multi-tenant apps, the companies with their own
 * modules and entries. An entry switched off is shown locked (the data of its module stays served).
 */
export function SparkPanel() {
  const { viewer, setViewerModules } = useData();
  const { notify } = useCore();
  const config = useSparkConfig();
  const features = moduleFeatures(config);
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

  const save = async (modules: string[], hidden: string[], tenant?: string) => {
    const r = await fetch("/api/spark", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules, hidden, tenant }) }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { modules?: string[]; hidden?: string[]; error?: string };
    if (!r?.ok || !body.modules) {
      notify(tr(PANEL_ERRORS[body?.error ?? "config"] ?? PANEL_ERRORS.config));
      return;
    }
    if (!panel) return;
    const next = tenant
      ? { ...panel, tenantModules: { ...panel.tenantModules, [tenant]: body.modules }, tenantHidden: { ...panel.tenantHidden, [tenant]: body.hidden ?? [] } }
      : { ...panel, installation: body.modules, installationHidden: body.hidden ?? [] };
    setPanel(next);
    // this page follows at once: the installation's choices, plus the company's when working on one
    const t = viewer?.tenant;
    setViewerModules(t ? ownModules(next, t) : next.installation, [...new Set([...next.installationHidden, ...(t ? (next.tenantHidden[t] ?? []) : [])])]);
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
      <h1 className="flex items-center gap-2 text-[14px] font-semibold">
        <ShieldCheck className="h-4 w-4 text-brand" /> {tr("Pannello Spark")}
      </h1>
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">{tr(error)}</div>}

      {panel && (
        <section className="card p-4">
          <p className="text-[13px] font-semibold">{tr("Moduli dell'installazione")}</p>
          <ul className="mt-2 divide-y divide-line">
            {panel.modules.map((m) => {
              const on = panel.installation.includes(m.id);
              const own = features.filter((f) => f.module === m.id);
              return (
                <li key={m.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[13px] font-medium">{tr(m.label)}</span>
                    <Switch
                      checked={on}
                      label={tr(m.label)}
                      onChange={(v) => void save(v ? [...panel.installation, m.id] : panel.installation.filter((x) => x !== m.id), panel.installationHidden)}
                    />
                  </div>
                  {on && own.length > 0 && (
                    <div className="mt-1.5">
                      <FeatureToggles features={own} hidden={panel.installationHidden} onChange={(hidden) => void save(panel.installation, hidden)} />
                    </div>
                  )}
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
          onModules={(id, list) => void save(list, panel.tenantHidden[id] ?? [], id)}
          features={features.filter((f) => panel.installation.includes(f.module) && !panel.installationHidden.includes(f.href))}
          hiddenOf={(id) => panel.tenantHidden[id] ?? []}
          onHidden={(id, hidden) => void save(ownModules(panel, id), hidden, id)}
        />
      )}
    </div>
  );
}
