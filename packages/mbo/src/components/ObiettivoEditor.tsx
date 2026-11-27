"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronDown, Info, Layers, TriangleAlert, X } from "lucide-react";
import { fullName } from "@spark/core";
import { CATEGORIES, CYCLES, cycleLabel, formatValue, needsBase, relativePatch, schedeUsing, toRelative, typeDefaults, typeOf, type Level, type ObjectiveDef, type RelativeScale, type Scheda } from "../lib/mbo";
import { useMbo, useMboOptions } from "../store";
import { MultiSelect } from "@spark/core";
import { BaseInput, RelativeLevelsEditor, showBase, Block, ChoiceButtons, CustomObjectiveEditor, LevelsEditor, PresetPicker, SectionTitle, baseError, customError, levelsError } from "./SchedaEditor";
import { CATEGORY_ICON } from "./ObiettiviTable";
import { StatusPill } from "./SchedeTable";
import { GhostButton, PrimaryButton, inputCls } from "@spark/core";
import { tr } from "@spark/core";

/** Route entry: /mbo/obiettivi/[id] (edit) or /mbo/obiettivi/nuovo (create). */
export function ObiettivoEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { objectives, hydrated } = useMbo();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return <ObiettivoEditor key="new" />;
  const def = objectives.find((o) => o.id === params.id);
  if (!def)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">{tr("Obiettivo non trovato")}</p>
        <Link href="/mbo/obiettivi" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">{tr("Torna agli obiettivi")}</Link>
      </div>
    );
  return <ObiettivoEditor key={def.id} def={def} />;
}

/** Per-scheda settings of this objective. `levels` undefined = use the objective's standard levels. */
interface Assignment {
  weight: number;
  levels?: Level[];
  /** Relative levels: last year's actual in that scheda. */
  base?: number;
  /** % levels of that scheda (objectives with a relative scale); undefined = the objective's. */
  relative?: RelativeScale;
}

let seq = 0;
const uid = () => `it${Date.now().toString(36)}${(seq++).toString(36)}`;

const itemOf = (s: Scheda, objectiveId: string) => s.items.find((i) => !i.custom && i.objectiveId === objectiveId);

function ObiettivoEditor({ def }: { def?: ObjectiveDef }) {
  const router = useRouter();
  const { schede, users, addObjective, updateObjective, updateScheda, notify } = useMbo();
  const options = useMboOptions();
  const byUser = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [draft, setDraft] = useState<ObjectiveDef>(
    def ?? {
      id: "draft",
      name: "",
      description: "",
      category: CATEGORIES[0],
      cycle: "2026",
      type: "quantitativo",
      ...typeDefaults("quantitativo"),
    },
  );
  // initial assignments = schede that already contain this objective as a weighted item
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => {
    const out: Record<string, Assignment> = {};
    if (def)
      for (const s of schede) {
        const it = itemOf(s, def.id);
        if (it) out[s.id] = { weight: it.weight, levels: it.levels, base: it.base, relative: it.relative };
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
  const otherWeight = (s: Scheda) => s.items.filter((i) => !(def && !i.custom && i.objectiveId === def.id)).reduce((a, i) => a + (Number(i.weight) || 0), 0);

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
  // levels per activity: per-scheda target/payout overrides don't apply
  const perActivity = typeOf(draft) === "progetto" && !!draft.activityLevels;
  // levels in % of last year / of the target / fixed (relativeLevels option): no per-scheda levels;
  // when some level is a % of last year, each scheda sets that actual
  const relative = typeOf(draft) === "quantitativo" && (!!options.relativeLevels || !!draft.relative);
  const scaled: ObjectiveDef = relative ? { ...draft, relative: draft.relative ?? toRelative(draft.levels) } : draft;
  const withBase = !!scaled.relative && needsBase(scaled.relative);
  const nameError = submitted && !draft.name.trim() ? "Inserisci la descrizione dell'obiettivo" : null;
  const rowErrors: Record<string, string> = {};
  for (const [id, a] of Object.entries(assignments)) {
    if (!(a.weight > 0 && a.weight <= 100)) rowErrors[id] = "Il peso deve essere tra 1 e 100%";
    else if (relative) {
      const own = { ...scaled, relative: a.relative ?? scaled.relative };
      const e = (a.relative ? customError({ ...own, name: own.name || "-" }) : null) ?? baseError(own, a.base);
      if (e) rowErrors[id] = e;
    } else if (a.levels && !perActivity) {
      const e = levelsError(a.levels, typeOf(draft));
      if (e) rowErrors[id] = e;
    }
  }
  const patch = (p: Partial<ObjectiveDef>) => {
    setDraft((d) => ({ ...d, ...p }));
    // a new type has a different scale: per-scheda levels of the old type no longer apply
    if ((p.type && p.type !== typeOf(draft)) || p.activityLevels)
      setAssignments((a) => Object.fromEntries(Object.entries(a).map(([id, x]) => [id, { ...x, levels: undefined, relative: undefined }])));
  };

  const save = () => {
    setSubmitted(true);
    const firstRowError = Object.keys(rowErrors)[0];
    if (draftError || firstRowError) {
      if (firstRowError) setExpanded(firstRowError);
      notify(tr("Controlla i campi evidenziati"));
      return;
    }
    const data = {
      name: draft.name.trim(),
      description: draft.description?.trim() ?? "",
      type: typeOf(draft),
      activities: typeOf(draft) === "progetto" ? (draft.activities ?? []).map((x) => ({ ...x, title: x.title.trim() })).filter((x) => x.title) : undefined,
      weightedActivities: typeOf(draft) === "progetto" && draft.weightedActivities ? true : undefined,
      activityLevels: typeOf(draft) === "progetto" && draft.activityLevels ? true : undefined,
      relative: relative ? scaled.relative : undefined,
      lastYear: draft.lastYear != null && draft.lastYear > 0 ? draft.lastYear : undefined,
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
        const rel = relative ? a.relative : undefined;
        if (
          existing.weight === a.weight &&
          existing.base === a.base &&
          JSON.stringify(existing.levels) === JSON.stringify(a.levels) &&
          JSON.stringify(existing.relative) === JSON.stringify(rel)
        )
          continue;
        items = s.items.map((i) => (i === existing ? { ...i, weight: a.weight, levels: a.levels, base: a.base, relative: rel } : i));
      } else if (a) {
        items = [...s.items, { id: uid(), objectiveId, weight: a.weight, levels: a.levels, base: a.base, relative: relative ? a.relative : undefined }];
      } else {
        items = s.items.filter((i) => i !== existing);
      }
      updateScheda(s.id, { items });
      touched++;
    }
    notify(!def ? tr("Obiettivo creato") : touched ? tr("Obiettivo salvato · {0} schede aggiornate", [touched]) : tr("Obiettivo salvato"));
    router.push("/mbo/obiettivi");
  };

  const actions = (
    <div className="flex gap-2">
      <GhostButton onClick={() => router.push("/mbo/obiettivi")}>{tr("Annulla")}</GhostButton>
      <PrimaryButton onClick={save}>{def ? tr("Salva obiettivo") : tr("Crea obiettivo")}</PrimaryButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <Link href="/mbo/obiettivi" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />{" "}{tr("Obiettivi")}</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{def ? tr("Modifica obiettivo") : tr("Nuovo obiettivo")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{def ? def.name : tr("Misurazione, livelli e schede a cui assegnarlo")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="relative">
            <span className="sr-only">{tr("Anno o periodo di riferimento")}</span>
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <select
              className="h-9 rounded-lg border border-[#dfe3ea] bg-white pl-8 pr-2 text-[12.5px] font-semibold outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
              value={draft.cycle ?? "2026"}
              onChange={(e) => patch({ cycle: e.target.value })}
              title={tr("Anno o periodo di riferimento")}
            >
              {CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {tr(c.label)}
                </option>
              ))}
            </select>
          </label>
          {actions}
        </div>
      </div>

      <section className="card p-5">
        <SectionTitle n={1} title={tr("Obiettivo")} />
        <div className="grid gap-4">
          <Block label={tr("Descrizione obiettivo")} error={nameError ?? undefined}>
            <input
              autoFocus
              className={inputCls}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={tr("es. Lancio nuova linea prodotto")}
            />
          </Block>
          <Block label={tr("Livello")}>
            <ChoiceButtons
              label={tr("Livello")}
              options={CATEGORIES.map((c) => ({
                value: c,
                label: c,
                icon: CATEGORY_ICON[c] ?? Layers,
              }))}
              value={draft.category ?? CATEGORIES[0]}
              onChange={(category) => patch({ category })}
            />
          </Block>
          <Block label={tr("Dettagli")}>
            <textarea
              rows={2}
              className={`${inputCls} resize-y`}
              value={draft.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={tr("es. Ricavi netti da controllo di gestione, consuntivati a fine anno")}
            />
          </Block>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle n={2} title={tr("Misurazione e livelli standard")} />
        <CustomObjectiveEditor def={draft} onChange={patch} showName={false} lastYearField error={submitted && !nameError ? (draftError ?? undefined) : undefined} />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle n={3} title={tr("Assegnazione alle schede")} />
          <span className="text-[12px] font-semibold text-muted">
            {selectedIds.length} {selectedIds.length === 1 ? tr("scheda") : tr("schede")}
          </span>
        </div>
        <Block label={tr("Schede obiettivo")}>
          <MultiSelect
            options={schedaOptions}
            value={selectedIds}
            onChange={setSelection}
            placeholder={tr("Assegna l'obiettivo a una o più schede")}
            searchPlaceholder={tr("Cerca scheda o assegnatario…")}
            allLabel={tr("Seleziona tutte")}
            maxChips={4}
          />
        </Block>
        {thresholdIn > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-700">
            <Info className="h-3.5 w-3.5" />{" "}{tr("Usato anche come obiettivo soglia in {0} schede (si gestisce dalla scheda).", [thresholdIn])}</p>
        )}

        {selectedIds.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#dfe3ea] px-4 py-8 text-center">
            <p className="text-[13px] font-semibold">{tr("Nessuna scheda assegnata")}</p>
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
                          {s.assigneeIds.length > 1 && ` +${s.assigneeIds.length - 1}`} · {tr(cycleLabel(s.cycle))} ·{" "}
                          {perActivity ? (
                            tr("livelli per attività")
                          ) : relative ? (
                            <>
                            {a.relative && <span className="font-semibold text-violet-700">{tr("livelli personalizzati")} · </span>}
                            {(a.base ?? draft.lastYear ?? 0) > 0 ? (
                              tr("actual anno precedente {0}", [formatValue(draft, (a.base ?? draft.lastYear)!)])
                            ) : !withBase ? (
                              tr("livelli standard")
                            ) : (
                              <span className="font-semibold text-amber-700">{tr("manca l'actual anno precedente")}</span>
                            )}
                            </>
                          ) : a.levels ? (
                            <span className="font-semibold text-violet-700">{tr("livelli personalizzati")}</span>
                          ) : (
                            tr("livelli standard")
                          )}
                        </span>
                      </span>
                    </button>
                    <span className="text-[12px] font-semibold tabular-nums">{tr("Peso {0}%", [a.weight || 0])}</span>
                    <span
                      className={`rounded-full px-2 py-[2px] text-[11px] font-bold tabular-nums ${
                        total === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                      title={tr("Somma dei pesi di tutti gli obiettivi della scheda")}
                    >{tr("Totale {0}%", [total])}</span>
                    <button
                      type="button"
                      aria-label={tr("Rimuovi da {0}", [s.name])}
                      onClick={() => setSelection(selectedIds.filter((x) => x !== id))}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 border-t border-line px-3.5 py-3.5">
                      <div className="flex flex-wrap items-end gap-4">
                        <Block label={tr("Peso nella scheda")}>
                          <span className="relative block w-[110px]">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              className={`${inputCls} pr-7 text-right font-semibold tabular-nums`}
                              value={a.weight}
                              onChange={(ev) =>
                                patchAssignment(id, {
                                  weight: Number(ev.target.value),
                                })
                              }
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>
                          </span>
                        </Block>
                        <p className="pb-2 text-[11.5px] text-muted">{tr("Altri obiettivi della scheda: {0}%.", [otherWeight(s)])}{" "}{total !== 100 && tr("La scheda dovrà arrivare a 100% prima dell'approvazione.")}
                        </p>
                      </div>

                      {showBase(scaled, options.relativeLevels) && (
                        <div className="rounded-lg bg-canvas p-3">
                          <BaseInput
                            def={{ ...scaled, relative: a.relative ?? scaled.relative }}
                            value={a.base}
                            onChange={(base) => patchAssignment(id, { base })}
                          />
                        </div>
                      )}
                      {relative && scaled.relative && (
                        <div className="rounded-lg bg-canvas p-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                            {a.relative ? tr("Livelli di questa scheda") : tr("Livelli standard (modificali per questa scheda)")}
                          </p>
                          <RelativeLevelsEditor
                            value={a.relative ?? scaled.relative}
                            unit={draft.unit}
                            onChange={(r) => patchAssignment(id, { relative: r })}
                            extra={
                              a.relative ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => patchAssignment(id, { relative: undefined })}
                                    className="text-[12px] font-semibold text-muted hover:text-ink hover:underline"
                                  >
                                    {tr("Ripristina livelli standard")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // this scheda's scale becomes the objective's; schede with the same scale drop their override
                                      const std = a.relative!;
                                      patch(relativePatch(std));
                                      setAssignments((all) =>
                                        Object.fromEntries(
                                          Object.entries(all).map(([k, x]) => [k, JSON.stringify(x.relative) === JSON.stringify(std) ? { ...x, relative: undefined } : x]),
                                        ),
                                      );
                                      notify(tr("Livelli impostati come default: salva l'obiettivo per confermare"));
                                    }}
                                    className="text-[12px] font-semibold text-brand hover:underline"
                                  >
                                    {tr("Imposta come default dell'obiettivo")}
                                  </button>
                                </>
                              ) : undefined
                            }
                          />
                        </div>
                      )}
                      {!perActivity && !relative && (
                        <div className="space-y-3 rounded-lg bg-canvas p-3">
                          {["quantitativo", "qualitativo_pct", "progetto"].includes(typeOf(draft)) && (
                            <div className="max-w-[420px]">
                              <PresetPicker
                                hint=""
                                onApply={(pr) =>
                                  patchAssignment(id, {
                                    levels: pr.levels.map((l) => ({ ...l })),
                                  })
                                }
                              />
                            </div>
                          )}
                          <LevelsEditor
                            unit={draft.unit}
                            type={typeOf(draft)}
                            levels={lv}
                            onChange={(levels) => patchAssignment(id, { levels })}
                            extra={
                              a.levels ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // these levels become the objective's standard ones; schede with the same levels drop their override
                                    const std = a.levels!.map((l) => ({ ...l }));
                                    patch({ levels: std });
                                    setAssignments((all) =>
                                      Object.fromEntries(
                                        Object.entries(all).map(([k, x]) => [k, JSON.stringify(x.levels) === JSON.stringify(std) ? { ...x, levels: undefined } : x]),
                                      ),
                                    );
                                    notify(tr("Livelli impostati come default: salva l'obiettivo per confermare"));
                                  }}
                                  className="text-[12px] font-semibold text-brand hover:underline"
                                >
                                  {tr("Imposta come default dell'obiettivo")}
                                </button>
                              ) : undefined
                            }
                          />
                          {a.levels && (
                            <button
                              type="button"
                              onClick={() => patchAssignment(id, { levels: undefined })}
                              className="mt-2 ml-4 text-[12px] font-semibold text-muted hover:text-ink hover:underline"
                            >{tr("Ripristina livelli standard")}</button>
                          )}
                        </div>
                      )}
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
