"use client";

import { useOrg } from "@spark/core";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, ChevronDown, FolderOpen, RotateCcw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { fullName, type User } from "@spark/core";
import { BASES, baseValue, bonusFor, emptyScenario, forecastScheda, sliderRange, type ForecastBase, type ForecastScenario } from "../lib/forecast";
import {
  YEARS,
  catalogById,
  cycleLabel,
  cycleYear,
  hasActuals,
  payoutFor,
  schedaScore,
  type ObjectiveDef,
  fromDay,
  levelsText,
  toDay,
  typeOf,
} from "../lib/mbo";
import { useMbo } from "../store";
import { BUCKETS, ChartCard, Histogram } from "./DashboardMbo";
import { fmt } from "./SchedaEditor";
import { StatusPill } from "./SchedeTable";
import { FilterMenu, GhostButton, Modal, Popover, PrimaryButton, Tooltip } from "@spark/core";
import { localeTag, tr } from "@spark/core";

const CURRENT_KEY = "spark.forecast.current.v1";
const SAVED_KEY = "spark.forecast.saved.v1";
const eur = { format: (n: number) => new Intl.NumberFormat(localeTag(), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) };
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function Forecast() {
  const { companies: COMPANIES } = useOrg();
  const { schede, users, objectives, hydrated, notify, globalGate } = useMbo();
  const [year, setYear] = useState("2026");
  const [company, setCompany] = useState("");
  const [sc, setSc] = useState<ForecastScenario>(emptyScenario);
  const [saved, setSaved] = useState<ForecastScenario[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from storage */
    setSc(load(CURRENT_KEY, emptyScenario()));
    setSaved(load(SAVED_KEY, []));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(sc));
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {}
  }, [sc, saved, loaded]);

  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const people = (ids: string[]) => ids.map((id) => byUser.get(id)).filter((u): u is User => !!u);

  // schede in scope: selected year (+ company), not archived
  const scope = useMemo(
    () =>
      schede.filter(
        (s) =>
          s.status !== "archiviata" &&
          (!year || cycleYear(s.cycle) === Number(year)) &&
          (!company || s.assigneeIds.some((id) => byUser.get(id)?.company === company)),
      ),
    [schede, year, company, byUser],
  );

  // catalog objectives used in scope, as weighted items and as thresholds
  const { weighted, gates } = useMemo(() => {
    const count = new Map<string, number>();
    const gateCount = new Map<string, number>();
    for (const s of scope) {
      for (const it of s.items) if (!it.custom && it.objectiveId) count.set(it.objectiveId, (count.get(it.objectiveId) ?? 0) + 1);
      if (s.threshold) gateCount.set(s.threshold.objectiveId, (gateCount.get(s.threshold.objectiveId) ?? 0) + 1);
    }
    const pick = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([id, n]) => ({ def: catalogById(objectives, id), n }))
        .filter((x): x is { def: ObjectiveDef; n: number } => !!x.def)
        .sort((a, b) => b.n - a.n);
    const globalDef = catalogById(objectives, globalGate.objectiveId);
    const own: { def: ObjectiveDef; n: number; global?: boolean }[] = pick(gateCount).filter((g) => g.def.id !== globalDef?.id);
    return { weighted: pick(count), gates: globalDef ? [{ def: globalDef, n: scope.length, global: true }, ...own] : own };
  }, [scope, objectives, globalGate]);

  const results = useMemo(
    () => scope.map((s) => forecastScheda(s, objectives, sc, globalGate)).sort((a, b) => b.score - a.score),
    [scope, objectives, sc, globalGate],
  );

  const kpi = useMemo(() => {
    const scores = results.map((r) => r.score);
    const actualScores = scope.filter(hasActuals).map((s) => schedaScore(objectives, s, globalGate));
    const bonusAtTarget = results.reduce((a, r) => a + bonusFor(sc, r.scheda.id) * r.scheda.assigneeIds.length, 0);
    const bonusForecast = results.reduce((a, r) => a + (bonusFor(sc, r.scheda.id) * r.scheda.assigneeIds.length * r.score) / 100, 0);
    return {
      avg: avg(scores),
      actualAvg: actualScores.length ? avg(actualScores) : null,
      atTarget: scores.filter((v) => v >= 100).length,
      zeroed: results.filter((r) => !r.gateOk).length,
      bonusAtTarget,
      bonusForecast,
      histogram: BUCKETS.map((b) => ({ label: b.label, value: scores.filter(b.test).length })),
    };
  }, [results, scope, objectives, sc, globalGate]);

  const setEstimate = (id: string, value: number | undefined) =>
    setSc((s) => {
      const estimates = { ...s.estimates };
      if (value == null || Number.isNaN(value)) delete estimates[id];
      else estimates[id] = value;
      return { ...s, estimates };
    });

  const setBase = (base: ForecastBase) => setSc((s) => ({ ...s, base, estimates: {} }));

  const saveAs = (name: string) => {
    const snap: ForecastScenario = { ...sc, id: `fc${Date.now().toString(36)}`, name, savedAt: new Date().toISOString() };
    setSaved((list) => [snap, ...list]);
    setSc((s) => ({ ...s, name }));
    notify(tr("Scenario “{0}” salvato", [name]));
  };

  if (!hydrated || !loaded) return <div className="card h-64 animate-pulse" />;

  const explicitCount = Object.keys(sc.estimates).length;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{tr("Forecast MBO")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("Stima il risultato degli obiettivi e guarda l'effetto su payout e costo dei bonus. Le stime non modificano le schede.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">{tr("Scenario:")}{" "}<span className="font-semibold text-ink">{tr(sc.name)}</span>
          </span>
          <Popover
            trigger={(toggle, open) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="flex items-center gap-1.5 rounded-lg border border-[#dfe3ea] bg-white px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-canvas"
              >
                <FolderOpen className="h-3.5 w-3.5" />{" "}{tr("Scenari salvati ({0})", [saved.length])}</button>
            )}
          >
            {saved.length === 0 ? (
              <p className="px-2 py-2 text-[12.5px] text-muted">{tr("Nessuno scenario salvato.")}</p>
            ) : (
              <ul className="max-h-72 w-[300px] overflow-y-auto">
                {saved.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSc({ ...x, id: "current" });
                        notify(tr("Scenario “{0}” caricato", [x.name]));
                      }}
                    >
                      <span className="block truncate text-[13px] font-semibold">{x.name}</span>
                      <span className="block text-[11px] text-muted">{tr("{0} · {1} stime", [tr(BASES.find((b) => b.value === x.base)?.label), Object.keys(x.estimates).length])}{x.savedAt && ` · ${new Date(x.savedAt).toLocaleDateString(localeTag(), { day: "2-digit", month: "short" })}`}
                      </span>
                    </button>
                    <Tooltip label={tr("Elimina")}>
                      <button
                        type="button"
                        aria-label={tr("Elimina {0}", [x.name])}
                        onClick={() => setSaved((list) => list.filter((y) => y.id !== x.id))}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11.5px] font-extrabold uppercase tracking-tight text-white"
          >
            <Save className="h-3.5 w-3.5" />{" "}{tr("Salva scenario")}</button>
        </div>
      </div>

      {/* scope + base */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<CalendarDays className="h-3.5 w-3.5 text-[#7d8698]" />}
          label={tr("Anno")}
          activeLabel={tr("Anno")}
          value={year}
          onChange={setYear}
          options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <FilterMenu
          icon={<Building2 className="h-3.5 w-3.5 text-[#7d8698]" />}
          label={tr("Filtra per società")}
          activeLabel={tr("Società")}
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">{tr("Punto di partenza")}</span>
          <div className="inline-flex rounded-lg bg-white p-1 shadow-[0_1px_2px_rgb(16_24_40/0.06)]" role="radiogroup" aria-label={tr("Punto di partenza")}>
            {BASES.map((b) => (
              <Tooltip key={b.value} label={tr(b.hint)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={sc.base === b.value}
                  onClick={() => setBase(b.value)}
                  className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    sc.base === b.value ? "bg-brand text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {tr(b.label)}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {scope.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[14px] font-semibold">{tr("Nessuna scheda nel periodo selezionato")}</p>
          <p className="mt-1 text-[12.5px] text-muted">{tr("Cambia anno o società.")}</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label={tr("Payout medio stimato")}
              value={`${kpi.avg}%`}
              sub={
                kpi.actualAvg == null
                  ? tr("{0} schede", [scope.length])
                  : tr("Consuntivo attuale {0}% ({1}{2} pt)", [kpi.actualAvg, kpi.avg - kpi.actualAvg >= 0 ? "+" : "", kpi.avg - kpi.actualAvg])
              }
            />
            <Stat
              label={tr("Costo bonus stimato")}
              value={eur.format(kpi.bonusForecast)}
              sub={tr("{0}% del budget a target ({1})", [kpi.bonusAtTarget ? Math.round((kpi.bonusForecast / kpi.bonusAtTarget) * 100) : 0, eur.format(kpi.bonusAtTarget)])}
            />
            <Stat label={tr("Schede a target o oltre")} value={String(kpi.atTarget)} sub={tr("su {0} schede (payout ≥ 100%)", [scope.length])} />
            <Stat label={tr("Azzerate dalla soglia")} value={String(kpi.zeroed)} sub={kpi.zeroed ? tr("obiettivo soglia non raggiunto") : tr("nessuna scheda azzerata")} />
          </div>

          <div className="space-y-4">
            {/* estimates */}
            <section className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-bold">{tr("Stima dei risultati")}</h2>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {explicitCount
                      ? tr("{0} obiettivi stimati a mano, gli altri dal punto di partenza.", [explicitCount])
                      : tr("Muovi i cursori per stimare il risultato di ogni obiettivo.")}
                  </p>
                </div>
                {explicitCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSc((s) => ({ ...s, estimates: {} }))}
                    className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />{" "}{tr("Azzera")}</button>
                )}
              </div>

              <div className="mt-4 space-y-5">
                {gates.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />{" "}{tr("Obiettivi soglia")}</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {gates.map(({ def, n, ...g }) => (
                        <EstimateRow key={def.id} def={def} n={n} gate global={"global" in g} sc={sc} onChange={(v) => setEstimate(def.id, v)} />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Obiettivi delle schede")}</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weighted.map(({ def, n }) => (
                      <EstimateRow key={def.id} def={def} n={n} sc={sc} onChange={(v) => setEstimate(def.id, v)} />
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-faint">{tr("Gli obiettivi creati dentro una singola scheda seguono il punto di partenza. Il payout usa i livelli di ogni scheda, anche se personalizzati.")}</p>
                </div>
              </div>
            </section>

            {/* results */}
            <div className="min-w-0 space-y-4">
              <ChartCard title={tr("Distribuzione del payout stimato")} note={tr("Numero di schede per fascia di payout")}>
                <Histogram cols={kpi.histogram} />
              </ChartCard>

              <section className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
                  <div>
                    <h2 className="text-[13px] font-bold">{tr("Payout per scheda")}</h2>
                    <p className="mt-0.5 text-[11.5px] text-muted">{tr("Bonus a target per assegnatario: modificabile per ogni scheda.")}</p>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-muted">{tr("Bonus a target predefinito")}<span className="relative">
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={sc.bonusTarget}
                        onChange={(e) => setSc((s) => ({ ...s, bonusTarget: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-[110px] rounded-lg border border-[#dfe3ea] py-1.5 pl-2.5 pr-6 text-right text-[13px] font-semibold tabular-nums text-ink outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px]">€</span>
                    </span>
                  </label>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-y border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                        <th className="px-5 py-2.5">{tr("Scheda")}</th>
                        <th className="px-3 py-2.5">{tr("Payout stimato")}</th>
                        <th className="px-3 py-2.5 text-right">{tr("Bonus a target")}</th>
                        <th className="px-5 py-2.5 text-right">{tr("Bonus stimato")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => {
                        const ppl = people(r.scheda.assigneeIds);
                        const bonus = bonusFor(sc, r.scheda.id);
                        const isOpen = expanded === r.scheda.id;
                        return (
                          <Fragment key={r.scheda.id}>
                            <tr className="border-b border-line hover:bg-[#f8fafd]">
                              <td className="px-5 py-2">
                                <button type="button" onClick={() => setExpanded(isOpen ? null : r.scheda.id)} className="flex items-center gap-2 text-left">
                                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                  <span className="min-w-0">
                                    <span className="block max-w-[380px] truncate text-[13px] font-semibold">{r.scheda.name}</span>
                                    <span className="block max-w-[300px] truncate text-[11.5px] text-muted">
                                      {ppl[0] ? fullName(ppl[0]) : "—"}
                                      {ppl.length > 1 && ` +${ppl.length - 1}`} · {tr(cycleLabel(r.scheda.cycle))}
                                    </span>
                                  </span>
                                </button>
                              </td>
                              <td className="px-3">
                                <div className="flex items-center gap-2">
                                  <span className="relative h-2 w-24">
                                    <span
                                      className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[#1673e6]"
                                      style={{ width: `${Math.min(r.score, 150) / 1.5}%` }}
                                    />
                                    <span className="absolute -inset-y-1 border-l border-dashed border-[#9aa2b1]" style={{ left: `${100 / 1.5}%` }} />
                                  </span>
                                  <span className="w-10 text-[12.5px] font-semibold tabular-nums">{r.score}%</span>
                                  {!r.gateOk && (
                                    <span className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-[1px] text-[10.5px] font-bold text-amber-700">
                                      <ShieldAlert className="h-3 w-3" />{" "}{tr("Soglia")}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={500}
                                  aria-label={tr("Bonus a target per {0}", [r.scheda.name])}
                                  value={bonus}
                                  onChange={(e) =>
                                    setSc((s) => ({ ...s, bonusBySchede: { ...s.bonusBySchede, [r.scheda.id]: Math.max(0, Number(e.target.value) || 0) } }))
                                  }
                                  className={`w-[96px] rounded-md border px-2 py-1 text-right text-[12.5px] tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 ${
                                    sc.bonusBySchede[r.scheda.id] != null ? "border-brand/40 font-semibold" : "border-transparent bg-canvas"
                                  }`}
                                />
                                {ppl.length > 1 && <span className="ml-1 text-[11px] text-muted">×{ppl.length}</span>}
                              </td>
                              <td className="px-5 text-right text-[13px] font-semibold tabular-nums">{eur.format((bonus * ppl.length * r.score) / 100)}</td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b border-line bg-[#fafbfc]">
                                <td colSpan={4} className="px-5 py-3">
                                  <div className="mb-2 flex items-center gap-2">
                                    <StatusPill status={r.scheda.status} />
                                    <Link href={`/mbo/schede/${r.scheda.id}`} className="text-[12px] font-semibold text-brand hover:underline">{tr("Apri scheda")}</Link>
                                  </div>
                                  <table className="w-full text-left text-[12.5px]">
                                    <thead>
                                      <tr className="text-[10.5px] font-bold uppercase text-[#9aa2b1]">
                                        <th className="py-1">{tr("Obiettivo")}</th>
                                        <th className="w-14 py-1 text-right">{tr("Peso")}</th>
                                        <th className="w-28 py-1 text-right">{tr("Risultato")}</th>
                                        <th className="w-20 py-1 text-right">{tr("Payout")}</th>
                                        <th className="w-24 py-1 text-right">{tr("Contributo")}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.items.map((it) => (
                                        <tr key={it.id} className="border-t border-line">
                                          <td className="py-1.5">
                                            {it.name}
                                            {it.estimated && <span className="ml-1.5 text-[10.5px] font-bold text-brand">{tr("stimato")}</span>}
                                          </td>
                                          <td className="py-1.5 text-right tabular-nums text-muted">{it.weight}%</td>
                                          <td className="py-1.5 text-right tabular-nums">{fmt(it.value)}</td>
                                          <td className="py-1.5 text-right tabular-nums">{it.payout}%</td>
                                          <td className="py-1.5 text-right font-semibold tabular-nums">
                                            {r.gateOk ? tr("{0} pt", [Math.round((it.weight * it.payout) / 100)]) : tr("0 pt")}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-line text-[13px] font-bold">
                        <td className="px-5 py-3">{tr("Totale ({0} schede)", [scope.length])}</td>
                        <td className="px-3 tabular-nums">{tr("{0}% medio", [kpi.avg])}</td>
                        <td className="px-3 text-right tabular-nums">{eur.format(kpi.bonusAtTarget)}</td>
                        <td className="px-5 text-right tabular-nums">{eur.format(kpi.bonusForecast)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {saving && <SaveDialog defaultName={sc.name === "Scenario corrente" ? "" : sc.name} onClose={() => setSaving(false)} onSave={saveAs} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-[24px] font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-muted">{sub}</p>
    </div>
  );
}

/** One objective: number input + slider for the estimated result, with the resulting payout. */
function EstimateRow({
  def,
  n,
  gate,
  global,
  sc,
  onChange,
}: {
  def: ObjectiveDef;
  n: number;
  gate?: boolean;
  global?: boolean;
  sc: ForecastScenario;
  onChange: (v: number | undefined) => void;
}) {
  const explicit = sc.estimates[def.id];
  const value = explicit ?? baseValue(def, sc.base);
  const payout = payoutFor(def, value);
  const { min, max, step } = sliderRange(def);
  const isDate = typeOf(def) === "data";
  const met = payout > 0;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${explicit != null ? "border-brand/40 bg-brand-soft/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold" title={def.name}>
            {def.name}
          </p>
          <p className="text-[11px] text-muted">
            {global ? tr("Soglia globale · tutte le schede") : `${n} ${n === 1 ? tr("scheda") : tr("schede")}`} · {levelsText(def)}
          </p>
        </div>
        {gate ? (
          <span
            className={`shrink-0 rounded-full px-2 py-[2px] text-[11px] font-bold ${met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {met ? tr("Raggiunta") : tr("Non raggiunta")}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[#eef1f5] px-2 py-[2px] text-[11px] font-bold tabular-nums text-ink">{payout}%</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={tr("Risultato stimato {0}", [def.name])}
          // dates: earlier is better, so the slider grows towards the earliest date
          style={isDate ? { direction: "rtl" } : undefined}
          className="h-1.5 flex-1 cursor-pointer accent-[#1673e6]"
        />
        {isDate ? (
          <input
            type="date"
            value={Number.isFinite(value) ? fromDay(value) : ""}
            onChange={(e) => onChange(e.target.value ? toDay(e.target.value) : undefined)}
            aria-label={tr("Data stimata {0}", [def.name])}
            className="w-[132px] rounded-md border border-[#dfe3ea] bg-white px-2 py-1 text-[12.5px] font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        ) : (
          <span className="relative">
            <input
              type="number"
              step={step}
              value={Number.isFinite(value) ? value : ""}
              onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
              aria-label={tr("Valore stimato {0}", [def.name])}
              className="w-[92px] rounded-md border border-[#dfe3ea] bg-white py-1 pl-2 pr-9 text-right text-[12.5px] font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 max-w-[32px] -translate-y-1/2 truncate text-[10.5px] text-muted">{def.unit}</span>
          </span>
        )}
        {explicit != null && (
          <Tooltip label={tr("Torna al punto di partenza")}>
            <button
              type="button"
              aria-label={tr("Torna al punto di partenza")}
              onClick={() => onChange(undefined)}
              className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-white hover:text-ink"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function SaveDialog({ defaultName, onClose, onSave }: { defaultName: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(defaultName);
  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };
  return (
    <Modal
      title={tr("Salva scenario")}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={submit} disabled={!name.trim()}>{tr("Salva")}</PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Nome scenario")}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr("es. Budget 2026 · EBITDA prudente")}
            className="w-full rounded-lg border border-[#dfe3ea] px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </label>
      </form>
    </Modal>
  );
}
