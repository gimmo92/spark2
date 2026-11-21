"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CalcMode, Preset } from "@/lib/mbo";
import { useStore } from "@/lib/store";
import { Block, LevelsEditor, PayoutCurve, fmt, levelsError } from "./SchedaEditor";
import { GhostButton, Modal, PrimaryButton, Tooltip, inputCls } from "./ui";

const TABS = [{ href: "/impostazioni/mbo", label: "MBO" }];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-bold">Impostazioni</h1>
      <nav className="flex gap-1 border-b border-[#e3e7ee]" aria-label="Sezioni impostazioni">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const asDef = (p: Pick<Preset, "name" | "calc" | "levels">) => ({ id: "preset", name: p.name, unit: "", calc: p.calc, levels: p.levels });

export function SettingsMbo() {
  const { presets, deletePreset, notify, hydrated } = useStore();
  const [editing, setEditing] = useState<Preset | "new" | null>(null);
  const [deleting, setDeleting] = useState<Preset | null>(null);

  return (
    <div className="space-y-4">
      <SettingsTabs />

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-bold">Preset target / payout</h2>
            <p className="mt-0.5 max-w-xl text-[12.5px] text-muted">
              Schemi di livelli riutilizzabili. Negli obiettivi li selezioni dal menu &ldquo;Preset target / payout&rdquo; per compilare livelli e
              modalità di calcolo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuovo preset
          </button>
        </div>

        {!hydrated ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-canvas" />
        ) : presets.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">Nessun preset</p>
            <p className="mt-0.5 text-[12px] text-muted">Crea il primo schema di livelli target / payout.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                  <th className="px-4 py-2.5">Preset</th>
                  <th className="px-3 py-2.5">Calcolo</th>
                  <th className="px-3 py-2.5">Livelli target → payout</th>
                  <th className="w-[90px] px-3 py-2.5">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-[#f8fafd]">
                    <td className="px-4 py-[9px]">
                      <button type="button" onClick={() => setEditing(p)} className="block text-left">
                        <span className="block text-[13.5px] font-semibold text-brand hover:underline">{p.name}</span>
                        {p.description && <span className="block max-w-[340px] truncate text-[11.5px] text-muted">{p.description}</span>}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{p.calc === "lineare" ? "Lineare" : "A scaglioni"}</td>
                    <td className="px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {p.levels.map((l, i) => (
                          <span key={i} className="whitespace-nowrap rounded-md bg-canvas px-1.5 py-0.5 text-[11.5px] tabular-nums text-[#5b6476]">
                            {fmt(l.target)} → <span className="font-semibold text-ink">{l.payout}%</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-0.5">
                        <Tooltip label="Modifica">
                          <button
                            type="button"
                            aria-label="Modifica"
                            onClick={() => setEditing(p)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-brand-soft hover:text-brand"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Elimina">
                          <button
                            type="button"
                            aria-label="Elimina"
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
          title="Eliminare il preset?"
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>Annulla</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  deletePreset(deleting.id);
                  notify("Preset eliminato");
                  setDeleting(null);
                }}
              >
                Elimina
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{deleting.name}</span> non sarà più selezionabile. Gli obiettivi a cui è già stato applicato
            mantengono i loro livelli.
          </p>
        </Modal>
      )}
    </div>
  );
}

function PresetModal({ preset, onClose }: { preset?: Preset; onClose: () => void }) {
  const { savePreset, notify } = useStore();
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
  const [submitted, setSubmitted] = useState(false);
  const error = !name.trim() ? "Inserisci il nome del preset" : levelsError(levels);

  const save = () => {
    setSubmitted(true);
    if (error) return;
    savePreset({ id: preset?.id, name: name.trim(), description: description.trim(), calc, levels: [...levels].sort((a, b) => a.target - b.target) });
    notify(preset ? "Preset salvato" : "Preset creato");
    onClose();
  };

  return (
    <Modal
      title={preset ? "Modifica preset" : "Nuovo preset"}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Annulla</GhostButton>
          <PrimaryButton onClick={save}>{preset ? "Salva preset" : "Crea preset"}</PrimaryButton>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <div className="space-y-3.5">
          <Block label="Nome preset">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Standard 80 / 100 / 120" />
          </Block>
          <Block label="Descrizione">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quando usarlo" />
          </Block>
          <Block label="Modalità di calcolo">
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
                  {m === "lineare" ? "Lineare" : "A scaglioni"}
                </button>
              ))}
            </div>
          </Block>
          <LevelsEditor unit="" levels={levels} onChange={setLevels} />
          {submitted && error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}
        </div>
        <PayoutCurve def={asDef({ name, calc, levels })} />
      </div>
    </Modal>
  );
}
