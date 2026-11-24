"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Copy,
  Hash,
  ListChecks,
  Percent,
  Plus,
  Sparkles,
  Star,
  ToggleRight,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { fullName, useAccess } from "@spark/core";
import {
  CYCLES,
  OBJECTIVE_TYPES,
  SCHEDA_STATUSES,
  ACTIVITY_KINDS,
  activityWeight,
  activityDef,
  activityDefaultLevels,
  activityKind,
  catalogById,
  evenWeights,
  itemDef,
  formatValue,
  fromDay,
  levelsText,
  toDay,
  typeDefaults,
  typeOf,
  typeRange,
  type Activity,
  type ActivityKind,
  type CalcMode,
  type ObjectiveType,
  type Level,
  type Preset,
  type ObjectiveDef,
  type Scheda,
  type SchedaItem,
  type SchedaStatus,
} from "../lib/mbo";
import { useMbo, useMboOptions } from "../store";
import { MultiSelect } from "@spark/core";
import { GhostButton, PrimaryButton, Switch, inputCls } from "@spark/core";
import { localeTag, tr } from "@spark/core";

const collator = new Intl.Collator("it", { sensitivity: "base" });
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const fmt = (n: number) => n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
export const levelsSummary = (d: ObjectiveDef) => levelsText(d, "  ·  ");

/** Route entry: /mbo/schede/[id] (edit) or /mbo/schede/nuova (create). */
export function SchedaEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { schede, hydrated, canCreateScheda, canEditScheda } = useMbo();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return canCreateScheda ? <SchedaEditor key="new" /> : <NoEdit />;
  const scheda = schede.find((s) => s.id === params.id);
  if (scheda && !canEditScheda(scheda)) return <NoEdit />;
  if (!scheda)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">{tr("Scheda non trovata")}</p>
        <Link href="/mbo/schede" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">{tr("Torna alle schede obiettivo")}</Link>
      </div>
    );
  return <SchedaEditor key={scheda.id} scheda={scheda} />;
}

function NoEdit() {
  return (
    <div className="card p-10 text-center">
      <p className="text-[14px] font-semibold">{tr("Non puoi modificare questa scheda")}</p>
      <p className="mt-1 text-[12.5px] text-muted">{tr("Il tuo livello di accesso non lo prevede. Puoi consultarla dalla lista.")}</p>
      <Link href="/mbo/schede" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">{tr("Torna alle schede obiettivo")}</Link>
    </div>
  );
}

function SchedaEditor({ scheda }: { scheda?: Scheda }) {
  const router = useRouter();
  const { users, addScheda, updateScheda, notify, objectives, mboSettings, catalogItems } = useMbo();
  const { allowed } = useAccess();
  const globalDef = catalogById(objectives, mboSettings.globalThresholdId);

  const [name, setName] = useState(scheda?.name ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(scheda?.assigneeIds ?? []);
  const [cycle, setCycle] = useState(scheda?.cycle ?? "2026");
  const [status, setStatus] = useState<SchedaStatus>(scheda?.status ?? "bozza");
  const [items, setItems] = useState<SchedaItem[]>(scheda?.items ?? []);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [thresholdOn, setThresholdOn] = useState(!!scheda?.threshold);
  const [thresholdId, setThresholdId] = useState(scheda?.threshold?.objectiveId ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const userOptions = useMemo(
    () =>
      users
        .filter((u) => u.status === "attivo" || assigneeIds.includes(u.id))
        .sort((a, b) => collator.compare(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`))
        .map((u) => ({
          value: u.id,
          label: fullName(u),
          hint: `${u.role}${u.team ? ` · ${u.team}` : ""}`,
        })),
    [users, assigneeIds],
  );
  const usedIds = new Set([...items.map((i) => i.objectiveId), thresholdId]);
  const catalogOptions = objectives
    .filter((o) => !o.archived || usedIds.has(o.id))
    .map((o) => ({
      value: o.id,
      label: o.name,
      hint: `${o.calc === "lineare" ? tr("Lineare") : tr("A scaglioni")} · ${levelsSummary(o)}`,
    }));

  const catalogIds = items.filter((i) => i.objectiveId && !i.custom).map((i) => i.objectiveId!);
  const totalWeight = items.reduce((a, i) => a + (Number(i.weight) || 0), 0);

  const setCatalog = (ids: string[]) => {
    setItems((prev) => {
      const kept = prev.filter((i) => i.custom || ids.includes(i.objectiveId!));
      const added = ids.filter((id) => !prev.some((i) => !i.custom && i.objectiveId === id)).map((id) => ({ id: uid("it"), objectiveId: id, weight: 0 }));
      return [...kept, ...added];
    });
  };
  const updateItem = (id: string, patch: Partial<SchedaItem>) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const updateCustom = (id: string, patch: Partial<ObjectiveDef>) =>
    setItems((p) => p.map((i) => (i.id === id && i.custom ? { ...i, custom: { ...i.custom, ...patch } } : i)));

  const addCustom = () => {
    const id = uid("it");
    setItems((p) => [
      ...p,
      {
        id,
        weight: 0,
        custom: {
          id: uid("cu"),
          name: "",
          type: "quantitativo",
          ...typeDefaults("quantitativo"),
        },
      },
    ]);
    setExpanded(id);
  };
  const personalize = (it: SchedaItem) => {
    const def = itemDef(objectives, it);
    if (!def) return;
    updateItem(it.id, {
      objectiveId: undefined,
      levels: undefined,
      custom: {
        ...def,
        id: uid("cu"),
        levels: def.levels.map((l) => ({ ...l })),
      },
    });
    setExpanded(it.id);
  };

  // validation
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Inserisci il nome della scheda";
  if (!assigneeIds.length) errors.assignees = "Assegna la scheda ad almeno un utente";
  if (!items.length) errors.items = "Aggiungi almeno un obiettivo";
  else if (totalWeight !== 100) errors.items = tr("La somma dei pesi deve essere 100% (ora {0}%)", [totalWeight]);
  if (thresholdOn && !thresholdId) errors.threshold = "Seleziona l'obiettivo soglia";
  items.forEach((it) => {
    const e = it.custom ? customError(it.custom) : null;
    if (e) errors[it.id] = e;
  });
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) {
      const firstCustom = items.find((i) => errors[i.id]);
      if (firstCustom) setExpanded(firstCustom.id);
      notify(tr("Controlla i campi evidenziati"));
      return;
    }
    const prevThreshold = scheda?.threshold?.objectiveId === thresholdId ? scheda?.threshold : undefined;
    const data = {
      name: name.trim(),
      assigneeIds,
      cycle,
      status,
      // objectives created here go to the catalog like any other (needs the catalog permission)
      items: allowed("mbo.catalog.manage") ? catalogItems(items, cycle) : items,
      threshold: thresholdOn ? { objectiveId: thresholdId, actual: prevThreshold?.actual } : undefined,
    };
    if (scheda) {
      updateScheda(scheda.id, data);
      notify(tr("Scheda salvata"));
    } else {
      addScheda(data);
      notify(tr("Scheda creata"));
    }
    router.push("/mbo/schede");
  };

  const thresholdDef = catalogById(objectives, thresholdId);

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mbo/schede" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />{" "}{tr("Schede obiettivo")}</Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{scheda ? tr("Modifica scheda") : tr("Nuova scheda obiettivo")}</h1>
          {scheda && <p className="mt-0.5 text-[12.5px] text-muted">{scheda.name}</p>}
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => router.push("/mbo/schede")}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={save}>{scheda ? tr("Salva scheda") : tr("Crea scheda")}</PrimaryButton>
        </div>
      </div>

      {/* 1. General info */}
      <section className="card p-5">
        <SectionTitle n={1} title={tr("Informazioni generali")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Block label={tr("Nome scheda")} error={err("name")} className="sm:col-span-2">
            <input
              className={`${inputCls} ${err("name") ? "border-red-300" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("es. MBO 2026 · Area Manager Nord")}
            />
          </Block>
          <Block
            label={tr("Assegnatari")}
            hint={assigneeIds.length > 1 ? tr("{0} utenti ricevono la stessa scheda", [assigneeIds.length]) : tr("Uno o più utenti")}
            error={err("assignees")}
            className="sm:col-span-2"
          >
            <MultiSelect
              options={userOptions}
              value={assigneeIds}
              onChange={setAssigneeIds}
              placeholder={tr("Seleziona uno o più utenti")}
              searchPlaceholder={tr("Cerca per nome, ruolo o team…")}
              invalid={!!err("assignees")}
            />
          </Block>
          <Block label={tr("Ciclo di riferimento")}>
            <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {tr(c.label)}
                </option>
              ))}
            </select>
          </Block>
          <Block label={tr("Stato")}>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SchedaStatus)}>
              {SCHEDA_STATUSES.filter((s) => s.value !== "archiviata").map((s) => (
                <option key={s.value} value={s.value}>
                  {tr(s.label)}
                </option>
              ))}
            </select>
          </Block>
        </div>

        {/* Advanced options accordion */}
        <div className="mt-5 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[13px] font-bold">{tr("Opzioni avanzate")}</span>
              <span className="block text-[11.5px] text-muted">
                {thresholdOn && thresholdDef ? tr("Obiettivo soglia: {0}", [thresholdDef.name]) : tr("Obiettivo soglia della scheda")}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${advancedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden" inert={!advancedOpen}>
              <div className="border-t border-line px-4 py-4">
                {globalDef && (
                  <p className="mb-4 rounded-lg bg-canvas px-3 py-2 text-[12px] text-muted">{tr("Soglia globale attiva per tutte le schede:")}{" "}<span className="font-semibold text-ink">{globalDef.name}</span>{" "}{tr("(Impostazioni → MBO). Qui puoi aggiungere una soglia che vale solo per questa scheda.")}</p>
                )}
                <label className="flex cursor-pointer items-start gap-3">
                  <Switch checked={thresholdOn} onChange={setThresholdOn} />
                  <span>
                    <span className="block text-[13px] font-semibold">{tr("Imposta un obiettivo soglia per questa scheda")}</span>
                    <span className="block text-[12px] text-muted">{tr("Se l'obiettivo soglia non raggiunge il primo livello target, la scheda non matura alcun payout, indipendentemente dagli altri obiettivi.")}</span>
                  </span>
                </label>
                {thresholdOn && (
                  <div className="mt-3.5 grid gap-3 sm:grid-cols-[1fr_220px]">
                    <Block label={tr("Obiettivo soglia")} error={err("threshold")}>
                      <MultiSelect
                        multiple={false}
                        options={catalogOptions}
                        value={thresholdId ? [thresholdId] : []}
                        onChange={(v) => setThresholdId(v[0] ?? "")}
                        placeholder={tr("Seleziona obiettivo")}
                        searchPlaceholder={tr("Cerca obiettivo…")}
                        invalid={!!err("threshold")}
                      />
                    </Block>
                    {thresholdDef && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
                        <span className="block font-bold">{tr("Soglia di accesso")}</span>{tr("Raggiunta con almeno {0}", [formatValue(thresholdDef, thresholdDef.levels[0].target)])}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Objectives */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle n={2} title={tr("Obiettivi")} />
          <WeightMeter total={totalWeight} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Block label={tr("Seleziona obiettivi")}>
            <MultiSelect
              options={catalogOptions}
              value={catalogIds}
              onChange={setCatalog}
              placeholder={tr("Scegli uno o più obiettivi")}
              searchPlaceholder={tr("Cerca obiettivo…")}
            />
          </Block>
          <button
            type="button"
            onClick={addCustom}
            className="flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand/50 px-3.5 text-[12.5px] font-bold text-brand transition-colors hover:bg-brand-soft"
          >
            <Sparkles className="h-3.5 w-3.5" />{" "}{tr("Crea nuovo obiettivo")}</button>
        </div>

        {err("items") && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> {err("items")}
          </p>
        )}

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">{tr("Nessun obiettivo nella scheda")}</p>
            <p className="mt-0.5 text-[12px] text-muted">{tr("Selezionali dall'elenco oppure creane uno nuovo.")}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((it) => {
              const def = itemDef(objectives, it);
              if (!def) return null;
              const isOpen = expanded === it.id;
              const e = err(it.id);
              return (
                <div key={it.id} className={`rounded-xl border ${e ? "border-red-300" : "border-line"} bg-white`}>
                  <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : it.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{def.name || tr("Obiettivo senza nome")}</span>
                          <span className="shrink-0 text-[11px] text-muted">{def.calc === "lineare" ? tr("Lineare") : tr("A scaglioni")}</span>
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">{levelsSummary(def)}</span>
                      </span>
                    </button>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted">{tr("Peso")}</span>
                      <span className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={it.weight}
                          onChange={(ev) =>
                            updateItem(it.id, {
                              weight: Number(ev.target.value),
                            })
                          }
                          className="w-[72px] rounded-lg border border-[#dfe3ea] py-1.5 pl-2.5 pr-6 text-right text-[13px] font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label={tr("Rimuovi obiettivo")}
                      title={tr("Rimuovi")}
                      onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-line px-3.5 py-3.5">
                      {it.custom ? (
                        <CustomObjectiveEditor def={it.custom} onChange={(p) => updateCustom(it.id, p)} error={e} />
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                          <div>
                            <LevelsReadOnly def={def} />
                            <button
                              type="button"
                              onClick={() => personalize(it)}
                              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
                            >
                              <Copy className="h-3.5 w-3.5" />{" "}{tr("Personalizza per questa scheda")}</button>
                          </div>
                          <PayoutCurve def={def} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <GhostButton onClick={() => router.push("/mbo/schede")}>{tr("Annulla")}</GhostButton>
        <PrimaryButton onClick={save}>{scheda ? tr("Salva scheda") : tr("Crea scheda")}</PrimaryButton>
      </div>
    </div>
  );
}

export function levelsError(levels: Level[], type: ObjectiveType = "quantitativo"): string | null {
  if (!levels.length) return "Aggiungi almeno un livello";
  if (levels.some((l) => !Number.isFinite(l.target))) return type === "data" ? "Inserisci tutte le date" : "Controlla i valori dei livelli";
  const r = typeRange(type);
  if (r && type !== "onoff" && levels.some((l) => l.target < r.min || l.target > r.max))
    return type === "qualitativo_5" ? "I voti devono essere tra 1 e 5" : "I target devono essere tra 0 e 100%";
  if (type === "data") {
    for (let i = 1; i < levels.length; i++) if (!(levels[i].target < levels[i - 1].target)) return "Ogni livello successivo deve avere una data più anticipata";
  } else for (let i = 1; i < levels.length; i++) if (!(levels[i].target > levels[i - 1].target)) return "I livelli target devono essere crescenti";
  if (levels.some((l) => l.payout < 0 || Number.isNaN(l.payout) || Number.isNaN(l.target))) return "Controlla i valori dei livelli";
  return null;
}

export function customError(d: ObjectiveDef): string | null {
  if (!d.name.trim()) return "Inserisci la descrizione dell'obiettivo";
  if (typeOf(d) === "progetto" && !d.activities?.some((a) => a.title.trim())) return "Aggiungi almeno un'attività al progetto";
  if (typeOf(d) === "progetto" && !d.activityLevels && d.activities?.some((a) => a.title.trim() && activityKind(a) === "kpi" && !((a.target ?? 0) > 0)))
    return "Le attività KPI devono avere un target maggiore di 0";
  if (typeOf(d) === "progetto" && d.activityLevels)
    for (const a of d.activities ?? []) {
      if (!a.title.trim()) continue;
      const ad = activityDef(d, a);
      const e = levelsError(ad.levels, typeOf(ad));
      if (e) return `${a.title.trim()}: ${tr(e)}`;
    }
  if (typeOf(d) === "progetto" && d.weightedActivities) {
    const acts = (d.activities ?? []).filter((a) => a.title.trim());
    if (acts.some((a) => !((a.weight ?? 0) > 0))) return "Ogni attività deve avere un peso maggiore di 0";
    const total = acts.reduce((sum, a) => sum + (a.weight ?? 0), 0);
    if (Math.abs(total - 100) > 0.001) return tr("I pesi delle attività devono sommare 100% (ora {0}%)", [total]);
  }
  return typeOf(d) === "progetto" && d.activityLevels ? null : levelsError(d.levels, typeOf(d));
}

/** Icon of each objective type. */
export const TYPE_ICON: Record<ObjectiveType, LucideIcon> = {
  quantitativo: Hash,
  qualitativo_pct: Percent,
  qualitativo_5: Star,
  onoff: ToggleRight,
  progetto: ListChecks,
  data: CalendarDays,
};

/** Small icon buttons for a single choice (objective type, level…). */
export function ChoiceButtons<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon: LucideIcon; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors ${
              on ? "border-brand bg-brand-soft text-brand" : "border-[#dfe3ea] bg-white text-muted hover:border-[#c6ccd6] hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {tr(o.label)}
          </button>
        );
      })}
    </div>
  );
}

const TYPE_OPTIONS = OBJECTIVE_TYPES.map((t) => ({
  ...t,
  icon: TYPE_ICON[t.value],
}));

/** Fields to set when an objective switches to `type`: that type's unit, calc and levels. */
export function typePatch(def: ObjectiveDef, type: ObjectiveType): Partial<ObjectiveDef> {
  return {
    type,
    ...typeDefaults(type),
    activities: type === "progetto" ? (def.activities?.length ? def.activities : [{ id: uid("at"), title: "" }]) : undefined,
    weightedActivities: type === "progetto" ? def.weightedActivities : undefined,
    activityLevels: type === "progetto" ? def.activityLevels : undefined,
  };
}

/** Editable list of a project's activities, optionally with the objective's weight distributed over them. */
function ActivitiesEditor({
  def,
  onChange,
}: {
  def: ObjectiveDef;
  onChange: (p: { activities?: Activity[]; weightedActivities?: boolean; activityLevels?: boolean }) => void;
}) {
  const activities = def.activities ?? [];
  const weighted = !!def.weightedActivities;
  const perActivity = !!def.activityLevels;
  const levelsOption = !!useMboOptions().activityLevels || perActivity;
  const setActs = (a: Activity[]) => onChange({ activities: a });
  const set = (id: string, patch: Partial<Activity>) => setActs(activities.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const spread = (acts: Activity[]) => {
    const w = evenWeights(acts.length);
    return acts.map((a, i) => ({ ...a, weight: w[i] }));
  };
  const unweighted = (acts: Activity[]) => acts.map((a) => ({ ...a, weight: undefined }));
  const total = activities.reduce((s, a) => s + (a.weight ?? 0), 0);
  return (
    <Block label={tr("Attività del progetto")}>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2">
        <span className="text-[12.5px] font-semibold">{tr("Distribuisci il peso sulle attività")}</span>
        <Switch
          checked={weighted}
          label={tr("Distribuisci il peso sulle attività")}
          onChange={(v) =>
            onChange(v ? { weightedActivities: true, activities: spread(activities) } : { weightedActivities: false, activities: unweighted(activities) })
          }
        />
      </div>
      {levelsOption && (
        <div className="-mt-1 mb-2 flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2">
          <span className="text-[12.5px] font-semibold">{tr("Livelli target / payout per attività")}</span>
          <Switch
            checked={perActivity}
            label={tr("Livelli target / payout per attività")}
            onChange={(v) =>
              onChange(
                v
                  ? { activityLevels: true, activities: activities.map((a) => ({ ...a, levels: a.levels?.length ? a.levels : activityDefaultLevels(a) })) }
                  : { activityLevels: false, activities: activities.map((a) => ({ ...a, levels: undefined })) },
              )
            }
          />
        </div>
      )}
      <div className={perActivity ? "space-y-2" : "space-y-1.5"}>
        {activities.map((a, i) => (
          <div key={a.id} className={perActivity ? "rounded-lg border border-line p-2" : ""}>
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted">{i + 1}.</span>
              <input
                className={inputCls}
                value={a.title}
                onChange={(e) => set(a.id, { title: e.target.value })}
                placeholder={i === 0 ? tr("es. Analisi dei requisiti") : tr("Attività")}
              />
              <select
                className={`${inputCls} w-[92px] shrink-0`}
                value={activityKind(a)}
                onChange={(e) => {
                  const kind = e.target.value as ActivityKind;
                  const next: Activity = kind === "kpi" ? { ...a, kind } : { ...a, kind, unit: undefined, target: undefined };
                  set(a.id, perActivity ? { ...next, levels: activityDefaultLevels(next) } : next);
                }}
                aria-label={tr("Misura di {0}", [a.title || tr("attività {0}", [i + 1])])}
              >
                {ACTIVITY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {tr(k.label)}
                  </option>
                ))}
              </select>
              {activityKind(a) === "kpi" && (
                <>
                  {!perActivity && (
                    <input
                      type="number"
                      className={`${inputCls} w-[80px] shrink-0 text-right tabular-nums`}
                      value={a.target ?? ""}
                      placeholder={tr("Target")}
                      onChange={(e) => set(a.id, { target: e.target.value === "" ? undefined : Number(e.target.value) })}
                      aria-label={tr("Target di {0}", [a.title || tr("attività {0}", [i + 1])])}
                    />
                  )}
                  <input
                    className={`${inputCls} w-[64px] shrink-0`}
                    value={a.unit ?? ""}
                    placeholder={tr("Unità")}
                    onChange={(e) => set(a.id, { unit: e.target.value })}
                    aria-label={tr("Unità di {0}", [a.title || tr("attività {0}", [i + 1])])}
                  />
                </>
              )}
              {weighted && (
                <span className="relative w-[76px] shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${inputCls} pr-6 text-right tabular-nums`}
                    value={a.weight ?? ""}
                    onChange={(e) => set(a.id, { weight: e.target.value === "" ? undefined : Number(e.target.value) })}
                    aria-label={tr("Peso di {0}", [a.title || tr("attività {0}", [i + 1])])}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                </span>
              )}
              <button
                type="button"
                aria-label={tr("Rimuovi attività")}
                disabled={activities.length === 1}
                onClick={() => setActs(activities.filter((x) => x.id !== a.id))}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {perActivity && (
              <div className="mt-2 pl-7">
                <LevelsEditor
                  unit={activityDef(def, a).unit}
                  type={activityDef(def, a).type}
                  levels={activityDef(def, a).levels}
                  onChange={(levels) => set(a.id, { levels })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setActs([
              ...activities,
              {
                id: uid("at"),
                title: "",
                ...(weighted ? { weight: 0 } : {}),
                ...(perActivity ? { levels: activityDefaultLevels({ id: "", title: "" }) } : {}),
              },
            ])
          }
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />{" "}{tr("Aggiungi attività")}</button>
        {weighted && (
          <div className="flex items-center gap-3 text-[12px]">
            <button type="button" onClick={() => setActs(spread(activities))} className="font-semibold text-brand hover:underline">{tr("Dividi in parti uguali")}</button>
            <span className={`font-semibold tabular-nums ${Math.abs(total - 100) > 0.001 ? "text-red-600" : "text-muted"}`}>{tr("Totale {0}%", [total])}</span>
          </div>
        )}
      </div>
    </Block>
  );
}

/** `showName = false` when the screen shows the objective's description elsewhere (catalog editor). */
export function CustomObjectiveEditor({
  def,
  onChange,
  error,
  showName = true,
}: {
  def: ObjectiveDef;
  onChange: (p: Partial<ObjectiveDef>) => void;
  error?: string;
  showName?: boolean;
}) {
  const type = typeOf(def);
  const perActivity = type === "progetto" && !!def.activityLevels;
  const presets = !perActivity && (type === "quantitativo" || type === "qualitativo_pct" || type === "progetto");
  return (
    <div className="space-y-3.5">
      <Block label={tr("Tipo di obiettivo")}>
        <ChoiceButtons label={tr("Tipo di obiettivo")} options={TYPE_OPTIONS} value={type} onChange={(t) => t !== type && onChange(typePatch(def, t))} />
      </Block>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div className="space-y-3.5">
          {(showName || type === "quantitativo") && (
            <div className={`grid gap-3 ${showName && type === "quantitativo" ? "sm:grid-cols-[1fr_110px]" : showName ? "" : "sm:grid-cols-[110px]"}`}>
              {showName && (
                <Block label={tr("Descrizione obiettivo")}>
                  <input
                    autoFocus
                    className={inputCls}
                    value={def.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder={tr("es. Lancio nuova linea prodotto")}
                  />
                </Block>
              )}
              {type === "quantitativo" && (
                <Block label={tr("Unità di misura")}>
                  <input className={inputCls} value={def.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="%, €, n." />
                </Block>
              )}
            </div>
          )}

          {type === "progetto" && <ActivitiesEditor def={def} onChange={onChange} />}
          {!perActivity && <LevelsEditor unit={def.unit} type={type} levels={def.levels} onChange={(levels) => onChange({ levels })} />}
          {error && (
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
              <TriangleAlert className="h-3.5 w-3.5" /> {tr(error)}
            </p>
          )}
        </div>
        <div className="space-y-3.5">
          {!perActivity && <PayoutCurve def={def} />}
          {presets && (
            <PresetPicker
              hint=""
              onApply={(pr) =>
                onChange({
                  calc: pr.calc,
                  levels: pr.levels.map((l) => ({ ...l })),
                })
              }
            />
          )}
          {type !== "onoff" && (
            <Block label={tr("Modalità di calcolo")}>
              <div className="inline-flex rounded-lg bg-canvas p-1">
                {(["lineare", "scaglioni"] as CalcMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange({ calc: m })}
                    className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      def.calc === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {m === "lineare" ? tr("Lineare") : tr("A scaglioni")}
                  </button>
                ))}
              </div>
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}

/** Editable table of target → payout levels. */
export function LevelsEditor({
  unit,
  type = "quantitativo",
  levels,
  onChange,
}: {
  unit: string;
  type?: ObjectiveType;
  levels: Level[];
  onChange: (levels: Level[]) => void;
}) {
  const setLevel = (i: number, patch: Partial<Level>) => onChange(levels.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const r = typeRange(type);
  if (type === "onoff")
    return (
      <Block label={tr("Payout se raggiunto")}>
        <span className="relative block w-[110px]">
          <input
            type="number"
            min={0}
            className={`${inputCls} pr-7 text-right font-semibold tabular-nums`}
            value={levels[0]?.payout ?? 100}
            onChange={(e) => onChange([{ target: 1, payout: Number(e.target.value) }])}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
        </span>
      </Block>
    );
  const targetHead =
    type === "qualitativo_5" ? tr("Voto (1-5)") : type === "progetto" ? tr("Attività completate %") : type === "data" ? tr("Entro il") : tr("Target ({0})", [unit || tr("valore")]);
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-[64px_1fr_1fr_28px] gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>{tr("Livello")}</span>
        <span>{targetHead}</span>
        <span>{tr("Payout %")}</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {levels.map((l, i) => (
          <div key={i} className="grid grid-cols-[64px_1fr_1fr_28px] items-center gap-2">
            <span className="text-[12.5px] font-semibold text-muted">
              {i === 0 ? tr("Minimo") : i === levels.length - 1 && levels.length > 1 ? tr("Massimo") : tr("Livello {0}", [i + 1])}
            </span>
            {type === "data" ? (
              <input
                type="date"
                className={inputCls}
                value={Number.isFinite(l.target) ? fromDay(l.target) : ""}
                onChange={(e) =>
                  setLevel(i, {
                    target: e.target.value ? toDay(e.target.value) : NaN,
                  })
                }
              />
            ) : (
              <input
                type="number"
                min={r?.min}
                max={r?.max}
                step={r?.step}
                className={inputCls}
                value={l.target}
                onChange={(e) => setLevel(i, { target: Number(e.target.value) })}
              />
            )}
            <input type="number" min={0} className={inputCls} value={l.payout} onChange={(e) => setLevel(i, { payout: Number(e.target.value) })} />
            <button
              type="button"
              aria-label={tr("Rimuovi livello")}
              disabled={levels.length === 1}
              onClick={() => onChange(levels.filter((_, k) => k !== i))}
              className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const last = levels[levels.length - 1];
          // dates: the next level is a month earlier; other types: a step higher (within the type's range)
          const step = type === "data" ? -30 : type === "qualitativo_5" ? 1 : 10;
          const next = last ? last.target + step : (r?.max ?? 100);
          onChange([
            ...levels,
            {
              target: r ? Math.min(next, r.max) : next,
              payout: last ? last.payout + 25 : 100,
            },
          ]);
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
      >
        <Plus className="h-3.5 w-3.5" />{" "}{tr("Aggiungi livello")}</button>
    </div>
  );
}

/** Dropdown of the target/payout presets defined in Impostazioni → MBO. Applying copies calc mode and levels. */
export function PresetPicker({
  onApply,
  label = "Preset target / payout",
  hint = "Compila livelli e modalità di calcolo",
}: {
  onApply: (p: Preset) => void;
  label?: string;
  hint?: string;
}) {
  const { presets } = useMbo();
  const [value, setValue] = useState("");
  return (
    <Block label={label} hint={presets.length ? hint : undefined}>
      <div className="flex items-center gap-2">
        <select
          className={inputCls}
          value={value}
          onChange={(e) => {
            const pr = presets.find((x) => x.id === e.target.value);
            setValue(e.target.value);
            if (pr) onApply(pr);
          }}
        >
          <option value="">{presets.length ? tr("Scegli un preset…") : tr("Nessun preset definito")}</option>
          {presets.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name} · {pr.calc === "lineare" ? tr("Lineare") : tr("A scaglioni")}
            </option>
          ))}
        </select>
        <Link href="/impostazioni/mbo" className="shrink-0 text-[12px] font-semibold text-brand hover:underline">{tr("Gestisci")}</Link>
      </div>
    </Block>
  );
}

export function LevelsReadOnly({ def }: { def: ObjectiveDef }) {
  if (typeOf(def) === "progetto" && def.activityLevels)
    return (
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="text-[11px] font-bold uppercase tracking-wide text-muted">
            <th className="pb-1.5">{tr("Attività")}</th>
            <th className="pb-1.5">{tr("Peso")}</th>
            <th className="pb-1.5">{tr("Target → payout")}</th>
          </tr>
        </thead>
        <tbody>
          {(def.activities ?? []).map((a) => (
            <tr key={a.id} className="border-t border-line align-top">
              <td className="py-1.5 pr-2">{tr(a.title)}</td>
              <td className="py-1.5 pr-2 font-semibold tabular-nums">{Math.round(activityWeight(def, a) * 10) / 10}%</td>
              <td className="py-1.5 font-semibold tabular-nums">{levelsText(activityDef(def, a))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[11px] font-bold uppercase tracking-wide text-muted">
          <th className="pb-1.5">{tr("Livello")}</th>
          <th className="pb-1.5">{tr("Target")}</th>
          <th className="pb-1.5">{tr("Payout")}</th>
        </tr>
      </thead>
      <tbody>
        {def.levels.map((l, i) => (
          <tr key={i} className="border-t border-line">
            <td className="py-1.5 text-muted">{i === 0 ? tr("Minimo") : i === def.levels.length - 1 ? tr("Massimo") : tr("Livello {0}", [i + 1])}</td>
            <td className="py-1.5 font-semibold tabular-nums">{formatValue(def, l.target)}</td>
            <td className="py-1.5 font-semibold tabular-nums">{l.payout}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small chart of payout % vs actual value, so the calc mode is visible at a glance. */
export function PayoutCurve({ def }: { def: ObjectiveDef }) {
  if (typeOf(def) === "progetto" && def.activityLevels)
    return (
      <div className="rounded-xl bg-canvas p-3 text-[12px] text-muted">{tr("Il payout è la somma dei payout delle attività, ciascuna secondo i suoi livelli e il suo peso.")}</div>
    );
  if (typeOf(def) === "onoff")
    return (
      <div className="rounded-xl bg-canvas p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Payout")}</p>
        <div className="space-y-1.5 text-[12.5px]">
          <p className="flex justify-between">
            <span className="text-muted">{tr("Raggiunto")}</span> <span className="font-bold tabular-nums">{def.levels[0]?.payout ?? 100}%</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">{tr("Non raggiunto")}</span> <span className="font-bold tabular-nums">0%</span>
          </p>
        </div>
      </div>
    );
  return <Curve def={def} />;
}

function Curve({ def }: { def: ObjectiveDef }) {
  // dates are drawn on a flipped axis (later date = left), so the curve still rises to the right
  const isDate = typeOf(def) === "data";
  const tick = (v: number) => (isDate ? formatValue(def, -v).slice(0, 5) : fmt(v));
  const lv = [...def.levels]
    .filter((l) => Number.isFinite(l.target))
    .map((l) => ({ ...l, target: isDate ? -l.target : l.target }))
    .sort((a, b) => a.target - b.target);
  const W = 220;
  const H = 120;
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  if (!lv.length) return null;
  const span = Math.max(lv[lv.length - 1].target - lv[0].target, Math.abs(lv[0].target) * 0.2, 1);
  const x0 = lv[0].target - span * 0.25;
  const x1 = lv[lv.length - 1].target + span * 0.2;
  const maxP = Math.max(...lv.map((l) => l.payout), 100);
  const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (p: number) => H - pad.b - (p / maxP) * (H - pad.t - pad.b);

  // build exact path: flat 0 until first level, then linear or stepped segments, then flat
  const pts: [number, number][] = [
    [x0, 0],
    [lv[0].target, 0],
    [lv[0].target, lv[0].payout],
  ];
  for (let i = 1; i < lv.length; i++) {
    if (def.calc === "scaglioni") pts.push([lv[i].target, lv[i - 1].payout]);
    pts.push([lv[i].target, lv[i].payout]);
  }
  pts.push([x1, lv[lv.length - 1].payout]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Curva di payout")}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("Curva di payout {0}", [def.calc])}>
        {[0, 50, 100]
          .filter((p) => p <= maxP)
          .map((p) => (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={sy(p)} y2={sy(p)} stroke="#e3e7ee" strokeDasharray={p ? "3 3" : undefined} />
              <text x={pad.l - 5} y={sy(p) + 3} textAnchor="end" className="fill-[#9aa2b1] text-[9px]">
                {p}%
              </text>
            </g>
          ))}
        <path d={d} fill="none" stroke="#1673e6" strokeWidth={2} strokeLinejoin="round" />
        {lv.map((l, i) => (
          <g key={i}>
            <circle cx={sx(l.target)} cy={sy(l.payout)} r={3} fill="#fff" stroke="#1673e6" strokeWidth={1.5} />
            <text x={sx(l.target)} y={H - 7} textAnchor="middle" className="fill-[#6b7486] text-[9px]">
              {tick(l.target)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function WeightMeter({ total }: { total: number }) {
  const ok = total === 100;
  return (
    <div className="min-w-[180px]">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-semibold text-muted">{tr("Peso totale")}</span>
        <span className={`font-bold tabular-nums ${ok ? "text-emerald-600" : total > 100 ? "text-red-600" : "text-amber-600"}`}>{total}% / 100%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${ok ? "bg-emerald-500" : total > 100 ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 text-[14px] font-bold">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[12px] font-extrabold text-brand">{n}</span>
      {title}
    </h2>
  );
}

export function Block({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[11.5px] font-semibold text-red-600">{tr(error)}</p>}
    </div>
  );
}
