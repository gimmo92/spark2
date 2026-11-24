"use client";

import { useMemo, useState } from "react";
import { Check, Globe, Lock } from "lucide-react";
import { GhostButton, Modal, PrimaryButton, Tooltip, fullName, useAccess } from "@spark/core";
import {
  activityDef,
  activityKind,
  activityValue,
  activityWeight,
  formatValue,
  fromDay,
  itemDef,
  payoutFor,
  projectActual,
  relativeRows,
  schedeUsing,
  toDay,
  typeOf,
  type Measure,
  type ObjectiveDef,
  type Scheda,
} from "../lib/mbo";
import { useMbo } from "../store";
import { StatusPill } from "./SchedeTable";
import { localeTag, tr } from "@spark/core";

const box =
  "h-8 rounded-lg border border-[#dfe3ea] bg-white px-2.5 text-[12.5px] font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15";

/** The objective's target → payout levels, with the one the actual reaches highlighted. */
export function LevelChips({ def, actual }: { def: ObjectiveDef; actual?: number }) {
  const type = typeOf(def);
  if (type === "progetto" && def.activityLevels) return <p className="text-[11.5px] text-muted">{tr("Livelli per attività: payout = somma pesata delle attività")}</p>;
  const levels = [...def.levels].sort((a, b) => (type === "data" ? b.target - a.target : a.target - b.target));
  // levels in % of last year's actual: none until it is entered (in the scheda or on the objective)
  if (!levels.length)
    return def.relative ? (
      <p className="text-[11.5px] font-semibold text-amber-700">{tr("Manca l'actual anno precedente: inseriscilo nella scheda o nell'obiettivo.")}</p>
    ) : null;
  // % levels: each value also shows the % it comes from ("108% AP", "110% target")
  const rows = def.relative ? relativeRows(def.relative, def.base ?? 0) : [];
  const origin = (v: number) => {
    const r = rows.find((x) => x.target === v);
    if (!r || r.of === "value") return "";
    const n = r.pct.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
    return ` (${r.of === "base" ? tr("{0}% AP", [n]) : tr("{0}% target", [n])})`;
  };
  // highest level reached by the actual (dates: earlier is better)
  const reached = actual == null ? -1 : levels.findLastIndex((l) => (type === "data" ? actual <= l.target : actual >= l.target));
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-[10.5px] font-bold uppercase tracking-wide text-faint">{tr("Livelli")}</span>
      {levels.map((l, i) => {
        const on = i === reached;
        return (
          <span
            key={i}
            className={`rounded-md border px-1.5 py-[1px] text-[11px] tabular-nums ${
              on ? "border-brand bg-brand-soft font-bold text-brand" : "border-line bg-white text-[#5b6476]"
            }`}
          >
            {type === "onoff" ? tr("Raggiunto") : formatValue(def, l.target)}
            {origin(l.target) && <span className="font-normal text-faint">{origin(l.target)}</span>} → {l.payout}%
          </span>
        );
      })}
      {def.calc === "lineare" && type !== "onoff" && levels.length > 1 && <span className="text-[10.5px] text-faint">{tr("· lineare tra i livelli")}</span>}
    </div>
  );
}

/** Actual-value field for one objective; its shape depends on the objective type. */
export function MeasureInput({ def, value, onChange, disabled }: { def: ObjectiveDef; value: Measure; onChange: (m: Measure) => void; disabled?: boolean }) {
  const type = typeOf(def);
  const v = value.actual;

  if (type === "onoff")
    return (
      <div className="inline-flex rounded-lg bg-canvas p-0.5">
        {[
          { n: 1, label: "Raggiunto" },
          { n: 0, label: "Non raggiunto" },
        ].map((o) => (
          <button
            key={o.n}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ actual: v === o.n ? undefined : o.n })}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              v === o.n ? (o.n ? "bg-emerald-600 text-white" : "bg-white text-red-600 shadow-sm") : "text-muted hover:text-ink"
            }`}
          >
            {tr(o.label)}
          </button>
        ))}
      </div>
    );

  if (type === "qualitativo_5")
    return (
      <div role="radiogroup" aria-label={tr("Voto")} className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={v === n}
            disabled={disabled}
            onClick={() => onChange({ actual: v === n ? undefined : n })}
            className={`grid h-8 w-8 place-items-center rounded-lg border text-[12.5px] font-bold tabular-nums transition-colors disabled:opacity-60 ${
              v != null && n <= v ? "border-brand bg-brand text-white" : "border-[#dfe3ea] bg-white text-muted hover:border-[#c6ccd6] hover:text-ink"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );

  if (type === "data")
    return (
      <input
        type="date"
        disabled={disabled}
        className={`${box} w-[150px]`}
        value={v != null ? fromDay(v) : ""}
        onChange={(e) => onChange({ actual: e.target.value ? toDay(e.target.value) : undefined })}
        aria-label={tr("Data di completamento")}
      />
    );

  if (type === "progetto") {
    const acts = def.activities ?? [];
    const done = new Set(value.done ?? []);
    const emit = (m: Measure) => onChange({ ...m, actual: projectActual(def, m) });
    const toggle = (id: string) => emit({ done: done.has(id) ? [...done].filter((x) => x !== id) : [...done, id], values: value.values });
    const setValue = (id: string, raw: string) => {
      const values = { ...(value.values ?? {}) };
      if (raw === "") delete values[id];
      else values[id] = Number(raw);
      emit({ done: value.done, values });
    };
    return (
      <div className="min-w-[280px] space-y-1">
        {acts.map((a) => {
          const kind = activityKind(a);
          const on = done.has(a.id);
          const weight = Math.round(activityWeight(def, a) * 10) / 10;
          return (
            <div key={a.id}>
              <div className="flex items-center gap-2 text-[12.5px]">
                {kind === "onoff" ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(a.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-canvas disabled:pointer-events-none"
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-brand bg-brand text-white" : "border-[#cfd5de] bg-white"}`}
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className={`truncate ${on ? "text-muted line-through" : ""}`}>{tr(a.title)}</span>
                  </button>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate px-1">{tr(a.title)}</span>
                    <span className="relative inline-block shrink-0">
                      <input
                        type="number"
                        disabled={disabled}
                        min={0}
                        max={kind === "pct" ? 100 : undefined}
                        className={`${box} h-7 w-[92px] pr-9 text-right`}
                        value={value.values?.[a.id] ?? ""}
                        placeholder="—"
                        onChange={(e) => setValue(a.id, e.target.value)}
                        aria-label={tr("Consuntivo di {0}", [a.title])}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 max-w-[30px] -translate-y-1/2 truncate text-[11px] text-muted">
                        {kind === "pct" ? "%" : a.unit}
                      </span>
                    </span>
                    {kind === "kpi" && (
                      <span className="w-[64px] shrink-0 truncate text-[11px] tabular-nums text-muted">
                        / {def.activityLevels ? activityDef(def, a).levels.at(-1)?.target : (a.target ?? "—")} {a.unit}
                      </span>
                    )}
                  </>
                )}
                <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-faint">{weight}%</span>
              </div>
              {def.activityLevels && (
                <div className="pb-1 pl-7">
                  <LevelChips def={activityDef(def, a)} actual={activityValue(a, value)} />
                </div>
              )}
            </div>
          );
        })}
        {!acts.length && <p className="text-[12px] text-faint">{tr("Nessuna attività definita")}</p>}
        {!!acts.length && (
          <p className="px-1 pt-0.5 text-[11.5px] text-muted">
            {def.activityLevels ? tr("Payout progetto") : tr("Avanzamento progetto")}: <span className="font-semibold tabular-nums text-ink">{value.actual ?? 0}%</span>
          </p>
        )}
      </div>
    );
  }

  const pct = type === "qualitativo_pct";
  const suffix = pct ? "%" : def.unit;
  return (
    <span className="relative inline-block">
      <input
        type="number"
        disabled={disabled}
        min={pct ? 0 : undefined}
        max={pct ? 100 : undefined}
        className={`${box} w-[130px] text-right ${suffix ? "pr-9" : ""}`}
        value={v ?? ""}
        placeholder="—"
        onChange={(e) => onChange({ actual: e.target.value === "" ? undefined : Number(e.target.value) })}
        aria-label={tr("Consuntivo")}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 max-w-[28px] -translate-y-1/2 truncate text-[11px] text-muted">{suffix}</span>}
    </span>
  );
}

/** One place where an objective is measured: a scheda item, a scheda threshold or the global threshold. */
interface Row {
  key: string;
  scheda?: Scheda;
  itemId?: string;
  threshold?: boolean;
  /** Definition with the scheda's own levels, if any. */
  def: ObjectiveDef;
  weight?: number;
  measure: Measure;
  editable: boolean;
}

/** "Misura": enters the actual result of a catalog objective in every scheda that uses it. */
export function MisuraModal({ def, onClose }: { def: ObjectiveDef; onClose: () => void }) {
  const { schede, users, objectives, updateScheda, canEditScheda, mboSettings, setMboSettings, notify } = useMbo();
  const { allowed } = useAccess();
  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const isGlobal = mboSettings.globalThresholdId === def.id;
  const type = typeOf(def);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (isGlobal)
      out.push({
        key: "global",
        def,
        threshold: true,
        measure: { actual: mboSettings.globalThresholdActual, done: mboSettings.globalThresholdDone, values: mboSettings.globalThresholdValues },
        editable: allowed("mbo.settings.manage"),
      });
    for (const s of schedeUsing(schede, def.id)) {
      if (s.status === "archiviata") continue;
      const editable = canEditScheda(s);
      for (const it of s.items)
        // the objective in this scheda: own levels, last year's actual, or its personalized copy
        if ((!it.custom && it.objectiveId === def.id) || it.custom?.originId === def.id)
          out.push({
            key: `${s.id}:${it.id}`,
            scheda: s,
            itemId: it.id,
            def: itemDef([def, ...objectives], it) ?? def,
            weight: it.weight,
            measure: { actual: it.actual, done: it.done, values: it.values },
            editable,
          });
      if (s.threshold?.objectiveId === def.id)
        out.push({
          key: `${s.id}:soglia`,
          scheda: s,
          threshold: true,
          def,
          measure: { actual: s.threshold.actual, done: s.threshold.done, values: s.threshold.values },
          editable,
        });
    }
    return out;
    // the list is taken once when the modal opens: edits below are drafts until "Salva"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<Record<string, Measure>>(() => Object.fromEntries(rows.map((r) => [r.key, r.measure])));
  const [all, setAll] = useState<Measure>({});
  const editable = rows.filter((r) => r.editable);
  const changed = rows.filter((r) => JSON.stringify(draft[r.key]) !== JSON.stringify(r.measure));

  const applyAll = () => {
    setDraft((d) => ({ ...d, ...Object.fromEntries(editable.map((r) => [r.key, all])) }));
  };

  const save = () => {
    const bySheet = new Map<string, Scheda>();
    for (const r of changed) {
      const m = draft[r.key];
      if (r.key === "global") {
        setMboSettings({ globalThresholdActual: m.actual, globalThresholdDone: m.done, globalThresholdValues: m.values });
        continue;
      }
      const s = bySheet.get(r.scheda!.id) ?? r.scheda!;
      bySheet.set(
        s.id,
        r.threshold
          ? { ...s, threshold: { ...s.threshold!, actual: m.actual, done: m.done, values: m.values } }
          : { ...s, items: s.items.map((i) => (i.id === r.itemId ? { ...i, actual: m.actual, done: m.done, values: m.values } : i)) },
      );
    }
    for (const s of bySheet.values()) updateScheda(s.id, { items: s.items, threshold: s.threshold });
    notify(!changed.length ? tr("Nessuna modifica") : changed.length === 1 ? tr("Consuntivo salvato · 1 voce aggiornata") : tr("Consuntivo salvato · {0} voci aggiornate", [changed.length]));
    onClose();
  };

  return (
    <Modal
      title={tr("Misura · {0}", [def.name])}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={save} disabled={!changed.length}>{tr("Salva consuntivo")}</PrimaryButton>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">{tr("L'obiettivo non è usato in nessuna scheda attiva: non c'è nulla da misurare.")}</p>
      ) : (
        <>
          {editable.length > 1 && type !== "progetto" && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-3.5 py-2.5">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">{tr("Stesso valore per tutte")}</span>
              <MeasureInput def={def} value={all} onChange={setAll} />
              <button type="button" onClick={applyAll} className="text-[12.5px] font-semibold text-brand hover:underline">{tr("Applica a {0}", [editable.length])}</button>
            </div>
          )}
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const m = draft[r.key];
              const first = r.scheda ? byUser.get(r.scheda.assigneeIds[0]) : undefined;
              const payout = m.actual != null ? payoutFor(r.def, m.actual) : null;
              return (
                <li key={r.key} className="py-3">
                  <div className={`flex flex-wrap items-start gap-3 ${type === "progetto" ? "" : "sm:items-center"}`}>
                    <div className="min-w-[220px] flex-1">
                      {r.scheda ? (
                        <>
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-semibold">{r.scheda.name}</span>
                            <StatusPill status={r.scheda.status} />
                          </span>
                          <span className="block truncate text-[11.5px] text-muted">
                            {first ? fullName(first) : "—"}
                            {r.scheda.assigneeIds.length > 1 && ` +${r.scheda.assigneeIds.length - 1}`} ·{" "}
                            {r.threshold ? tr("obiettivo soglia") : tr("peso {0}%", [r.weight])}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                          <Globe className="h-3.5 w-3.5 text-muted" />{" "}{tr("Soglia globale · tutte le schede")}</span>
                      )}
                    </div>
                    <div className={type === "progetto" ? "w-full sm:w-[300px]" : ""}>
                      <MeasureInput def={r.def} value={m} onChange={(next) => setDraft((d) => ({ ...d, [r.key]: next }))} disabled={!r.editable} />
                    </div>
                    <div className="flex w-[110px] items-center justify-end gap-1.5">
                      {!r.editable && (
                        <Tooltip label={tr("Non modificabile con il tuo livello di accesso")}>
                          <Lock className="h-3.5 w-3.5 text-faint" />
                        </Tooltip>
                      )}
                      {payout == null ? (
                        <span className="text-[12px] text-faint">{tr("Da misurare")}</span>
                      ) : r.threshold ? (
                        <span
                          className={`rounded-full px-2 py-[2px] text-[11px] font-bold ${payout > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {payout > 0 ? tr("Raggiunta") : tr("Non raggiunta")}
                        </span>
                      ) : (
                        <span
                          className="rounded-full bg-[#eef1f5] px-2 py-[2px] text-[11px] font-bold tabular-nums text-ink"
                          title={tr("{0} → payout {1}%", [formatValue(r.def, m.actual!), payout])}
                        >{tr("Payout {0}%", [payout])}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <LevelChips def={r.def} actual={m.actual} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
