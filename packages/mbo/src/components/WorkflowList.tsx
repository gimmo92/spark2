"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, BadgeCheck, CalendarDays, CircleDot, ClipboardCheck, CopyPlus, Eye, FileSignature, Pencil, Plus, Search, Target } from "lucide-react";
import { YEARS, cycleLabel, cycleYear } from "../lib/mbo";
import { useLetterTemplates, useMbo } from "../store";
import {
  WORKFLOW_STATUSES,
  nextTask,
  roleLabel,
  taskType,
  type TaskType,
  type Workflow,
  type WorkflowStatus,
  type WorkflowTask,
} from "../lib/workflow";
import { FilterMenu, GhostButton, Modal, PrimaryButton, Tooltip } from "@spark/core";

export const TASK_ICON: Record<TaskType, typeof Target> = {
  definizione: Target,
  approvazione: BadgeCheck,
  consuntivazione: ClipboardCheck,
  lettera: FileSignature,
};

const STATUS_STYLE: Record<WorkflowStatus, string> = {
  bozza: "bg-[#eef1f5] text-[#5b6476]",
  attivo: "bg-emerald-50 text-emerald-700",
  archiviato: "bg-[#f1f2f4] text-faint",
};

export function WorkflowStatusPill({ status }: { status: WorkflowStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      {WORKFLOW_STATUSES.find((s) => s.value === status)?.label}
    </span>
  );
}

export function TaskIcon({ type, size = "md" }: { type: TaskType; size?: "sm" | "md" }) {
  const Icon = TASK_ICON[type];
  const { color } = taskType(type);
  const box = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-lg`} style={{ background: `${color}1f`, color }}>
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.2} />
    </span>
  );
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/** Compact pipeline: one icon per task, in order, joined by a line. */
function Pipeline({ tasks }: { tasks: WorkflowTask[] }) {
  return (
    <div className="flex items-center">
      {tasks.map((t, i) => (
        <span key={t.id} className="flex items-center">
          {i > 0 && <span className="h-px w-2.5 bg-[#d5dae2]" />}
          <Tooltip label={`${i + 1}. ${t.title}${t.dueDate ? ` · ${fmtDate(t.dueDate)}` : ""}`}>
            <span>
              <TaskIcon type={t.type} size="sm" />
            </span>
          </Tooltip>
        </span>
      ))}
    </div>
  );
}

export function WorkflowList() {
  const router = useRouter();
  const { workflows, saveWorkflow, updateWorkflow, notify, hydrated } = useMbo();
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Workflow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workflows
      .filter((w) => (status ? w.status === status : w.status !== "archiviato"))
      .filter((w) => !year || cycleYear(w.cycle) === Number(year))
      .filter((w) => !needle || `${w.name} ${w.description}`.toLowerCase().includes(needle))
      .sort((a, b) => b.cycle.localeCompare(a.cycle) || a.name.localeCompare(b.name, "it"));
  }, [workflows, year, status, q]);

  const duplicate = (w: Workflow) => {
    const copy = saveWorkflow({
      ...w,
      id: undefined,
      name: `${w.name} (copia)`,
      status: "bozza",
      tasks: w.tasks.map((t, i) => ({ ...t, id: `${t.id}-c${Date.now().toString(36)}${i}` })),
    });
    notify("Workflow duplicato come bozza");
    router.push(`/mbo/workflow/${copy.id}`);
  };

  const viewed = viewing ? workflows.find((w) => w.id === viewing) : undefined;
  const anyFilter = year || status || q;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="sr-only">Workflow</h1>
        <Link
          href="/mbo/workflow/nuovo"
          className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white sm:px-5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuovo workflow
        </Link>
        <div className="relative ml-auto w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca workflow..."
            aria-label="Cerca workflow"
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<CalendarDays className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Anno"
          activeLabel="Anno"
          value={year}
          onChange={setYear}
          options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <FilterMenu
          icon={<CircleDot className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Stato"
          activeLabel="Stato"
          value={status}
          onChange={setStatus}
          options={WORKFLOW_STATUSES}
        />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setYear("");
              setStatus("");
              setQ("");
            }}
            className="px-2 py-1.5 text-[12.5px] font-semibold text-brand hover:underline"
          >
            Azzera
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">Workflow</th>
              <th className="px-3 py-2.5">Ciclo</th>
              <th className="px-3 py-2.5">Fasi</th>
              <th className="px-3 py-2.5">Prossima scadenza</th>
              <th className="px-3 py-2.5">Stato</th>
              <th className="sticky right-0 w-[136px] border-l border-line bg-white px-3 py-2.5">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <div className="h-24 animate-pulse rounded-lg bg-canvas" />
                </td>
              </tr>
            ) : (
              rows.map((w) => {
                const nt = nextTask(w);
                return (
                  <tr key={w.id} className={`group border-b border-line last:border-0 hover:bg-[#f8fafd] ${w.status === "archiviato" ? "opacity-60" : ""}`}>
                    <td className="px-3 py-[9px] pl-4">
                      <button type="button" onClick={() => setViewing(w.id)} className="block text-left">
                        <span className="block max-w-[320px] truncate text-[13.5px] font-semibold text-brand hover:underline">{w.name}</span>
                        <span className="block max-w-[320px] truncate text-[11.5px] text-muted">
                          {w.companies.length ? w.companies.join(", ") : "Tutte le società"}
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{cycleLabel(w.cycle)}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <Pipeline tasks={w.tasks} />
                        <span className="text-[11.5px] text-muted">{w.tasks.length}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      {nt ? (
                        <span className="block">
                          <span className="block max-w-[200px] truncate text-[12.5px] font-semibold">{nt.title}</span>
                          <span className="block text-[11.5px] text-muted">{fmtDate(nt.dueDate)}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-faint">Nessuna</span>
                      )}
                    </td>
                    <td className="px-3">
                      <WorkflowStatusPill status={w.status} />
                    </td>
                    <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                      <div className="flex items-center gap-0.5">
                        <IconBtn label="Visualizza" onClick={() => setViewing(w.id)}>
                          <Eye className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                        <IconBtn label="Modifica" onClick={() => router.push(`/mbo/workflow/${w.id}`)} disabled={w.status === "archiviato"}>
                          <Pencil className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                        <IconBtn label="Duplica" onClick={() => duplicate(w)}>
                          <CopyPlus className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                        {w.status === "archiviato" ? (
                          <IconBtn
                            label="Ripristina"
                            onClick={() => {
                              updateWorkflow(w.id, { status: "bozza" });
                              notify("Workflow ripristinato come bozza");
                            }}
                          >
                            <ArchiveRestore className="h-4 w-4" strokeWidth={2.2} />
                          </IconBtn>
                        ) : (
                          <IconBtn label="Archivia" onClick={() => setArchiving(w)} danger>
                            <Archive className="h-4 w-4" strokeWidth={2.2} />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {hydrated && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-[14px] font-semibold">Nessun workflow trovato</p>
                  <p className="mt-1 text-[12.5px] text-muted">Prova a modificare i filtri o crea un nuovo workflow.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewed && <WorkflowView w={viewed} onClose={() => setViewing(null)} onEdit={() => router.push(`/mbo/workflow/${viewed.id}`)} />}

      {archiving && (
        <Modal
          title="Archiviare il workflow?"
          onClose={() => setArchiving(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setArchiving(null)}>Annulla</GhostButton>
              <PrimaryButton
                onClick={() => {
                  updateWorkflow(archiving.id, { status: "archiviato" });
                  notify("Workflow archiviato");
                  setArchiving(null);
                }}
              >
                Archivia
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{archiving.name}</span> non sarà più modificabile. Potrai ripristinarlo dal filtro{" "}
            <em>Stato: Archiviato</em>.
          </p>
        </Modal>
      )}
    </div>
  );
}

function WorkflowView({ w, onClose, onEdit }: { w: Workflow; onClose: () => void; onEdit: () => void }) {
  const { letterName } = useLetterTemplates();
  return (
    <Modal
      title={w.name}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Chiudi</GhostButton>
          {w.status !== "archiviato" && <PrimaryButton onClick={onEdit}>Modifica</PrimaryButton>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <WorkflowStatusPill status={w.status} />
        <span className="text-muted">{cycleLabel(w.cycle)}</span>
        <span className="text-muted">· {w.companies.length ? w.companies.join(", ") : "Tutte le società"}</span>
      </div>
      {w.description && <p className="mt-3 text-[13px] text-[#3f4757]">{w.description}</p>}
      <ol className="mt-5">
        {w.tasks.map((t, i) => (
          <li key={t.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < w.tasks.length - 1 && <span className="absolute left-4 top-9 bottom-0 w-px bg-[#e3e7ee]" />}
            <TaskIcon type={t.type} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[13px] font-semibold">
                  {i + 1}. {t.title}
                </p>
                <span className="text-[12px] tabular-nums text-muted">{fmtDate(t.dueDate)}</span>
              </div>
              <p className="text-[12px] text-muted">
                {taskType(t.type).label} · Responsabile: {roleLabel(t.owner)}
                {t.type === "approvazione" && t.approvers?.length
                  ? ` · Approvano: ${t.approvers.map(roleLabel).join(", ")} (${t.approvalMode === "almeno_uno" ? "almeno uno" : "tutti"})`
                  : ""}
                {t.type === "lettera" ? ` · ${letterName(t.letterTemplate)} · Firmano: ${(t.signers ?? []).map(roleLabel).join(", ") || "—"}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors disabled:pointer-events-none disabled:opacity-30 ${
          danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-soft hover:text-brand"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
