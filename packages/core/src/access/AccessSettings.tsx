"use client";

import { useMemo, useState } from "react";
import { Check, Lock, Pencil, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { SettingsTabs } from "../shell/PageTabs";
import { useCore } from "../shell/SparkProvider";
import { Field, GhostButton, Modal, PrimaryButton, Switch, Tooltip, inputCls } from "../ui/ui";
import {
  ADMIN_LEVEL,
  SCOPE_HINTS,
  SCOPE_LABELS,
  defaultGrants,
  type AccessLevelDef,
  type Grant,
  type PermissionDef,
} from "./permissions";
import { useAccess } from "./useAccess";

/** Impostazioni → Permessi: access levels (built-in + custom) and their permissions as toggles. */
export function AccessSettings() {
  const { catalog, levels, setLevels } = useAccess();
  const { users, notify, hydrated } = useCore();
  const [selectedId, setSelectedId] = useState("MANAGER");
  const [editing, setEditing] = useState<AccessLevelDef | "new" | null>(null);
  const [deleting, setDeleting] = useState<AccessLevelDef | null>(null);

  const selected = levels.find((l) => l.id === selectedId) ?? levels[0];
  const isAdmin = selected.id === ADMIN_LEVEL;
  const grants = useMemo(() => new Set(selected.grants), [selected]);
  const countFor = (id: string) => users.filter((u) => u.level === id).length;

  const groups = useMemo(() => {
    const m = new Map<string, PermissionDef[]>();
    for (const p of catalog) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m];
  }, [catalog]);

  const update = (id: string, fn: (l: AccessLevelDef) => AccessLevelDef) => setLevels(levels.map((l) => (l.id === id ? fn(l) : l)));
  const toggle = (g: Grant, on: boolean) =>
    update(selected.id, (l) => ({ ...l, grants: on ? [...l.grants.filter((x) => x !== g), g] : l.grants.filter((x) => x !== g) }));

  const resetDefaults = () => {
    const base = selected.id === "MANAGER" || selected.id === "UTENTE" ? selected.id : (selected.base ?? "UTENTE");
    update(selected.id, (l) => ({ ...l, grants: defaultGrants(catalog, base) }));
    notify(`Permessi di ${selected.name} ripristinati`);
  };

  return (
    <div className="space-y-4">
      <SettingsTabs />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <section className="card self-start p-2">
          <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">Livelli di accesso</p>
          <ul>
            {levels.map((l) => {
              const active = l.id === selected.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active ? "bg-brand-soft text-brand" : "hover:bg-canvas"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{l.name}</span>
                      <span className="block text-[11.5px] text-muted">
                        {hydrated ? `${countFor(l.id)} ${countFor(l.id) === 1 ? "utente" : "utenti"}` : "…"}
                        {!l.system && " · personalizzato"}
                      </span>
                    </span>
                    {l.id === ADMIN_LEVEL && <Lock className="h-3.5 w-3.5 shrink-0 text-faint" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-brand transition-colors hover:bg-canvas"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuovo livello
          </button>
        </section>

        <section className="card min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold">{selected.name}</h2>
              {selected.description && <p className="mt-0.5 max-w-xl text-[12.5px] text-muted">{selected.description}</p>}
            </div>
            {!isAdmin && (
              <div className="flex items-center gap-0.5">
                <Tooltip label="Ripristina i permessi predefiniti">
                  <IconButton onClick={resetDefaults} label="Ripristina i permessi predefiniti">
                    <RotateCcw className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
                <Tooltip label="Rinomina">
                  <IconButton onClick={() => setEditing(selected)} label="Rinomina">
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
                {!selected.system && (
                  <Tooltip label="Elimina livello">
                    <IconButton onClick={() => setDeleting(selected)} label="Elimina livello" danger>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {isAdmin && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-[12.5px] text-brand">
              <ShieldCheck className="h-4 w-4 shrink-0" /> L&apos;Admin ha sempre tutti i permessi: non si possono togliere, così
              l&apos;organizzazione non resta mai senza chi la gestisce.
            </p>
          )}

          <div className="mt-4 space-y-5">
            {groups.map(([group, perms]) => (
              <div key={group}>
                <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{group}</h3>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {perms.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{p.label}</p>
                        {p.hint && <p className="text-[11.5px] text-muted">{p.hint}</p>}
                      </div>
                      {p.scopes ? (
                        <div className="flex flex-wrap gap-1" role="group" aria-label={p.label}>
                          {p.scopes.map((s) => {
                            const g = `${p.id}:${s}`;
                            const on = grants.has(g);
                            return (
                              <Tooltip key={s} label={SCOPE_HINTS[s]}>
                                <button
                                  type="button"
                                  aria-pressed={on}
                                  disabled={isAdmin}
                                  onClick={() => toggle(g, !on)}
                                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed ${
                                    on ? "border-brand bg-brand-soft text-brand" : "border-[#dfe3ea] text-muted hover:border-[#c6ccd6] hover:text-ink"
                                  } ${isAdmin ? "opacity-60" : ""}`}
                                >
                                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                                  {SCOPE_LABELS[s]}
                                </button>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <Switch checked={grants.has(p.id)} onChange={(v) => toggle(p.id, v)} disabled={isAdmin} label={p.label} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editing && (
        <LevelModal
          level={editing === "new" ? undefined : editing}
          levels={levels}
          onClose={() => setEditing(null)}
          onSave={(l, isNew) => {
            setLevels(isNew ? [...levels, l] : levels.map((x) => (x.id === l.id ? l : x)));
            if (isNew) setSelectedId(l.id);
            notify(isNew ? `Livello ${l.name} creato` : "Livello aggiornato");
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Elimina livello"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>Annulla</GhostButton>
              <PrimaryButton
                disabled={countFor(deleting.id) > 0}
                onClick={() => {
                  setLevels(levels.filter((l) => l.id !== deleting.id));
                  setSelectedId("MANAGER");
                  notify(`Livello ${deleting.name} eliminato`);
                  setDeleting(null);
                }}
              >
                Elimina
              </PrimaryButton>
            </>
          }
        >
          {countFor(deleting.id) > 0 ? (
            <p className="text-[13px]">
              <span className="font-semibold">{deleting.name}</span> è assegnato a {countFor(deleting.id)}{" "}
              {countFor(deleting.id) === 1 ? "utente" : "utenti"}. Assegna prima un altro livello da Lista Utenti, poi eliminalo.
            </p>
          ) : (
            <p className="text-[13px]">
              Eliminare il livello <span className="font-semibold">{deleting.name}</span>? Nessun utente lo usa.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function IconButton({ onClick, label, danger, children }: { onClick: () => void; label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas ${danger ? "hover:text-red-600" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function LevelModal({
  level,
  levels,
  onClose,
  onSave,
}: {
  level?: AccessLevelDef;
  levels: AccessLevelDef[];
  onClose: () => void;
  onSave: (l: AccessLevelDef, isNew: boolean) => void;
}) {
  const [name, setName] = useState(level?.name ?? "");
  const [description, setDescription] = useState(level?.description ?? "");
  const [from, setFrom] = useState("UTENTE");
  const [submitted, setSubmitted] = useState(false);

  const clean = name.trim();
  const error = !clean
    ? "Inserisci un nome"
    : levels.some((l) => l.id !== level?.id && l.name.toLowerCase() === clean.toLowerCase())
      ? "Esiste già un livello con questo nome"
      : undefined;

  const save = () => {
    setSubmitted(true);
    if (error) return;
    if (level) return onSave({ ...level, name: clean, description: description.trim() || undefined }, false);
    const source = levels.find((l) => l.id === from)!;
    const base = from === "MANAGER" || from === "UTENTE" ? from : from === ADMIN_LEVEL ? "MANAGER" : (source.base ?? "UTENTE");
    onSave(
      { id: `L${Date.now()}`, name: clean, description: description.trim() || undefined, base, grants: [...source.grants], known: source.known },
      true,
    );
  };

  return (
    <Modal
      title={level ? "Modifica livello" : "Nuovo livello di accesso"}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Annulla</GhostButton>
          <PrimaryButton onClick={save}>{level ? "Salva" : "Crea livello"}</PrimaryButton>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Nome" error={submitted ? error : undefined}>
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="es. HR Business Partner" />
        </Field>
        <Field label="Descrizione">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Facoltativa" />
        </Field>
        {!level && (
          <Field label="Parti dai permessi di">
            <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
