/** MBO workflows: an ordered list of tasks a cycle goes through (define → approve → measure → letter). */

export type TaskType = "definizione" | "approvazione" | "consuntivazione" | "lettera";
export type Role = "dipendente" | "responsabile" | "hr" | "direzione" | "admin";
export type WorkflowStatus = "bozza" | "attivo" | "archiviato";

export interface WorkflowTask {
  id: string;
  type: TaskType;
  title: string;
  owner: Role;
  dueDate?: string; // yyyy-mm-dd
  reminderDays?: number; // remind N days before the due date (0 = off)
  notes?: string;
  // definizione
  allowEmployeeProposal?: boolean;
  // approvazione
  approvers?: Role[];
  approvalMode?: "tutti" | "almeno_uno";
  allowChangeRequests?: boolean;
  // consuntivazione
  requireEvidence?: boolean;
  requireReview?: boolean;
  // lettera
  letterTemplate?: string;
  signers?: Role[];
  electronicSignature?: boolean;
  autoSend?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  cycle: string;
  status: WorkflowStatus;
  /** Companies the workflow applies to; empty = all. */
  companies: string[];
  tasks: WorkflowTask[];
  updatedAt: string;
}

export const TASK_TYPES: { value: TaskType; label: string; short: string; color: string; description: string }[] = [
  { value: "definizione", label: "Definizione obiettivi", short: "Definizione", color: "#2a78d6", description: "Chi assegna gli obiettivi e i pesi nelle schede." },
  { value: "approvazione", label: "Approvazione obiettivi", short: "Approvazione", color: "#eb6834", description: "Chi approva le schede prima che diventino definitive." },
  { value: "consuntivazione", label: "Consuntivazione obiettivi", short: "Consuntivazione", color: "#1baf7a", description: "Chi inserisce i risultati raggiunti a fine periodo." },
  { value: "lettera", label: "Invio e firma lettera", short: "Lettera", color: "#eda100", description: "Invio della lettera al dipendente e raccolta delle firme." },
];
export const taskType = (t: TaskType) => TASK_TYPES.find((x) => x.value === t)!;

export const ROLES: { value: Role; label: string }[] = [
  { value: "dipendente", label: "Dipendente" },
  { value: "responsabile", label: "Responsabile diretto" },
  { value: "hr", label: "HR" },
  { value: "direzione", label: "Direzione" },
  { value: "admin", label: "Amministratore" },
];
export const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

export const WORKFLOW_STATUSES: { value: WorkflowStatus; label: string }[] = [
  { value: "bozza", label: "Bozza" },
  { value: "attivo", label: "Attivo" },
  { value: "archiviato", label: "Archiviato" },
];

export const LETTER_TEMPLATES = [
  "Lettera di assegnazione obiettivi",
  "Lettera di consuntivazione MBO",
  "Lettera di comunicazione premio",
];

let seq = 0;
export const taskId = () => `wt${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Sensible defaults for a new task of the given type. */
export function newTask(type: TaskType): WorkflowTask {
  const base = { id: taskId(), type, title: taskType(type).label, reminderDays: 3 };
  switch (type) {
    case "definizione":
      return { ...base, owner: "responsabile", allowEmployeeProposal: false };
    case "approvazione":
      return { ...base, owner: "responsabile", approvers: ["responsabile", "hr"], approvalMode: "tutti", allowChangeRequests: true };
    case "consuntivazione":
      return { ...base, owner: "responsabile", requireEvidence: false, requireReview: true };
    case "lettera":
      return {
        ...base,
        owner: "hr",
        letterTemplate: LETTER_TEMPLATES[0],
        signers: ["dipendente"],
        electronicSignature: true,
        autoSend: true,
      };
  }
}

const t = (type: TaskType, patch: Partial<WorkflowTask>, id: string): WorkflowTask => ({ ...newTask(type), ...patch, id });

export const SEED_WORKFLOWS: Workflow[] = [
  {
    id: "wf-standard-2026",
    name: "MBO 2026 · Standard",
    description: "Processo annuale per tutti i dipendenti con scheda MBO.",
    cycle: "2026",
    status: "attivo",
    companies: [],
    updatedAt: "2026-01-10",
    tasks: [
      t("definizione", { dueDate: "2026-01-31" }, "s1"),
      t("approvazione", { dueDate: "2026-02-15" }, "s2"),
      t("lettera", { title: "Invio lettera obiettivi", dueDate: "2026-02-28" }, "s3"),
      t("consuntivazione", { dueDate: "2027-01-31", requireEvidence: true }, "s4"),
      t(
        "lettera",
        { title: "Lettera premio", letterTemplate: LETTER_TEMPLATES[2], signers: ["dipendente", "direzione"], dueDate: "2027-02-28" },
        "s5",
      ),
    ],
  },
  {
    id: "wf-commerciale-2026",
    name: "MBO Commerciale 2026",
    description: "Forza vendita: obiettivi definiti dalla Direzione, consuntivo semestrale.",
    cycle: "2026",
    status: "attivo",
    companies: ["Valmec S.p.A.", "Valmec France SAS"],
    updatedAt: "2026-01-20",
    tasks: [
      t("definizione", { owner: "direzione", dueDate: "2026-01-20" }, "c1"),
      t("approvazione", { owner: "direzione", approvers: ["direzione"], approvalMode: "almeno_uno", dueDate: "2026-01-31" }, "c2"),
      t("consuntivazione", { title: "Consuntivo primo semestre", dueDate: "2026-07-15" }, "c3"),
      t("consuntivazione", { title: "Consuntivo secondo semestre", dueDate: "2027-01-15" }, "c4"),
      t("lettera", { title: "Lettera premio", letterTemplate: LETTER_TEMPLATES[2], dueDate: "2027-02-15" }, "c5"),
    ],
  },
  {
    id: "wf-asia-2026",
    name: "MBO Asia Pacific 2026",
    description: "Bozza in revisione con HR locale.",
    cycle: "2026",
    status: "bozza",
    companies: ["Valmec Asia Pacific Sdn Bhd"],
    updatedAt: "2026-02-02",
    tasks: [t("definizione", { owner: "hr", dueDate: "2026-03-15" }, "a1"), t("approvazione", { dueDate: "2026-03-31" }, "a2")],
  },
  {
    id: "wf-standard-2025",
    name: "MBO 2025 · Standard",
    description: "Ciclo chiuso.",
    cycle: "2025",
    status: "archiviato",
    companies: [],
    updatedAt: "2026-02-28",
    tasks: [
      t("definizione", { dueDate: "2025-01-31" }, "o1"),
      t("approvazione", { dueDate: "2025-02-15" }, "o2"),
      t("consuntivazione", { dueDate: "2026-01-31" }, "o3"),
      t("lettera", { title: "Lettera premio", letterTemplate: LETTER_TEMPLATES[2], dueDate: "2026-02-28" }, "o4"),
    ],
  },
];

/** First task whose due date is today or later. */
export function nextTask(w: Workflow, today = new Date().toISOString().slice(0, 10)) {
  return [...w.tasks].filter((x) => x.dueDate && x.dueDate >= today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
}

/** Indexes of tasks whose due date is earlier than a previous task's (likely a mistake). */
export function outOfOrder(tasks: WorkflowTask[]) {
  const bad = new Set<number>();
  let last = "";
  tasks.forEach((x, i) => {
    if (!x.dueDate) return;
    if (last && x.dueDate < last) bad.add(i);
    else last = x.dueDate;
  });
  return bad;
}
