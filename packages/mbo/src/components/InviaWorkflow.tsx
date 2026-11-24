"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GhostButton, Modal, PrimaryButton, inputCls } from "@spark/core";
import { cycleLabel, hasActuals, type Scheda, type SchedaStatus } from "../lib/mbo";
import { roleLabel, taskType, type TaskType, type Workflow } from "../lib/workflow";
import { useMbo } from "../store";
import { Block } from "./SchedaEditor";
import { localeTag, tr } from "@spark/core";

const date = (d?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(localeTag(), { timeZone: "UTC" }) : null);

/** Step that fits a scheda's status, used as the default when sending it to a workflow. */
const STEP_FOR: Record<SchedaStatus, TaskType> = {
  bozza: "definizione",
  in_approvazione: "approvazione",
  approvata: "consuntivazione",
  consuntivata: "lettera",
  archiviata: "lettera",
};

/** Badge "Workflow · fase" for a scheda that was sent to a workflow. */
export function WorkflowBadge({ scheda }: { scheda: Scheda }) {
  const { workflows } = useMbo();
  const sent = scheda.workflow;
  const w = sent && workflows.find((x) => x.id === sent.workflowId);
  const t = w?.tasks.find((x) => x.id === sent!.taskId);
  if (!w || !t) return null;
  const tt = taskType(t.type);
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-[#eef1f5] px-2 py-[2px] text-[11px] font-semibold text-[#5b6476]"
      title={tr("Inviata il {0}", [date(sent!.sentAt)])}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tt.color }} />
      <span className="truncate">
        {w.name} · {tr(t.title)}
      </span>
    </span>
  );
}

/** "Invia a workflow": puts a scheda at a step of an MBO workflow. */
export function InviaWorkflowModal({ schede, onClose }: { schede: Scheda[]; onClose: (sent?: boolean) => void }) {
  // defaults (cycle, current step) come from the first scheda
  const { workflows, updateScheda, notify } = useMbo();
  const scheda = schede[0];

  // active workflows of the scheda's cycle first, then the others; archived ones are never offered
  const options = useMemo(
    () =>
      workflows
        .filter((w) => w.status !== "archiviato" && w.tasks.length)
        .sort(
          (a, b) =>
            Number(b.status === "attivo") - Number(a.status === "attivo") ||
            Number(b.cycle === scheda.cycle) - Number(a.cycle === scheda.cycle) ||
            a.name.localeCompare(b.name, "it"),
        ),
    [workflows, scheda.cycle],
  );
  const step: TaskType = hasActuals(scheda) && scheda.status !== "consuntivata" ? "consuntivazione" : STEP_FOR[scheda.status];

  /** Default step: where the scheda is now, else the step matching its status, else the first one. */
  const startTask = (w?: Workflow) =>
    w?.tasks.find((t) => t.id === scheda.workflow?.taskId)?.id ?? w?.tasks.find((t) => t.type === step)?.id ?? w?.tasks[0]?.id ?? "";

  const [workflowId, setWorkflowId] = useState(scheda.workflow?.workflowId ?? options[0]?.id ?? "");
  const wf = options.find((w) => w.id === workflowId);
  const [taskId, setTaskId] = useState(() => startTask(wf));

  const pickWorkflow = (id: string) => {
    setWorkflowId(id);
    setTaskId(startTask(options.find((w) => w.id === id)));
  };

  const send = () => {
    if (!wf || !taskId) return;
    const sentAt = new Date().toISOString().slice(0, 10);
    for (const s of schede) updateScheda(s.id, { workflow: { workflowId: wf.id, taskId, sentAt } });
    const step = wf.tasks.find((t) => t.id === taskId)?.title;
    notify(schede.length === 1 ? tr("Scheda inviata a \"{0}\" · {1}", [wf.name, step]) : tr("{0} schede inviate a \"{1}\" · {2}", [schede.length, wf.name, step]));
    onClose(true);
  };

  return (
    <Modal
      title={tr("Invia a workflow · {0}", [schede.length === 1 ? scheda.name : tr("{0} schede", [schede.length])])}
      onClose={() => onClose()}
      width="max-w-xl"
      footer={
        <>
          <GhostButton onClick={() => onClose()}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={send} disabled={!wf || !taskId}>{tr("Invia")}</PrimaryButton>
        </>
      }
    >
      {options.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[13px] font-semibold">{tr("Nessun workflow disponibile")}</p>
          <Link href="/mbo/workflow" className="mt-1 inline-block text-[12.5px] font-semibold text-brand hover:underline">{tr("Crea un workflow")}</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <Block label={tr("Workflow")}>
            <select className={inputCls} value={workflowId} onChange={(e) => pickWorkflow(e.target.value)}>
              {options.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {tr(cycleLabel(w.cycle))}
                  {w.status === "bozza" ? tr(" (bozza)") : ""}
                </option>
              ))}
            </select>
          </Block>

          {wf && (
            <Block label={tr("Fase")}>
              <div role="radiogroup" aria-label={tr("Fase")} className="space-y-1.5">
                {wf.tasks.map((t, i) => {
                  const on = taskId === t.id;
                  const tt = taskType(t.type);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTaskId(t.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        on ? "border-brand bg-brand-soft" : "border-[#dfe3ea] hover:border-[#c6ccd6]"
                      }`}
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: tt.color }}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-semibold ${on ? "text-brand" : ""}`}>{tr(t.title)}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {tr(roleLabel(t.owner))}
                          {t.dueDate && tr(" · entro il {0}", [date(t.dueDate)])}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Block>
          )}

        </div>
      )}
    </Modal>
  );
}
