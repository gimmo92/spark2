"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Copy, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { fullName } from "@/lib/data";
import {
  CYCLES,
  SCHEDA_STATUSES,
  catalogById,
  itemDef,
  payoutFor,
  type CalcMode,
  type Level,
  type ObjectiveDef,
  type Scheda,
  type SchedaItem,
  type SchedaStatus,
} from "@/lib/mbo";
import { useStore } from "@/lib/store";
import { MultiSelect } from "./MultiSelect";
import { GhostButton, PrimaryButton, inputCls } from "./ui";

const collator = new Intl.Collator("it", { sensitivity: "base" });
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
export const levelsSummary = (d: ObjectiveDef) => d.levels.map((l) => `${fmt(l.target)} ${d.unit} → ${l.payout}%`).join("  ·  ");

/** Route entry: /mbo/schede/[id] (edit) or /mbo/schede/nuova (create). */
export function SchedaEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { schede, hydrated } = useStore();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return <SchedaEditor key="new" />;
  const scheda = schede.find((s) => s.id === params.id);
  if (!scheda)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">Scheda non trovata</p>
        <Link href="/mbo/schede" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
          Torna alle schede obiettivo
        </Link>
      </div>
    );
  return <SchedaEditor key={scheda.id} scheda={scheda} />;
}

function SchedaEditor({ scheda }: { scheda?: Scheda }) {
  const router = useRouter();
  const { users, addScheda, updateScheda, notify, objectives } = useStore();

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
        .map((u) => ({ value: u.id, label: fullName(u), hint: `${u.role}${u.team ? ` · ${u.team}` : ""}` })),
    [users, assigneeIds],
  );
  const usedIds = new Set([...items.map((i) => i.objectiveId), thresholdId]);
  const catalogOptions = objectives.filter((o) => !o.archived || usedIds.has(o.id)).map((o) => ({
    value: o.id,
    label: o.name,
    hint: `${o.calc === "lineare" ? "Lineare" : "A scaglioni"} · ${levelsSummary(o)}`,
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
          unit: "%",
          calc: "lineare",
          levels: [
            { target: 80, payout: 50 },
            { target: 100, payout: 100 },
            { target: 120, payout: 150 },
          ],
        },
      },
    ]);
    setExpanded(id);
  };
  const personalize = (it: SchedaItem) => {
    const def = catalogById(objectives, it.objectiveId);
    if (!def) return;
    updateItem(it.id, { objectiveId: undefined, custom: { ...def, id: uid("cu"), levels: def.levels.map((l) => ({ ...l })) } });
    setExpanded(it.id);
  };

  // validation
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Inserisci il nome della scheda";
  if (!assigneeIds.length) errors.assignees = "Assegna la scheda ad almeno un utente";
  if (!items.length) errors.items = "Aggiungi almeno un obiettivo";
  else if (totalWeight !== 100) errors.items = `La somma dei pesi deve essere 100% (ora ${totalWeight}%)`;
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
      notify("Controlla i campi evidenziati");
      return;
    }
    const prevThreshold = scheda?.threshold?.objectiveId === thresholdId ? scheda?.threshold : undefined;
    const data = {
      name: name.trim(),
      assigneeIds,
      cycle,
      status,
      items,
      threshold: thresholdOn ? { objectiveId: thresholdId, actual: prevThreshold?.actual } : undefined,
    };
    if (scheda) {
      updateScheda(scheda.id, data);
      notify("Scheda salvata");
    } else {
      addScheda(data);
      notify("Scheda creata");
    }
    router.push("/mbo/schede");
  };

  const thresholdDef = catalogById(objectives, thresholdId);

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mbo/schede" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Schede obiettivo
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{scheda ? "Modifica scheda" : "Nuova scheda obiettivo"}</h1>
          {scheda && <p className="mt-0.5 text-[12.5px] text-muted">{scheda.name}</p>}
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => router.push("/mbo/schede")}>Annulla</GhostButton>
          <PrimaryButton onClick={save}>{scheda ? "Salva scheda" : "Crea scheda"}</PrimaryButton>
        </div>
      </div>

      {/* 1. General info */}
      <section className="card p-5">
        <SectionTitle n={1} title="Informazioni generali" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Block label="Nome scheda" error={err("name")} className="sm:col-span-2">
            <input
              className={`${inputCls} ${err("name") ? "border-red-300" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. MBO 2026 · Area Manager Nord"
            />
          </Block>
          <Block
            label="Assegnatari"
            hint={assigneeIds.length > 1 ? `${assigneeIds.length} utenti ricevono la stessa scheda` : "Uno o più utenti"}
            error={err("assignees")}
            className="sm:col-span-2"
          >
            <MultiSelect
              options={userOptions}
              value={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="Seleziona uno o più utenti"
              searchPlaceholder="Cerca per nome, ruolo o team…"
              invalid={!!err("assignees")}
            />
          </Block>
          <Block label="Ciclo di riferimento">
            <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Block>
          <Block label="Stato">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SchedaStatus)}>
              {SCHEDA_STATUSES.filter((s) => s.value !== "archiviata").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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
              <span className="block text-[13px] font-bold">Opzioni avanzate</span>
              <span className="block text-[11.5px] text-muted">
                {thresholdOn && thresholdDef ? `Obiettivo soglia: ${thresholdDef.name}` : "Obiettivo soglia della scheda"}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${advancedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden" inert={!advancedOpen}>
              <div className="border-t border-line px-4 py-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Switch checked={thresholdOn} onChange={setThresholdOn} />
                  <span>
                    <span className="block text-[13px] font-semibold">Imposta un obiettivo soglia</span>
                    <span className="block text-[12px] text-muted">
                      Se l&apos;obiettivo soglia non raggiunge il primo livello target, la scheda non matura alcun payout,
                      indipendentemente dagli altri obiettivi.
                    </span>
                  </span>
                </label>
                {thresholdOn && (
                  <div className="mt-3.5 grid gap-3 sm:grid-cols-[1fr_220px]">
                    <Block label="Obiettivo soglia" error={err("threshold")}>
                      <MultiSelect
                        multiple={false}
                        options={catalogOptions}
                        value={thresholdId ? [thresholdId] : []}
                        onChange={(v) => setThresholdId(v[0] ?? "")}
                        placeholder="Seleziona obiettivo"
                        searchPlaceholder="Cerca obiettivo…"
                        invalid={!!err("threshold")}
                      />
                    </Block>
                    {thresholdDef && (
                      <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
                        <span className="block font-bold">Soglia di accesso</span>
                        Raggiunta con almeno {fmt(thresholdDef.levels[0].target)} {thresholdDef.unit}
                      </div>
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
          <SectionTitle n={2} title="Obiettivi" />
          <WeightMeter total={totalWeight} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Block label="Seleziona obiettivi">
            <MultiSelect
              options={catalogOptions}
              value={catalogIds}
              onChange={setCatalog}
              placeholder="Scegli uno o più obiettivi"
              searchPlaceholder="Cerca obiettivo…"
            />
          </Block>
          <button
            type="button"
            onClick={addCustom}
            className="flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand/50 px-3.5 text-[12.5px] font-bold text-brand transition-colors hover:bg-brand-soft"
          >
            <Sparkles className="h-3.5 w-3.5" /> Crea nuovo obiettivo
          </button>
        </div>

        {err("items") && (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> {err("items")}
          </p>
        )}

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">Nessun obiettivo nella scheda</p>
            <p className="mt-0.5 text-[12px] text-muted">Selezionali dall&apos;elenco oppure creane uno nuovo.</p>
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
                          <span className="truncate text-[13px] font-semibold">{def.name || "Obiettivo senza nome"}</span>
                          <span className="shrink-0 text-[11px] text-muted">{def.calc === "lineare" ? "Lineare" : "A scaglioni"}</span>
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">{levelsSummary(def)}</span>
                      </span>
                    </button>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted">Peso</span>
                      <span className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={it.weight}
                          onChange={(ev) => updateItem(it.id, { weight: Number(ev.target.value) })}
                          className="w-[72px] rounded-lg border border-[#dfe3ea] py-1.5 pl-2.5 pr-6 text-right text-[13px] font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label="Rimuovi obiettivo"
                      title="Rimuovi"
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
                              <Copy className="h-3.5 w-3.5" /> Personalizza per questa scheda
                            </button>
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
        <GhostButton onClick={() => router.push("/mbo/schede")}>Annulla</GhostButton>
        <PrimaryButton onClick={save}>{scheda ? "Salva scheda" : "Crea scheda"}</PrimaryButton>
      </div>
    </div>
  );
}

export function customError(d: ObjectiveDef): string | null {
  if (!d.name.trim()) return "Inserisci il nome dell'obiettivo";
  if (!d.levels.length) return "Aggiungi almeno un livello";
  for (let i = 1; i < d.levels.length; i++)
    if (!(d.levels[i].target > d.levels[i - 1].target)) return "I livelli target devono essere crescenti";
  if (d.levels.some((l) => l.payout < 0 || Number.isNaN(l.payout) || Number.isNaN(l.target))) return "Controlla i valori dei livelli";
  return null;
}

export function CustomObjectiveEditor({ def, onChange, error }: { def: ObjectiveDef; onChange: (p: Partial<ObjectiveDef>) => void; error?: string }) {
  const setLevel = (i: number, patch: Partial<Level>) => onChange({ levels: def.levels.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
      <div className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          <Block label="Nome obiettivo">
            <input autoFocus className={inputCls} value={def.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="es. Lancio nuova linea prodotto" />
          </Block>
          <Block label="Unità di misura">
            <input className={inputCls} value={def.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="%, €, n." />
          </Block>
        </div>

        <Block label="Modalità di calcolo">
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
                {m === "lineare" ? "Lineare" : "A scaglioni"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted">
            {def.calc === "lineare"
              ? "Il payout cresce in proporzione tra un livello e il successivo."
              : "Il payout resta fisso al livello raggiunto fino al successivo."}
          </p>
        </Block>

        <div>
          <div className="mb-1.5 grid grid-cols-[64px_1fr_1fr_28px] gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>Livello</span>
            <span>Target ({def.unit || "valore"})</span>
            <span>Payout %</span>
            <span />
          </div>
          <div className="space-y-1.5">
            {def.levels.map((l, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr_1fr_28px] items-center gap-2">
                <span className="text-[12.5px] font-semibold text-muted">
                  {i === 0 ? "Minimo" : i === def.levels.length - 1 && def.levels.length > 1 ? "Massimo" : `Livello ${i + 1}`}
                </span>
                <input type="number" className={inputCls} value={l.target} onChange={(e) => setLevel(i, { target: Number(e.target.value) })} />
                <input type="number" min={0} className={inputCls} value={l.payout} onChange={(e) => setLevel(i, { payout: Number(e.target.value) })} />
                <button
                  type="button"
                  aria-label="Rimuovi livello"
                  disabled={def.levels.length === 1}
                  onClick={() => onChange({ levels: def.levels.filter((_, k) => k !== i) })}
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
              const last = def.levels[def.levels.length - 1];
              onChange({ levels: [...def.levels, { target: last ? last.target + 10 : 100, payout: last ? last.payout + 25 : 100 }] });
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi livello
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>
      <PayoutCurve def={def} />
    </div>
  );
}

export function LevelsReadOnly({ def }: { def: ObjectiveDef }) {
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[11px] font-bold uppercase tracking-wide text-muted">
          <th className="pb-1.5">Livello</th>
          <th className="pb-1.5">Target</th>
          <th className="pb-1.5">Payout</th>
        </tr>
      </thead>
      <tbody>
        {def.levels.map((l, i) => (
          <tr key={i} className="border-t border-line">
            <td className="py-1.5 text-muted">{i === 0 ? "Minimo" : i === def.levels.length - 1 ? "Massimo" : `Livello ${i + 1}`}</td>
            <td className="py-1.5 font-semibold tabular-nums">
              {fmt(l.target)} {def.unit}
            </td>
            <td className="py-1.5 font-semibold tabular-nums">{l.payout}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small chart of payout % vs actual value, so the calc mode is visible at a glance. */
export function PayoutCurve({ def }: { def: ObjectiveDef }) {
  const lv = [...def.levels].filter((l) => Number.isFinite(l.target)).sort((a, b) => a.target - b.target);
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
  const pts: [number, number][] = [[x0, 0], [lv[0].target, 0], [lv[0].target, lv[0].payout]];
  for (let i = 1; i < lv.length; i++) {
    if (def.calc === "scaglioni") pts.push([lv[i].target, lv[i - 1].payout]);
    pts.push([lv[i].target, lv[i].payout]);
  }
  pts.push([x1, lv[lv.length - 1].payout]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Curva di payout</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Curva di payout ${def.calc}`}>
        {[0, 50, 100].filter((p) => p <= maxP).map((p) => (
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
              {fmt(l.target)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-muted">
        Esempio: a {fmt(lv[lv.length - 1].target)} {def.unit} il payout è {payoutFor(def, lv[lv.length - 1].target)}%.
      </p>
    </div>
  );
}

function WeightMeter({ total }: { total: number }) {
  const ok = total === 100;
  return (
    <div className="min-w-[180px]">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-semibold text-muted">Peso totale</span>
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
      {error && <p className="mt-1 text-[11.5px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-[#d5dae2]"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  );
}
