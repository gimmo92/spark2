"use client";

import { useOrg } from "@spark/core";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Copy, Trash2, TriangleAlert } from "lucide-react";

import { CYCLES } from "../lib/mbo";
import { useMbo } from "../store";
import {
  LETTER_TEMPLATES,
  ROLES,
  TASK_TYPES,
  WORKFLOW_STATUSES,
  newTask,
  outOfOrder,
  taskId,
  taskType,
  type Role,
  type TaskType,
  type Workflow,
  type WorkflowStatus,
  type WorkflowTask,
} from "../lib/workflow";
import { MultiSelect } from "@spark/core";
import { Block, SectionTitle } from "./SchedaEditor";
import { GhostButton, PrimaryButton, Switch, Tooltip, inputCls } from "@spark/core";
import { TASK_ICON, TaskIcon } from "./WorkflowList";

/** Route entry: /mbo/workflow/[id] (edit) or /mbo/workflow/nuovo (create). */
export function WorkflowEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { workflows, hydrated } = useMbo();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return <WorkflowEditor key="new" />;
  const wf = workflows.find((w) => w.id === params.id);
  if (!wf)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">Workflow non trovato</p>
        <Link href="/mbo/workflow" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
          Torna ai workflow
        </Link>
      </div>
    );
  return <WorkflowEditor key={wf.id} wf={wf} />;
}

const roleOptions = ROLES.map((r) => ({ value: r.value, label: r.label }));

function WorkflowEditor({ wf }: { wf?: Workflow }) {
  const { companies: COMPANIES } = useOrg();
  const router = useRouter();
  const { saveWorkflow, notify } = useMbo();
  const [name, setName] = useState(wf?.name ?? "");
  const [description, setDescription] = useState(wf?.description ?? "");
  const [cycle, setCycle] = useState(wf?.cycle ?? "2026");
  const [status, setStatus] = useState<WorkflowStatus>(wf?.status === "archiviato" ? "bozza" : (wf?.status ?? "bozza"));
  const [companies, setCompanies] = useState<string[]>(wf?.companies ?? []);
  const [tasks, setTasks] = useState<WorkflowTask[]>(
    wf?.tasks ?? [newTask("definizione"), newTask("approvazione"), newTask("consuntivazione"), newTask("lettera")],
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const patchTask = (id: string, p: Partial<WorkflowTask>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const move = (i: number, dir: -1 | 1) =>
    setTasks((ts) => {
      const j = i + dir;
      if (j < 0 || j >= ts.length) return ts;
      const next = [...ts];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (type: TaskType) => {
    const t = newTask(type);
    setTasks((ts) => [...ts, t]);
    setExpanded(t.id);
  };

  // validation
  const taskErrors: Record<string, string> = {};
  for (const t of tasks) {
    if (!t.title.trim()) taskErrors[t.id] = "Inserisci il nome del task";
    else if (t.type === "approvazione" && !t.approvers?.length) taskErrors[t.id] = "Seleziona almeno un approvatore";
    else if (t.type === "lettera" && !t.signers?.length) taskErrors[t.id] = "Seleziona chi deve firmare";
  }
  const nameError = name.trim() ? null : "Inserisci il nome del workflow";
  const tasksError = tasks.length ? null : "Aggiungi almeno un task";
  const badOrder = outOfOrder(tasks);
  const show = (e?: string | null) => (submitted ? e : null);

  const save = () => {
    setSubmitted(true);
    const firstBad = tasks.find((t) => taskErrors[t.id]);
    if (nameError || tasksError || firstBad) {
      if (firstBad) setExpanded(firstBad.id);
      notify("Controlla i campi evidenziati");
      return;
    }
    saveWorkflow({ id: wf?.id, name: name.trim(), description: description.trim(), cycle, status, companies, tasks });
    notify(wf ? "Workflow salvato" : "Workflow creato");
    router.push("/mbo/workflow");
  };

  const actions = (
    <div className="flex gap-2">
      <GhostButton onClick={() => router.push("/mbo/workflow")}>Annulla</GhostButton>
      <PrimaryButton onClick={save}>{wf ? "Salva workflow" : "Crea workflow"}</PrimaryButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <Link href="/mbo/workflow" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Workflow
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{wf ? "Modifica workflow" : "Nuovo workflow"}</h1>
          {wf && <p className="mt-0.5 text-[12.5px] text-muted">{wf.name}</p>}
        </div>
        {actions}
      </div>

      {/* 1. General */}
      <section className="card p-5">
        <SectionTitle n={1} title="Informazioni generali" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Block label="Nome workflow" error={show(nameError) ?? undefined} className="sm:col-span-2">
            <input
              className={`${inputCls} ${show(nameError) ? "border-red-300" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. MBO 2026 · Standard"
            />
          </Block>
          <Block label="Descrizione" className="sm:col-span-2">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A chi si applica e quando" />
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
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as WorkflowStatus)}>
              {WORKFLOW_STATUSES.filter((s) => s.value !== "archiviato").map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Block>
          <Block label="Società" hint={companies.length ? `${companies.length} selezionate` : "Vuoto = tutte le società"} className="sm:col-span-2">
            <MultiSelect
              options={COMPANIES.map((c) => ({ value: c, label: c }))}
              value={companies}
              onChange={setCompanies}
              placeholder="Tutte le società"
              searchPlaceholder="Cerca società…"
            />
          </Block>
        </div>
      </section>

      {/* 2. Tasks */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle n={2} title="Fasi del workflow" />
          <span className="text-[12px] font-semibold text-muted">
            {tasks.length} {tasks.length === 1 ? "task" : "task"}
          </span>
        </div>

        {show(tasksError) && (
          <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> {tasksError}
          </p>
        )}

        <ol className="space-y-0">
          {tasks.map((t, i) => {
            const isOpen = expanded === t.id;
            const err = show(taskErrors[t.id]);
            const late = badOrder.has(i);
            return (
              <li key={t.id} className="relative pb-3 pl-11 last:pb-0">
                {/* timeline rail */}
                {i < tasks.length - 1 && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-[#e3e7ee]" />}
                <span className="absolute left-0 top-1.5">
                  <TaskIcon type={t.type} />
                </span>

                <div className={`rounded-xl border bg-white ${err ? "border-red-300" : "border-line"}`}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : t.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">
                          {i + 1}. {t.title || "Task senza nome"}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {taskType(t.type).label} · {ROLES.find((r) => r.value === t.owner)?.label}
                          {t.dueDate ? ` · entro il ${new Date(t.dueDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}` : " · senza scadenza"}
                        </span>
                      </span>
                    </button>
                    {late && (
                      <Tooltip label="Scadenza precedente a quella di un task prima">
                        <span className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-[1px] text-[10.5px] font-bold text-amber-700">
                          <TriangleAlert className="h-3 w-3" /> Ordine date
                        </span>
                      </Tooltip>
                    )}
                    <div className="flex items-center">
                      <SmallBtn label="Sposta su" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </SmallBtn>
                      <SmallBtn label="Sposta giù" onClick={() => move(i, 1)} disabled={i === tasks.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </SmallBtn>
                      <SmallBtn
                        label="Duplica"
                        onClick={() =>
                          setTasks((ts) => {
                            const copy = { ...t, id: taskId(), title: `${t.title} (copia)` };
                            const next = [...ts];
                            next.splice(i + 1, 0, copy);
                            return next;
                          })
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </SmallBtn>
                      <SmallBtn label="Elimina" danger onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </SmallBtn>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 border-t border-line px-3.5 py-3.5">
                      <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
                        <Block label="Nome task">
                          <input className={inputCls} value={t.title} onChange={(e) => patchTask(t.id, { title: e.target.value })} />
                        </Block>
                        <Block label="Responsabile">
                          <select className={inputCls} value={t.owner} onChange={(e) => patchTask(t.id, { owner: e.target.value as Role })}>
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </Block>
                        <Block label="Scadenza">
                          <input type="date" className={inputCls} value={t.dueDate ?? ""} onChange={(e) => patchTask(t.id, { dueDate: e.target.value || undefined })} />
                        </Block>
                      </div>

                      <TypeSettings task={t} onChange={(p) => patchTask(t.id, p)} />

                      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                        <Block label="Promemoria">
                          <select
                            className={inputCls}
                            value={t.reminderDays ?? 0}
                            onChange={(e) => patchTask(t.id, { reminderDays: Number(e.target.value) })}
                          >
                            <option value={0}>Nessuno</option>
                            {[1, 3, 7, 14].map((d) => (
                              <option key={d} value={d}>
                                {d} {d === 1 ? "giorno" : "giorni"} prima
                              </option>
                            ))}
                          </select>
                        </Block>
                        <Block label="Istruzioni per chi svolge il task">
                          <input
                            className={inputCls}
                            value={t.notes ?? ""}
                            onChange={(e) => patchTask(t.id, { notes: e.target.value })}
                            placeholder="Facoltative, visibili nella notifica"
                          />
                        </Block>
                      </div>

                      {err && (
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
                          <TriangleAlert className="h-3.5 w-3.5" /> {err}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* add task */}
        <div className="mt-4 rounded-xl border border-dashed border-[#d5dae2] p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Aggiungi task</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TASK_TYPES.map((tt) => {
              const Icon = TASK_ICON[tt.value];
              return (
                <Tooltip key={tt.value} label={tt.description} className="flex">
                  <button
                    type="button"
                    onClick={() => add(tt.value)}
                    className="flex w-full items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: `${tt.color}1f`, color: tt.color }}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    {tt.label}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex justify-end">{actions}</div>
    </div>
  );
}

/** Settings that depend on the task type. */
function TypeSettings({ task: t, onChange }: { task: WorkflowTask; onChange: (p: Partial<WorkflowTask>) => void }) {
  if (t.type === "definizione")
    return (
      <Toggle
        checked={!!t.allowEmployeeProposal}
        onChange={(v) => onChange({ allowEmployeeProposal: v })}
        title="Il dipendente può proporre i propri obiettivi"
        hint="La proposta va poi confermata dal responsabile del task."
      />
    );

  if (t.type === "approvazione")
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <Block label="Approvatori">
            <MultiSelect
              options={roleOptions}
              value={t.approvers ?? []}
              onChange={(v) => onChange({ approvers: v as Role[] })}
              placeholder="Chi approva"
              searchPlaceholder="Cerca ruolo…"
            />
          </Block>
          <Block label="Regola di approvazione">
            <select
              className={inputCls}
              value={t.approvalMode ?? "tutti"}
              onChange={(e) => onChange({ approvalMode: e.target.value as WorkflowTask["approvalMode"] })}
            >
              <option value="tutti">Devono approvare tutti</option>
              <option value="almeno_uno">Basta un approvatore</option>
            </select>
          </Block>
        </div>
        <Toggle
          checked={!!t.allowChangeRequests}
          onChange={(v) => onChange({ allowChangeRequests: v })}
          title="Gli approvatori possono chiedere modifiche"
          hint="La scheda torna alla fase di definizione con un commento."
        />
      </div>
    );

  if (t.type === "consuntivazione")
    return (
      <div className="space-y-3">
        <Toggle
          checked={!!t.requireEvidence}
          onChange={(v) => onChange({ requireEvidence: v })}
          title="Richiedi evidenze o allegati"
          hint="Ogni risultato inserito deve avere un documento o una nota a supporto."
        />
        <Toggle
          checked={!!t.requireReview}
          onChange={(v) => onChange({ requireReview: v })}
          title="Revisione HR dei consuntivi"
          hint="HR verifica i risultati prima del calcolo del payout."
        />
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Block label="Modello di lettera">
          <select className={inputCls} value={t.letterTemplate ?? LETTER_TEMPLATES[0]} onChange={(e) => onChange({ letterTemplate: e.target.value })}>
            {LETTER_TEMPLATES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Block>
        <Block label="Firmatari">
          <MultiSelect
            options={roleOptions}
            value={t.signers ?? []}
            onChange={(v) => onChange({ signers: v as Role[] })}
            placeholder="Chi firma"
            searchPlaceholder="Cerca ruolo…"
          />
        </Block>
      </div>
      <Toggle
        checked={!!t.autoSend}
        onChange={(v) => onChange({ autoSend: v })}
        title="Invio automatico via email"
        hint="La lettera parte appena si apre il task, con il link per firmare."
      />
      <Toggle
        checked={!!t.electronicSignature}
        onChange={(v) => onChange({ electronicSignature: v })}
        title="Firma elettronica"
        hint="Se disattivata, la lettera firmata va caricata a mano."
      />
    </div>
  );
}

function Toggle({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <Switch checked={checked} onChange={onChange} />
      <span>
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[12px] text-muted">{hint}</span>
      </span>
    </label>
  );
}

function SmallBtn({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`grid h-7 w-7 place-items-center rounded-md text-muted transition-colors disabled:pointer-events-none disabled:opacity-30 ${
          danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-canvas hover:text-ink"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
