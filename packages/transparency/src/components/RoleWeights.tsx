"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { CheckCheck, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Badge, GhostButton, PrimaryButton, Tooltip, tr, useData } from "@spark/core";
import type { ComparisonRow } from "../lib/analysis/GapGroupAnalyzer";
import type { Employee } from "../lib/models/Employee";
import {
  CRITERIA,
  DEFAULT_WEIGHTS,
  bandName,
  bandOf,
  bandRange,
  equalValueBands,
  estimateScores,
  roleId,
  roleScore,
  rolesOf,
  type CriteriaWeights,
  type RoleScores,
  type RoleWeightDoc,
} from "../lib/roleWeights";
import { useCriteriaWeights, useRoleWeights } from "../store";
import { eur, gap, gapTone } from "./format";
import { ExpandToggle, GroupPeople, type PersonOpener } from "./GroupPeople";
import type { RgaSelection } from "../lib/analysis/RgaComponents";

const AI_ERRORS: Record<string, string> = {
  ai_config: "Servizio AI non configurato: manca la chiave ANTHROPIC_API_KEY sul server.",
  ai: "La proposta AI non è riuscita. Riprova tra poco.",
  rate: "Troppe richieste ravvicinate: riprova tra qualche minuto.",
  forbidden: "Non hai il permesso di modificare la pesatura dei ruoli.",
  body: "Elenco dei ruoli non valido (massimo 400 ruoli).",
};

type Status = "stima" | "ai" | "confermato";
const STATUS: Record<Status, { label: string; tone: "grey" | "blue" | "navy"; hint: string }> = {
  stima: { label: "Stima automatica", tone: "grey", hint: "Calcolata da livello CCNL e parole del titolo: falla proporre all'AI o correggila." },
  ai: { label: "Proposta AI", tone: "blue", hint: "Da rivedere e confermare." },
  confermato: { label: "Confermato", tone: "navy", hint: "Pesatura validata dall'azienda." },
};

/** Scores of every role: the saved weighting, else the keyword estimate. */
function useRoleTable(people: Employee[]) {
  const { weights: saved, upsert } = useRoleWeights();
  const { weights } = useCriteriaWeights();
  const roles = useMemo(() => rolesOf(people), [people]);
  const key = JSON.stringify(weights);
  const rows = useMemo(
    () =>
      roles.map((r) => {
        const doc = saved.get(r.role);
        const scores = doc?.scores ?? estimateScores(r.role, r.people);
        const status: Status = !doc ? "stima" : doc.confirmed ? "confermato" : "ai";
        return { ...r, doc, scores, status, score: roleScore(scores, weights) };
      }),
    // weights change by value (settings doc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles, saved, key],
  );
  return { rows, upsert };
}

/** Gender gap per job-grading band (10 points) of a population, with how many roles are still unconfirmed. */
export function useEqualValueBands(people: Employee[], getSalary: (p: Employee) => number | null) {
  const { rows } = useRoleTable(people);
  const scores = useMemo(() => new Map(rows.map((r) => [r.role, r.score])), [rows]);
  const bands = useMemo(() => equalValueBands(people, (role) => scores.get(role), getSalary), [people, scores, getSalary]);
  return { bands, roles: rows.length, unconfirmed: rows.filter((r) => r.status !== "confermato").length };
}

/** Editor of the criteria weights (sum 100). */
function WeightsEditor({ canManage }: { canManage: boolean }) {
  const { weights, setWeights } = useCriteriaWeights();
  const [draft, setDraft] = useState<CriteriaWeights>(weights);
  const [prev, setPrev] = useState(weights);
  if (JSON.stringify(prev) !== JSON.stringify(weights)) {
    setPrev(weights);
    setDraft(weights);
  }
  const total = CRITERIA.reduce((n, c) => n + (draft[c.id] || 0), 0);
  const changed = JSON.stringify(draft) !== JSON.stringify(weights);
  const isDefault = JSON.stringify(weights) === JSON.stringify(DEFAULT_WEIGHTS);
  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[12.5px] font-semibold">{tr("Pesi dei fattori")}</p>
          <p className="mt-0.5 text-[12px] text-muted">{tr("Quanto conta ogni fattore nel punteggio totale. La somma deve fare 100.")}</p>
        </div>
        {CRITERIA.map((c) => (
          <label key={c.id} className="w-[110px]">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr(c.label)}</span>
            <span className="relative block">
              <input
                type="number"
                min={0}
                max={100}
                disabled={!canManage}
                value={draft[c.id]}
                onChange={(e) => setDraft((d) => ({ ...d, [c.id]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) }))}
                className="w-full rounded-lg border border-[#dfe3ea] bg-white py-1.5 pl-2 pr-6 text-[12.5px] tabular-nums outline-none focus:border-brand disabled:bg-canvas"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11.5px] text-muted">%</span>
            </span>
          </label>
        ))}
        <div className="flex items-center gap-2">
          <span className={`text-[12.5px] font-semibold tabular-nums ${total === 100 ? "text-emerald-700" : "text-red-600"}`}>{tr("Totale {0}%", [total])}</span>
          {canManage && changed && (
            <PrimaryButton disabled={total !== 100} onClick={() => setWeights(draft)}>
              {tr("Applica")}
            </PrimaryButton>
          )}
          {canManage && !isDefault && !changed && (
            <Tooltip label={tr("Ripristina 30 / 40 / 20 / 10")}>
              <button
                type="button"
                aria-label={tr("Ripristina 30 / 40 / 20 / 10")}
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

/** Job evaluation of the company's roles: AI proposal, review, confirmation (art. 4 of the directive). */
export function RoleWeightsView({ people, canManage }: { people: Employee[]; canManage: boolean }) {
  const { rows, upsert } = useRoleTable(people);
  const { weights } = useCriteriaWeights();
  const email = useData().viewer?.email;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const save = (role: string, scores: RoleScores, patch: Partial<RoleWeightDoc>) =>
    ({ id: roleId(role), role, scores, source: "manuale", confirmed: true, updatedAt: new Date().toISOString(), updatedBy: email, ...patch }) as RoleWeightDoc;

  const pending = rows.filter((r) => r.status !== "confermato");
  const proposals = rows.filter((r) => r.status === "ai");

  const propose = async () => {
    const todo = pending.length ? pending : rows;
    setBusy(true);
    setMessage(null);
    const r = await fetch("/api/transparency/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: todo.map(({ role, n, level, ccnl, qualification, description }) => ({ role, n, level, ccnl, qualification, description })) }),
    }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { roles?: { role: string; scores: RoleScores; rationale: string }[]; error?: string };
    setBusy(false);
    if (!r?.ok || !body.roles) {
      setMessage({ text: tr(AI_ERRORS[body?.error ?? "ai"] ?? AI_ERRORS.ai), tone: "warn" });
      return;
    }
    upsert(body.roles.map((x) => save(x.role, x.scores, { rationale: x.rationale, source: "ai", confirmed: false })));
    setMessage({ text: tr("{0} ruoli pesati dall'AI: rivedi i punteggi e conferma.", [body.roles.length]), tone: "ok" });
  };

  if (!rows.length) return <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Il file non ha la colonna del ruolo: senza ruoli non si può fare la pesatura.")}</div>;

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">{tr("Pesatura dei ruoli")}</p>
          <p className="mt-0.5 max-w-3xl text-[12px] text-muted">
            {tr(
              "Ogni ruolo riceve da 1 a 10 punti su competenze, responsabilità, impegno e condizioni di lavoro; il totale pesato, da 10 a 100, colloca i ruoli nelle fasce di pari valore (10 punti l'una). All'AI vanno solo titoli, livelli e qualifiche: mai nomi o retribuzioni.",
            )}
          </p>
          <p className="mt-1 text-[12px] font-semibold">
            {tr("{0} ruoli · {1} confermati · {2} da rivedere", [rows.length, rows.length - pending.length, pending.length])}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {proposals.length > 0 && (
              <GhostButton
                onClick={() => upsert(proposals.map((r) => ({ ...r.doc!, confirmed: true, updatedAt: new Date().toISOString(), updatedBy: email })))}
                className="flex items-center gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" /> {tr("Conferma le proposte")}
              </GhostButton>
            )}
            <PrimaryButton disabled={busy} onClick={() => void propose()} className="flex items-center gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {pending.length ? tr("Proponi con AI ({0})", [pending.length]) : tr("Ripesa tutto con AI")}
            </PrimaryButton>
          </div>
        )}
      </div>
      {message && (
        <div className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {message.text}
        </div>
      )}
      <WeightsEditor canManage={canManage} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
              {CRITERIA.map((c) => (
                <th key={c.id} className="px-2 py-2.5 text-center">
                  <Tooltip label={`${tr(c.hint)} · ${tr("peso {0}%", [weights[c.id]])}`}>
                    <span>{tr(c.label)}</span>
                  </Tooltip>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right">{tr("Punti")}</th>
              <th className="px-3 py-2.5 text-center">{tr("Fascia")}</th>
              <th className="px-3 py-2.5 pr-4">{tr("Stato")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [lo, hi] = bandRange(bandOf(r.score));
              const s = STATUS[r.status];
              return (
                <tr key={r.role} className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                  <td className="max-w-[320px] px-3 py-2 pl-4">
                    <p className="font-semibold">{r.role}</p>
                    <p className="text-[11.5px] text-muted">
                      {tr("{0} persone", [r.n])}
                      {r.level && ` · ${r.level}`}
                      {r.qualification && ` · ${r.qualification}`}
                    </p>
                    {r.doc?.rationale && <p className="mt-0.5 text-[11.5px] text-faint">{r.doc.rationale}</p>}
                  </td>
                  {CRITERIA.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <select
                        aria-label={`${tr(c.label)} · ${r.role}`}
                        disabled={!canManage}
                        value={r.scores[c.id]}
                        onChange={(e) => upsert([save(r.role, { ...r.scores, [c.id]: Number(e.target.value) }, { rationale: r.doc?.rationale })])}
                        className="rounded-md border border-[#dfe3ea] bg-white px-1.5 py-1 text-[12.5px] tabular-nums outline-none focus:border-brand disabled:bg-transparent"
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.score}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-muted">
                    {tr(bandName(bandOf(r.score)))} · {lo}–{hi}
                  </td>
                  <td className="px-3 py-2 pr-4">
                    <Tooltip label={tr(s.hint)}>
                      <Badge tone={s.tone}>{tr(s.label)}</Badge>
                    </Tooltip>
                    {canManage && r.status === "ai" && (
                      <button
                        type="button"
                        onClick={() => upsert([{ ...r.doc!, confirmed: true, updatedAt: new Date().toISOString(), updatedBy: email }])}
                        className="mt-1 block text-[11.5px] font-semibold text-brand hover:underline"
                      >
                        {tr("Conferma")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusDot({ row }: { row: ComparisonRow }) {
  if (row.insufficientSample) return <span className="text-[11.5px] text-muted">{tr("campione ridotto")}</span>;
  const c = row.status === "red" ? "bg-red-500" : row.status === "yellow" ? "bg-amber-400" : "bg-emerald-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

/** Gender pay gap per equal-value band, across CCNL levels. */
export function EqualValueView({
  people,
  getSalary,
  weighHref,
  opener,
  rga,
}: {
  people: Employee[];
  getSalary: (p: Employee) => number | null;
  weighHref: string;
  opener: PersonOpener;
  rga?: RgaSelection | null;
}) {
  const { bands, roles, unconfirmed } = useEqualValueBands(people, getSalary);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  if (!roles) return <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Il file non ha la colonna del ruolo: senza ruoli non si possono formare le fasce di pari valore.")}</div>;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        {tr("Ruoli di livelli CCNL diversi con un punteggio simile svolgono lavoro di pari valore: il confronto uomo / donna si fa dentro ogni fascia di 10 punti.")}
      </p>
      {unconfirmed > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
          <span className="flex-1">{tr("{0} ruoli su {1} hanno una pesatura non confermata: le fasce sono provvisorie.", [unconfirmed, roles])}</span>
          <Link href={weighHref} className="rounded-lg px-2 py-1 underline hover:bg-amber-100">
            {tr("Vai al Job grading")}
          </Link>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">{tr("Fascia")}</th>
              <th className="px-3 py-2.5">{tr("Ruoli")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Uomini")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Donne")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Media uomini")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Media donne")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Gap medio")}</th>
              <th className="w-[110px] px-3 py-2.5 pr-4 text-center">{tr("Stato")}</th>
            </tr>
          </thead>
          <tbody>
            {bands.map(({ band, row, roles }) => (
              <Fragment key={band}>
              <tr className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                <td className="whitespace-nowrap px-3 py-[8px] pl-3">
                  <ExpandToggle open={!!open[band]} label={tr(bandName(band))} onClick={() => setOpen((o) => ({ ...o, [band]: !o[band] }))} />
                  <span className="font-semibold">{tr(bandName(band))}</span>
                  <span className="block pl-6 text-[11.5px] text-muted">{tr("{0} punti", [row.groupLabel])}</span>
                </td>
                <td className="max-w-[360px] px-3 py-[8px] text-[12px] text-muted">{roles.map((r) => `${r.role} (${r.n})`).join(", ")}</td>
                <td className="px-3 py-[8px] text-right tabular-nums">{row.nM}</td>
                <td className="px-3 py-[8px] text-right tabular-nums">{row.nF}</td>
                <td className="px-3 py-[8px] text-right tabular-nums">{eur(row.avgM)}</td>
                <td className="px-3 py-[8px] text-right tabular-nums">{eur(row.avgF)}</td>
                <td className={`px-3 py-[8px] text-right font-semibold tabular-nums ${row.insufficientSample ? "text-muted" : gapTone(row.gapMean)}`}>{gap(row.gapMean)}</td>
                <td className="px-3 py-[8px] pr-4 text-center">
                  <StatusDot row={row} />
                </td>
              </tr>
              {open[band] && (
                <tr className="border-b border-line">
                  <td colSpan={8} className="p-0">
                    <GroupPeople people={row.people} opener={opener} rga={rga} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
