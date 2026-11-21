"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Info, TriangleAlert, X } from "lucide-react";
import { fullName } from "@/lib/data";
import { CATEGORIES, CYCLES, cycleLabel, schedeUsing, type Level, type ObjectiveDef, type Scheda } from "@/lib/mbo";
import { useStore } from "@/lib/store";
import { MultiSelect } from "./MultiSelect";
import { Block, CustomObjectiveEditor, LevelsEditor, PresetPicker, SectionTitle, customError, levelsError } from "./SchedaEditor";
import { StatusPill } from "./SchedeTable";
import { GhostButton, PrimaryButton, inputCls } from "./ui";

/** Route entry: /mbo/obiettivi/[id] (edit) or /mbo/obiettivi/nuovo (create). */
export function ObiettivoEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { objectives, hydrated } = useStore();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return <ObiettivoEditor key="new" />;
  const def = objectives.find((o) => o.id === params.id);
  if (!def)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">Obiettivo non trovato</p>
        <Link href="/mbo/obiettivi" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
          Torna agli obiettivi
        </Link>
      </div>
    );
  return <ObiettivoEditor key={def.id} def={def} />;
}

/** Per-scheda settings of this objective. `levels` undefined = use the objective's standard levels. */
interface Assignment {
  weight: number;
  levels?: Level[];
}

let seq = 0;
const uid = () => `it${Date.now().toString(36)}${(seq++).toString(36)}`;

const itemOf = (s: Scheda, objectiveId: string) => s.items.find((i) => !i.custom && i.objectiveId === objectiveId);

function ObiettivoEditor({ def }: { def?: ObjectiveDef }) {
  const router = useRouter();
  const { schede, users, addObjective, updateObjective, updateScheda, notify } = useStore();
  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [draft, setDraft] = useState<ObjectiveDef>(
    def ?? {
      id: "draft",
      name: "",
      description: "",
      category: CATEGORIES[0],
      cycle: "2026",
      unit: "%",
      calc: "lineare",
      levels: [
        { target: 80, payout: 50 },
        { target: 100, payout: 100 },
        { target: 120, payout: 150 },
      ],
    },
  );
  // initial assignments = schede that already contain this objective as a weighted item
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => {
    const out: Record<string, Assignment> = {};
    if (def)
      for (const s of schede) {
        const it = itemOf(s, def.id);
        if (it) out[s.id] = { weight: it.weight, levels: it.levels };
      }
    return out;
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const selectedIds = Object.keys(assignments);
  const thresholdIn = def ? schedeUsing(schede, def.id).filter((s) => s.threshold?.objectiveId === def.id).length : 0;

  const schedaOptions = useMemo(
    () =>
      schede
        .filter((s) => s.status !== "archiviata" || assignments[s.id])
        .sort((a, b) => b.cycle.localeCompare(a.cycle) || a.name.localeCompare(b.name, "it"))
        .map((s) => {
          const first = byUser.get(s.assigneeIds[0]);
          return {
            value: s.id,
            label: s.name,
            hint: `${first ? fullName(first) : "—"}${s.assigneeIds.length > 1 ? ` +${s.assigneeIds.length - 1}` : ""} · ${cycleLabel(s.cycle)}`,
          };
        }),
    [schede, byUser, assignments],
  );

  /** Sum of the other objectives' weights in a scheda (excluding this objective). */
  const otherWeight = (s: Scheda) =>
    s.items.filter((i) => !(def && !i.custom && i.objectiveId === def.id)).reduce((a, i) => a + (Number(i.weight) || 0), 0);

  const setSelection = (ids: string[]) => {
    const added = ids.find((id) => !assignments[id]);
    if (added) setExpanded(added);
    setAssignments((prev) => {
      const next: Record<string, Assignment> = {};
      for (const id of ids) {
        if (prev[id]) next[id] = prev[id];
        else {
          const s = schede.find((x) => x.id === id);
          next[id] = { weight: s ? Math.max(0, 100 - otherWeight(s)) : 0 };
        }
      }
      return next;
    });
  };
  const patchAssignment = (id: string, p: Partial<Assignment>) => setAssignments((a) => ({ ...a, [id]: { ...a[id], ...p } }));

  const draftError = customError(draft);
  const rowErrors: Record<string, string> = {};
  for (const [id, a] of Object.entries(assignments)) {
    if (!(a.weight > 0 && a.weight <= 100)) rowErrors[id] = "Il peso deve essere tra 1 e 100%";
    else if (a.levels) {
      const e = levelsError(a.levels);
      if (e) rowErrors[id] = e;
    }
  }
  const patch = (p: Partial<ObjectiveDef>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    setSubmitted(true);
    const firstRowError = Object.keys(rowErrors)[0];
    if (draftError || firstRowError) {
      if (firstRowError) setExpanded(firstRowError);
      notify("Controlla i campi evidenziati");
      return;
    }
    const data = {
      name: draft.name.trim(),
      description: draft.description?.trim() ?? "",
      category: draft.category,
      cycle: draft.cycle,
      unit: draft.unit.trim(),
      calc: draft.calc,
      levels: [...draft.levels].sort((a, b) => a.target - b.target),
    };
    let objectiveId: string;
    if (def) {
      updateObjective(def.id, data);
      objectiveId = def.id;
    } else {
      objectiveId = addObjective(data).id;
    }

    // sync scheda items with the assignment list
    let touched = 0;
    for (const s of schede) {
      const a = assignments[s.id];
      const existing = itemOf(s, objectiveId);
      if (!a && !existing) continue;
      let items = s.items;
      if (a && existing) {
        if (existing.weight === a.weight && JSON.stringify(existing.levels) === JSON.stringify(a.levels)) continue;
        items = s.items.map((i) => (i === existing ? { ...i, weight: a.weight, levels: a.levels } : i));
      } else if (a) {
        items = [...s.items, { id: uid(), objectiveId, weight: a.weight, levels: a.levels }];
      } else {
        items = s.items.filter((i) => i !== existing);
      }
      updateScheda(s.id, { items });
      touched++;
    }
    notify(def ? `Obiettivo salvato${touched ? ` · ${touched} schede aggiornate` : ""}` : "Obiettivo creato");
    router.push("/mbo/obiettivi");
  };

  const actions = (
    <div className="flex gap-2">
      <GhostButton onClick={() => router.push("/mbo/obiettivi")}>Annulla</GhostButton>
      <PrimaryButton onClick={save}>{def ? "Salva obiettivo" : "Crea obiettivo"}</PrimaryButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <Link href="/mbo/obiettivi" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Obiettivi
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{def ? "Modifica obiettivo" : "Nuovo obiettivo"}</h1>
          {def && <p className="mt-0.5 text-[12.5px] text-muted">{def.name}</p>}
        </div>
        {actions}
      </div>

      <section className="card p-5">
        <SectionTitle n={1} title="Classificazione" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Block label="Livello" hint="A che livello si misura">
            <select className={inputCls} value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Block>
          <Block label="Ciclo di riferimento" hint="Anno o periodo">
            <select className={inputCls} value={draft.cycle ?? "2026"} onChange={(e) => patch({ cycle: e.target.value })}>
              {CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Block>
          <Block label="Descrizione" hint="Come si misura, fonte del dato" className="sm:col-span-2">
            <textarea
              rows={2}
              className={`${inputCls} resize-y`}
              value={draft.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="es. Ricavi netti da controllo di gestione, consuntivati a fine anno"
            />
          </Block>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle n={2} title="Misurazione e livelli standard" />
        <CustomObjectiveEditor def={draft} onChange={patch} error={submitted ? (draftError ?? undefined) : undefined} />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle n={3} title="Assegnazione alle schede" />
          <span className="text-[12px] font-semibold text-muted">
            {selectedIds.length} {selectedIds.length === 1 ? "scheda" : "schede"}
          </span>
        </div>
        <Block label="Schede obiettivo">
          <MultiSelect
            options={schedaOptions}
            value={selectedIds}
            onChange={setSelection}
            placeholder="Assegna l'obiettivo a una o più schede"
            searchPlaceholder="Cerca scheda o assegnatario…"
            maxChips={4}
          />
        </Block>
        {thresholdIn > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-700">
            <Info className="h-3.5 w-3.5" /> Usato anche come obiettivo soglia in {thresholdIn} schede (si gestisce dalla scheda).
          </p>
        )}

        {selectedIds.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">Nessuna scheda assegnata</p>
            <p className="mt-0.5 text-[12px] text-muted">Seleziona una o più schede per impostare peso e livelli target/payout.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {selectedIds.map((id) => {
              const s = schede.find((x) => x.id === id);
              if (!s) return null;
              const a = assignments[id];
              const first = byUser.get(s.assigneeIds[0]);
              const total = otherWeight(s) + (Number(a.weight) || 0);
              const isOpen = expanded === id;
              const e = submitted ? rowErrors[id] : undefined;
              const lv = a.levels ?? draft.levels;
              return (
                <div key={id} className={`rounded-xl border bg-white ${e ? "border-red-300" : "border-line"}`}>
                  <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{s.name}</span>
                          <StatusPill status={s.status} />
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {first ? fullName(first) : "—"}
                          {s.assigneeIds.length > 1 && ` +${s.assigneeIds.length - 1}`} · {cycleLabel(s.cycle)} ·{" "}
                          {a.levels ? <span className="font-semibold text-violet-700">livelli personalizzati</span> : "livelli standard"}
                        </span>
                      </span>
                    </button>
                    <span className="text-[12px] font-semibold tabular-nums">Peso {a.weight || 0}%</span>
                    <span
                      className={`rounded-full px-2 py-[2px] text-[11px] font-bold tabular-nums ${
                        total === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                      title="Somma dei pesi di tutti gli obiettivi della scheda"
                    >
                      Totale {total}%
                    </span>
                    <button
                      type="button"
                      aria-label={`Rimuovi da ${s.name}`}
                      onClick={() => setSelection(selectedIds.filter((x) => x !== id))}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 border-t border-line px-3.5 py-3.5">
                      <div className="flex flex-wrap items-end gap-4">
                        <Block label="Peso nella scheda">
                          <span className="relative block w-[110px]">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              className={`${inputCls} pr-7 text-right font-semibold tabular-nums`}
                              value={a.weight}
                              onChange={(ev) => patchAssignment(id, { weight: Number(ev.target.value) })}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                          </span>
                        </Block>
                        <p className="pb-2 text-[11.5px] text-muted">
                          Altri obiettivi della scheda: {otherWeight(s)}%. {total !== 100 && "La scheda dovrà arrivare a 100% prima dell'approvazione."}
                        </p>
                      </div>

                      <div className="space-y-3 rounded-lg bg-canvas p-3">
                        <div className="max-w-[420px]">
                          <PresetPicker
                            hint="Compila i livelli di questa scheda"
                            onApply={(pr) => patchAssignment(id, { levels: pr.levels.map((l) => ({ ...l })) })}
                          />
                        </div>
                        <LevelsEditor unit={draft.unit} levels={lv} onChange={(levels) => patchAssignment(id, { levels })} />
                        {a.levels && (
                          <button
                            type="button"
                            onClick={() => patchAssignment(id, { levels: undefined })}
                            className="mt-2 ml-4 text-[12px] font-semibold text-muted hover:text-ink hover:underline"
                          >
                            Ripristina livelli standard
                          </button>
                        )}
                      </div>
                      {e && (
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
                          <TriangleAlert className="h-3.5 w-3.5" /> {e}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end">{actions}</div>
    </div>
  );
}
