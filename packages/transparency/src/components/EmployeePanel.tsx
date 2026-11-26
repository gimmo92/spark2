"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Field, GhostButton, Modal, PrimaryButton, inputCls, tr } from "@spark/core";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { assessPayLetter, downloadPayLetter, type PayLetterScope } from "../lib/analysis/PayLetter";
import { yearsOfService } from "../lib/analysis/RoleAnalyzer";
import { teaPayComposition } from "../lib/analysis/TeaPayComposition";
import type { Employee } from "../lib/models/Employee";
import { eur, num } from "./format";

const SCOPE_LABELS: Record<PayLetterScope, string> = {
  company: "stessa società e contratto",
  annex: "stessa società, allegati A e B insieme",
  group: "tutto il gruppo, stesso contratto",
  level: "tutto il gruppo, stesso livello",
};

/**
 * One employee: profile, pay composition, justification of a deviation (the person is then left out
 * of the gap figures) and the individual pay information letter (art. 7 of the directive).
 */
export function EmployeePanel({
  person,
  peers,
  note,
  canManage,
  onNote,
  onClose,
}: {
  person: Employee;
  peers: Employee[];
  note: string;
  canManage: boolean;
  onNote: (note: string) => void;
  onClose: () => void;
}) {
  const comp = teaPayComposition(person);
  const years = yearsOfService(person);
  const [draft, setDraft] = useState(note);
  const [period, setPeriod] = useState(`Anno ${new Date().getFullYear()}`);
  const [minSample, setMinSample] = useState(5);
  const [message, setMessage] = useState<{ text: string; next?: PayLetterScope } | null>(null);

  const letter = (scope: PayLetterScope = "company") => {
    const r = assessPayLetter(person, peers, { scope, minPerGender: minSample, periodLabel: period });
    if (r.ok) {
      setMessage(null);
      downloadPayLetter(r);
      return;
    }
    if (r.reason === "category") {
      setMessage({ text: tr("Servono livello CCNL, contratto e RAL per confrontare questa persona con la sua categoria.") });
      return;
    }
    setMessage({
      text: tr("Campione troppo piccolo ({0}): servono almeno {1} uomini e {2} donne oltre alla persona; ci sono {3} uomini e {4} donne.", [tr(SCOPE_LABELS[r.scope]), r.minPerGender, r.minPerGender, r.nMen, r.nWomen]),
      next: r.nextScope ?? undefined,
    });
  };

  const rows: [string, string][] = [
    ["Sesso", person.gender === "F" ? tr("Donna") : tr("Uomo")],
    ["Società", person.company || "—"],
    ["CCNL", person.ccnl || "—"],
    ["Livello", LevelTaxonomy.displayLabel(person.level)],
    ["Qualifica", person.qualification || "—"],
    ["Ruolo", person.role || "—"],
    ["Anzianità", years == null ? "—" : tr("{0} anni", [num(years)])],
    ["Part-time", person.partTimePct && person.partTimePct < 100 ? `${num(person.partTimePct, 0)}%` : tr("Tempo pieno")],
  ];

  return (
    <Modal title={person.name || person.employeeId || tr("Dipendente")} onClose={onClose} width="max-w-3xl">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Profilo")}</p>
            <table className="w-full text-[12.5px]">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="py-1 pr-3 text-muted">{tr(k)}</td>
                    <td className="py-1 text-right font-semibold">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Retribuzione")}</p>
            {comp ? (
              <table className="w-full text-[12.5px]">
                <tbody>
                  <tr className="border-b border-line">
                    <td className="py-1 pr-3 text-muted">{tr("RAL")}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{eur(comp.ral)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-1 pr-3 text-muted">{tr("RAL a tempo pieno")}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{eur(comp.ralFte)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-1 pr-3 text-muted">{tr("Retribuzione oraria")}</td>
                    <td className="py-1 text-right tabular-nums">{comp.hourly ? `${num(comp.hourly, 2)} €` : "–"}</td>
                  </tr>
                  {comp.monthly.map((l) => (
                    <tr key={`m-${l.label}`} className="border-b border-line">
                      <td className="py-1 pr-3 text-muted">
                        {l.label} <span className="text-faint">({tr("mensile")})</span>
                      </td>
                      <td className="py-1 text-right tabular-nums">{eur(l.amount)}</td>
                    </tr>
                  ))}
                  {comp.annual
                    .filter((l) => l.amount)
                    .map((l) => (
                      <tr key={`a-${l.label}`} className="border-b border-line last:border-0">
                        <td className="py-1 pr-3 text-muted">
                          {l.label}
                          {l.note && <span className="block text-[11px] text-faint">{l.note}</span>}
                        </td>
                        <td className="py-1 text-right tabular-nums">{eur(l.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[12.5px] text-muted">{tr("Dettaglio non disponibile per questo file.")}</p>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-line p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <FileText className="h-4 w-4 text-brand" /> {tr("Comunicazione retributiva individuale")}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">{tr("PDF per il diritto di informazione (art. 7): posizione della persona rispetto alla media di uomini e donne della sua categoria.")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <Field label="Periodo di riferimento">
              <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </Field>
            <Field label="Minimo per genere">
              <input type="number" min={1} className={inputCls} value={minSample} onChange={(e) => setMinSample(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <PrimaryButton onClick={() => letter()}>{tr("Genera PDF")}</PrimaryButton>
          </div>
          {message && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              {message.text}
              {message.next && (
                <button type="button" onClick={() => letter(message.next)} className="ml-1 font-semibold underline">
                  {tr("Confronta con: {0}", [tr(SCOPE_LABELS[message.next])])}
                </button>
              )}
            </div>
          )}
        </section>

        {canManage && (
          <section className="rounded-xl border border-line p-3">
            <p className="text-[13px] font-semibold">{tr("Giustificazione dello scostamento")}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {tr("Motivi oggettivi e neutri rispetto al genere (anzianità, competenze, prestazione). La persona esce dal calcolo dei divari e la nota compare nel report.")}
            </p>
            <textarea className={`${inputCls} mt-2 min-h-[70px]`} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="mt-2 flex justify-end gap-2">
              {note && (
                <GhostButton
                  onClick={() => {
                    onNote("");
                    setDraft("");
                  }}
                >
                  {tr("Rimetti nell'analisi")}
                </GhostButton>
              )}
              <PrimaryButton disabled={!draft.trim() || draft.trim() === note} onClick={() => onNote(draft.trim())}>
                {note ? tr("Aggiorna giustificazione") : tr("Giustifica ed escludi")}
              </PrimaryButton>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
