"use client";

import { useState } from "react";
import { Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import {
  catalogById,
  needsBase,
  payoutFor,
  relativePatch,
  relativeText,
  toRelative,
  type CalcMode,
  type Preset,
  type RelativeScale,
  formatValue,
} from "../lib/mbo";
import { useMbo, useMboOptions } from "../store";
import { MeasureInput } from "./Misura";
import { Block, LevelsEditor, PayoutCurve, RelativeLevelsEditor, customError, fmt, levelsError } from "./SchedaEditor";
import { GhostButton, Modal, PrimaryButton, SettingsTabs, Tooltip, inputCls } from "@spark/core";
import { tr } from "@spark/core";

const asDef = (p: Pick<Preset, "name" | "calc" | "levels" | "relative">) => ({
  id: "preset",
  name: p.name,
  type: "quantitativo" as const,
  unit: "",
  calc: p.calc,
  levels: p.levels,
  relative: p.relative,
});

export function SettingsMbo() {
  const { presets, deletePreset, notify, hydrated } = useMbo();
  const [editing, setEditing] = useState<Preset | "new" | null>(null);
  const [deleting, setDeleting] = useState<Preset | null>(null);

  return (
    <div className="space-y-4">
      <SettingsTabs />

      <ThresholdSettings />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-bold">{tr("Preset target / payout")}</h2>
            <p className="mt-0.5 max-w-xl text-[12.5px] text-muted">{tr("Schemi di livelli riutilizzabili. Negli obiettivi li selezioni dal menu “Preset target / payout” per compilare livelli e modalità di calcolo.")}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />{" "}{tr("Nuovo preset")}</button>
        </div>

        {!hydrated ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-canvas" />
        ) : presets.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">{tr("Nessun preset")}</p>
            <p className="mt-0.5 text-[12px] text-muted">{tr("Crea il primo schema di livelli target / payout.")}</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-4 py-2.5">{tr("Preset")}</th>
                  <th className="px-3 py-2.5">{tr("Calcolo")}</th>
                  <th className="px-3 py-2.5">{tr("Livelli target → payout")}</th>
                  <th className="w-[90px] px-3 py-2.5">{tr("Azioni")}</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-[#f8fafd]">
                    <td className="px-4 py-[9px]">
                      <button type="button" onClick={() => setEditing(p)} className="block text-left">
                        <span className="block text-[13.5px] font-semibold text-brand hover:underline">{p.name}</span>
                        {p.description && <span className="block max-w-[340px] truncate text-[11.5px] text-muted">{tr(p.description)}</span>}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{p.calc === "lineare" ? tr("Lineare") : tr("A scaglioni")}</td>
                    <td className="px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {p.relative && needsBase(p.relative) ? (
                          relativeText(p.relative, "\n").split("\n").map((t, i) => (
                            <span key={i} className="whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 text-[11.5px] tabular-nums text-[#5b6476]">
                              {t}
                            </span>
                          ))
                        ) : p.levels.map((l, i) => (
                          <span key={i} className="whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 text-[11.5px] tabular-nums text-[#5b6476]">
                            {fmt(l.target)} → <span className="font-semibold text-ink">{l.payout}%</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-0.5">
                        <Tooltip label={tr("Modifica")}>
                          <button
                            type="button"
                            aria-label={tr("Modifica")}
                            onClick={() => setEditing(p)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-brand-soft hover:text-brand"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </Tooltip>
                        <Tooltip label={tr("Elimina")}>
                          <button
                            type="button"
                            aria-label={tr("Elimina")}
                            onClick={() => setDeleting(p)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <PresetModal preset={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal
          title={tr("Eliminare il preset?")}
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  deletePreset(deleting.id);
                  notify(tr("Preset eliminato"));
                  setDeleting(null);
                }}
              >{tr("Elimina")}</PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{deleting.name}</span>{" "}{tr("non sarà più selezionabile. Gli obiettivi a cui è già stato applicato mantengono i loro livelli.")}</p>
        </Modal>
      )}
    </div>
  );
}

function PresetModal({ preset, onClose }: { preset?: Preset; onClose: () => void }) {
  const { savePreset, notify } = useMbo();
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [calc, setCalc] = useState<CalcMode>(preset?.calc ?? "lineare");
  const [levels, setLevels] = useState(
    preset?.levels.map((l) => ({ ...l })) ?? [
      { target: 80, payout: 50 },
      { target: 100, payout: 100 },
      { target: 120, payout: 150 },
    ],
  );
  // relativeLevels option: levels in % of last year / % of the target / fixed values, as in the objectives
  const percent = !!useMboOptions().relativeLevels;
  const [scale, setScale] = useState<RelativeScale>(() => preset?.relative ?? toRelative(preset?.levels ?? levels));
  const [submitted, setSubmitted] = useState(false);
  const scaled = relativePatch(scale);
  const error = !name.trim()
    ? "Inserisci il nome del preset"
    : percent
      ? customError({ ...asDef({ name, calc, ...scaled }), name: name.trim() })
      : levelsError(levels);

  const save = () => {
    setSubmitted(true);
    if (error) return;
    const data = percent ? scaled : { levels: [...levels].sort((a, b) => a.target - b.target) };
    savePreset({ id: preset?.id, name: name.trim(), description: description.trim(), calc, ...data });
    notify(tr(preset ? "Preset salvato" : "Preset creato"));
    onClose();
  };

  return (
    <Modal
      title={preset ? tr("Modifica preset") : tr("Nuovo preset")}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={save}>{preset ? tr("Salva preset") : tr("Crea preset")}</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <div className="space-y-3.5">
          <Block label={tr("Nome preset")}>
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("es. Standard 80 / 100 / 120")} />
          </Block>
          <Block label={tr("Descrizione")}>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tr("Quando usarlo")} />
          </Block>
          <Block label={tr("Modalità di calcolo")}>
            <div className="inline-flex rounded-lg bg-canvas p-1">
              {(["lineare", "scaglioni"] as CalcMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCalc(m)}
                  className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    calc === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {m === "lineare" ? tr("Lineare") : tr("A scaglioni")}
                </button>
              ))}
            </div>
          </Block>
          {percent ? <RelativeLevelsEditor value={scale} onChange={setScale} /> : <LevelsEditor unit="" levels={levels} onChange={setLevels} />}
          {submitted && error && <p className="text-[12px] font-semibold text-red-600">{tr(error)}</p>}
        </div>
        <PayoutCurve def={asDef(percent ? { name, calc, ...scaled } : { name, calc, levels })} />
      </div>
    </Modal>
  );
}

/** Global threshold objective: applies to every scheda (schede can add their own, on top). */
function ThresholdSettings() {
  const { objectives, mboSettings, setMboSettings, notify, hydrated } = useMbo();
  const def = catalogById(objectives, mboSettings.globalThresholdId);
  const candidates = objectives.filter((o) => !o.archived || o.id === mboSettings.globalThresholdId);
  const actual = mboSettings.globalThresholdActual;
  const met = def && actual != null ? payoutFor(def, actual) > 0 : null;

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold">{tr("Obiettivo soglia globale")}</h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-muted">{tr("Vale per tutte le schede: se non raggiunge il primo livello target, nessuna scheda matura payout. Ogni scheda può avere in più una propria soglia, impostata nelle sue opzioni avanzate.")}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,340px)_180px_1fr] sm:items-end">
            <Block label={tr("Obiettivo soglia globale")}>
              <select
                className={inputCls}
                disabled={!hydrated}
                value={mboSettings.globalThresholdId ?? ""}
                onChange={(e) => {
                  setMboSettings({ globalThresholdId: e.target.value || undefined, globalThresholdActual: undefined });
                  notify(tr(e.target.value ? "Soglia globale aggiornata" : "Soglia globale disattivata"));
                }}
              >
                <option value="">{tr("Nessuna")}</option>
                {candidates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.category ? ` · ${o.category}` : ""}
                  </option>
                ))}
              </select>
            </Block>
            {def && (
              <Block label={tr("Consuntivo")}>
                <MeasureInput
                  def={def}
                  value={{ actual, done: mboSettings.globalThresholdDone, values: mboSettings.globalThresholdValues }}
                  onChange={(m) => setMboSettings({ globalThresholdActual: m.actual, globalThresholdDone: m.done, globalThresholdValues: m.values })}
                />
              </Block>
            )}
            {def && (
              <p
                className={`rounded-lg px-3 py-2 text-[12px] ${
                  met == null ? "bg-canvas text-muted" : met ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                }`}
              >{tr("Soglia: almeno")}{" "}<strong>{formatValue(def, def.levels[0].target)}</strong> ·{" "}
                {met == null ? tr("da consuntivare") : met ? tr("raggiunta") : tr("non raggiunta, payout azzerato per tutte le schede")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
