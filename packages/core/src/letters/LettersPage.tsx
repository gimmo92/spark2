"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileText, Plus, RefreshCw, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { useCollection, useData } from "../data/DataProvider";
import { fullName, type User } from "../people/data";
import { useCore, useSparkConfig } from "../shell/SparkProvider";
import { MultiSelect } from "../ui/MultiSelect";
import { GhostButton, Modal, PrimaryButton, Tooltip, inputCls } from "../ui/ui";
import {
  CORE_LETTER_VARIABLES,
  DEFAULT_MARGINS,
  LETTER_CATEGORIES,
  coreLetterValues,
  unknownVariables,
  type LetterTemplate,
  type LetterValue,
  type LetterVariable,
} from "./data";
import { pdfUrl, renderLetter } from "./pdf";
import { tr } from "../i18n/i18n";

const MAX_PDF = 1.5 * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);
let seq = 0;
const newId = () => `lt${Date.now().toString(36)}${(seq++).toString(36)}`;

const STARTER = `{{data}}

Gentile **{{nome_completo}}**,

con la presente le comunichiamo …

Cordiali saluti

Direzione Risorse Umane`;

/** Variables (core + modules + client app) and how to fill them for a person. */
export function useLetterVariables() {
  const config = useSparkConfig();
  const { data } = useData();
  const [users] = useCollection<User>("users");
  const sources = useMemo(() => [...config.modules.flatMap((m) => (m.letters ? [m.letters] : [])), ...(config.letters ? [config.letters] : [])], [config]);
  const variables = useMemo<LetterVariable[]>(() => [...CORE_LETTER_VARIABLES, ...sources.flatMap((s) => s.variables)], [sources]);
  const valuesFor = (user: User): Record<string, LetterValue> => {
    const ctx = { user, users, data, orgName: config.org.name };
    return Object.assign(coreLetterValues(ctx), ...sources.map((s) => s.values(ctx)));
  };
  return { variables, valuesFor };
}

/** Azienda → Gestione Lettere: letter templates on the client's letterhead, with variables. */
export function LettersPage() {
  const { notify, hydrated } = useCore();
  const config = useSparkConfig();
  /** The app's example templates (demo seed), offered when there are none yet. */
  const examples = useMemo(() => (config.seed?.().letters ?? []) as LetterTemplate[], [config]);
  const [templates, setTemplates] = useCollection<LetterTemplate>("letters");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LetterTemplate | null>(null);

  const sorted = useMemo(() => [...templates].sort((a, b) => a.name.localeCompare(b.name, "it")), [templates]);
  const selected = sorted.find((t) => t.id === selectedId) ?? sorted[0];

  const create = (from?: LetterTemplate) => {
    const t: LetterTemplate = from
      ? { ...from, id: newId(), name: tr("{0} (copia)", [from.name]), updatedAt: today() }
      : {
          id: newId(),
          name: tr("Nuovo modello"),
          category: LETTER_CATEGORIES[0],
          body: STARTER,
          margins: { ...DEFAULT_MARGINS },
          fontSize: 10.5,
          updatedAt: today(),
        };
    setTemplates((prev) => [...prev, t]);
    setSelectedId(t.id);
    notify(tr(from ? "Modello duplicato" : "Modello creato"));
  };
  const save = (t: LetterTemplate) => {
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...t, updatedAt: today() } : x)));
    notify(tr("Modello salvato"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{tr("Gestione lettere")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("Modelli sulla carta intestata dell'azienda, compilati con i dati di ogni persona")}</p>
        </div>
        <PrimaryButton onClick={() => create()}>
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />{" "}{tr("Nuovo modello")}</PrimaryButton>
      </div>

      {!hydrated ? (
        <div className="card h-40 animate-pulse" />
      ) : !selected ? (
        <div className="card p-10 text-center">
          <FileText className="mx-auto h-6 w-6 text-faint" />
          <p className="mt-2 text-[14px] font-semibold">{tr("Nessun modello di lettera")}</p>
          <p className="mt-1 text-[12.5px] text-muted">{tr("Crea un modello, carica la carta intestata e scrivi il testo con le variabili.")}</p>
          {examples.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTemplates((prev) => [...prev, ...examples.filter((e) => !prev.some((p) => p.id === e.id))]);
                notify(tr("{0} modelli di esempio caricati", [examples.length]));
              }}
              className="mt-3 text-[12.5px] font-semibold text-brand hover:underline"
            >{tr("Carica i modelli di esempio")}</button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <section className="card self-start p-2">
            <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Modelli")}</p>
            <ul>
              {sorted.map((t) => {
                const active = t.id === selected.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={active ? "true" : undefined}
                      className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${active ? "bg-brand-soft text-brand" : "hover:bg-canvas"}`}
                    >
                      <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {tr(t.category ?? "Altro")}
                        {!t.letterhead?.first && tr(" · senza carta intestata")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <TemplateEditor key={selected.id} template={selected} onSave={save} onDuplicate={() => create(selected)} onDelete={() => setDeleting(selected)} />
        </div>
      )}

      {deleting && (
        <Modal
          title={tr("Eliminare il modello?")}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setTemplates((prev) => prev.filter((t) => t.id !== deleting.id));
                  setSelectedId(null);
                  setDeleting(null);
                  notify(tr("Modello eliminato"));
                }}
              >{tr("Elimina")}</PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] text-[#3f4757]">{tr("Il modello")}{" "}<strong>{deleting.name}</strong>{" "}{tr("e la sua carta intestata verranno eliminati. Le lettere già generate non cambiano.")}</p>
        </Modal>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onSave,
  onDuplicate,
  onDelete,
}: {
  template: LetterTemplate;
  onSave: (t: LetterTemplate) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(template);
  const dirty = JSON.stringify(draft) !== JSON.stringify(template);
  const patch = (p: Partial<LetterTemplate>) => setDraft((d) => ({ ...d, ...p }));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { variables } = useLetterVariables();
  const unknown = unknownVariables(draft.body, variables);

  const groups = useMemo(() => {
    const m = new Map<string, LetterVariable[]>();
    for (const v of variables) m.set(v.group, [...(m.get(v.group) ?? []), v]);
    return [...m];
  }, [variables]);

  /** Inserts {{key}} at the cursor (tables on a line of their own). */
  const insert = (v: LetterVariable) => {
    const el = bodyRef.current;
    const tag = `{{${v.key}}}`;
    const start = el?.selectionStart ?? draft.body.length;
    const end = el?.selectionEnd ?? start;
    const before = draft.body.slice(0, start);
    const after = draft.body.slice(end);
    const text = v.table ? `${before && !before.endsWith("\n") ? "\n" : ""}${tag}\n` : tag;
    patch({ body: before + text + after });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  return (
    <div className="min-w-0 space-y-4">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <Label text={tr("Nome del modello")}>
              <input className={inputCls} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </Label>
            <Label text={tr("Categoria")}>
              <select className={inputCls} value={draft.category ?? "Altro"} onChange={(e) => patch({ category: e.target.value })}>
                {LETTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tr(c)}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <div className="flex items-center gap-0.5 pt-5">
            <Tooltip label={tr("Duplica modello")}>
              <IconButton label={tr("Duplica modello")} onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
              </IconButton>
            </Tooltip>
            <Tooltip label={tr("Elimina modello")}>
              <IconButton label={tr("Elimina modello")} onClick={onDelete} danger>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <Label text={tr("Testo della lettera")}>
              <textarea
                ref={bodyRef}
                rows={18}
                spellCheck
                className={`${inputCls} resize-y font-mono text-[12.5px] leading-relaxed`}
                value={draft.body}
                onChange={(e) => patch({ body: e.target.value })}
              />
            </Label>
            <p className="mt-1.5 text-[11.5px] text-muted">{tr("Riga vuota = nuovo paragrafo ·")}{" "}<span className="font-mono">{tr("**testo**")}</span>{" "}{tr("= grassetto · le tabelle vanno su una riga da sole")}</p>
            {unknown.length > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
                <TriangleAlert className="h-3.5 w-3.5" />{" "}{tr("Variabili sconosciute: {0}", [unknown.map((k) => `{{${k}}}`).join(", ")])}</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Variabili")}</p>
              <div className="space-y-2.5 rounded-xl bg-canvas p-3">
                {groups.map(([g, vars]) => (
                  <div key={g}>
                    <p className="mb-1 text-[11px] font-semibold text-muted">{tr(g)}</p>
                    <div className="flex flex-wrap gap-1">
                      {vars.map((v) => (
                        <Tooltip key={v.key} label={tr("Inserisci {{{0}}}", [v.key])}>
                          <button
                            type="button"
                            onClick={() => insert(v)}
                            className="rounded-md border border-[#dfe3ea] bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-[#3f4757] hover:border-brand hover:text-brand"
                          >
                            {tr(v.label)}
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Carta intestata")}</p>
              <div className="space-y-2">
                <LetterheadField
                  label={tr("Prima pagina")}
                  name={draft.letterhead?.firstName}
                  src={draft.letterhead?.first}
                  onChange={(src, name) => patch({ letterhead: { ...draft.letterhead, first: src, firstName: name } })}
                />
                <LetterheadField
                  label={tr("Pagine successive")}
                  empty={tr("Come la prima pagina")}
                  name={draft.letterhead?.nextName}
                  src={draft.letterhead?.next}
                  onChange={(src, name) => patch({ letterhead: { ...draft.letterhead, next: src, nextName: name } })}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Area del testo (mm dal bordo)")}</p>
              <div className="grid grid-cols-3 gap-2">
                <Num label={tr("Sopra")} value={draft.margins.top} onChange={(top) => patch({ margins: { ...draft.margins, top } })} />
                <Num
                  label={tr("Sopra pag. 2+")}
                  value={draft.margins.topNext ?? draft.margins.top}
                  onChange={(topNext) => patch({ margins: { ...draft.margins, topNext } })}
                />
                <Num label={tr("Sotto")} value={draft.margins.bottom} onChange={(bottom) => patch({ margins: { ...draft.margins, bottom } })} />
                <Num label={tr("Sinistra")} value={draft.margins.left} onChange={(left) => patch({ margins: { ...draft.margins, left } })} />
                <Num label={tr("Destra")} value={draft.margins.right} onChange={(right) => patch({ margins: { ...draft.margins, right } })} />
                <Num label={tr("Testo (pt)")} value={draft.fontSize} step={0.5} onChange={(fontSize) => patch({ fontSize })} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
          <GhostButton onClick={() => setDraft(template)} disabled={!dirty}>{tr("Annulla modifiche")}</GhostButton>
          <PrimaryButton onClick={() => onSave(draft)} disabled={!dirty || !draft.name.trim()}>{tr("Salva modello")}</PrimaryButton>
        </div>
      </section>

      <Preview template={draft} />
    </div>
  );
}

/** Generates the letter for one person and shows the PDF. */
function Preview({ template }: { template: LetterTemplate }) {
  const [users] = useCollection<User>("users");
  const { valuesFor } = useLetterVariables();
  const people = useMemo(() => users.filter((u) => u.status !== "disattivato").sort((a, b) => fullName(a).localeCompare(fullName(b), "it")), [users]);
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = people.find((u) => u.id === personId);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const generate = async () => {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await renderLetter(template, valuesFor(person));
      setUrl(pdfUrl(bytes));
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : "Impossibile generare la lettera"));
    } finally {
      setBusy(false);
    }
  };

  const fileName = `${template.name} - ${person ? fullName(person) : "lettera"}.pdf`.replace(/[\\/:*?"<>|]/g, "");

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold">{tr("Anteprima")}</h2>
          <p className="text-[12px] text-muted">{tr("La lettera compilata con i dati della persona scelta (anche con le modifiche non salvate)")}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="w-[260px]">
            <MultiSelect
              multiple={false}
              options={people.map((u) => ({ value: u.id, label: fullName(u), hint: [u.role, u.team].filter(Boolean).join(" · ") }))}
              value={personId ? [personId] : []}
              onChange={(v) => setPersonId(v[0] ?? "")}
              placeholder={tr("Scegli una persona")}
              searchPlaceholder={tr("Cerca persona…")}
            />
          </div>
          <GhostButton onClick={generate} disabled={!person || busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> {url ? tr("Aggiorna") : tr("Genera anteprima")}
          </GhostButton>
          {url && (
            <a
              href={url}
              download={fileName}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white hover:bg-brand/90"
            >
              <Download className="h-3.5 w-3.5" />{" "}{tr("Scarica PDF")}</a>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
          <TriangleAlert className="h-3.5 w-3.5" /> {tr(error)}
        </p>
      )}
      {url ? (
        <iframe title={tr("Anteprima lettera")} src={url} className="mt-4 h-[760px] w-full rounded-lg border border-line bg-canvas" />
      ) : (
        <div className="mt-4 grid h-40 place-items-center rounded-lg border border-dashed border-[#dfe3ea] text-[12.5px] text-muted">{tr("Scegli una persona e genera l'anteprima")}</div>
      )}
    </section>
  );
}

function LetterheadField({
  label,
  empty = "Nessuna (pagina bianca)",
  name,
  src,
  onChange,
}: {
  label: string;
  empty?: string;
  name?: string;
  src?: string;
  onChange: (src: string | undefined, name: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") return setError(tr("Carica un file PDF"));
    if (file.size > MAX_PDF) return setError(tr("Il PDF supera 1,5 MB: esportalo compresso"));
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result), file.name);
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-lg border border-[#dfe3ea] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[11.5px] font-semibold text-muted">{label}</span>
          <span className="block truncate text-[12.5px] font-semibold">
            {src ? (name ?? tr("Carta intestata")) : <span className="font-normal text-faint">{tr(empty)}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <Tooltip label={src ? tr("Sostituisci PDF") : tr("Carica PDF")}>
            <IconButton label={src ? tr("Sostituisci PDF") : tr("Carica PDF")} onClick={() => ref.current?.click()}>
              <Upload className="h-4 w-4" />
            </IconButton>
          </Tooltip>
          {src && (
            <Tooltip label={tr("Rimuovi")}>
              <IconButton label={tr("Rimuovi")} onClick={() => onChange(undefined, undefined)} danger>
                <X className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          )}
        </span>
      </div>
      {error && <p className="mt-1 text-[11.5px] font-semibold text-red-600">{tr(error)}</p>}
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{text}</span>
      {children}
    </label>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block truncate text-[11px] text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        className={`${inputCls} px-2 text-right tabular-nums`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-soft hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
