"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileDown, Plus, Save, Search, SlidersHorizontal } from "lucide-react";
import { Field, GhostButton, Modal, PrimaryButton, inputCls, localeTag, tr, useOrg } from "@spark/core";
import { CompensationAnalysis, canonicalEmployeeId, type SavedJustification } from "../lib/analysis/CompensationAnalysis";
import type { ComparisonRow } from "../lib/analysis/GapGroupAnalyzer";
import { downloadGapReportPdf } from "../lib/analysis/GapReportPdf";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { defaultRgaSelection, personPay } from "../lib/analysis/RgaComponents";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS, type SalaryMetric } from "../lib/models/constants";
import { EmployeePanel } from "./EmployeePanel";
import { EqualValueView } from "./RoleWeights";
import { eur, gap, gapTone, num, pct } from "./format";

const METRICS: { id: SalaryMetric; label: string; hint: string }[] = [
  { id: SALARY_METRICS.base, label: "Retribuzione base", hint: "RAL riportata a tempo pieno (FTE)." },
  { id: SALARY_METRICS.totale, label: "Retribuzione totale", hint: "RAL FTE più MBO target, premio di risultato, fringe benefit, welfare, ticket e altre voci annue." },
  { id: SALARY_METRICS.variabile, label: "Componenti variabili", hint: "Solo le voci variabili annue." },
];

type View = "dashboard" | "ccnl" | "qualifica" | "cdr" | "parivalore" | "dipendenti";

interface Props {
  analysis: CompensationAnalysis;
  fileName: string;
  savedName?: string;
  saved: boolean;
  canManage: boolean;
  onSave: (name: string, justifications: SavedJustification[]) => void;
  onNew: () => void;
  onEditMapping?: () => void;
  /** Page of the role weighting (Job grading), linked from the equal-value view. */
  jobGradingHref?: string;
}

/** Results of one analysis: EU dashboard, gaps by CCNL level / qualification / cost centre, employees. */
export function Results({ analysis, fileName, savedName, saved, canManage, onSave, onNew, onEditMapping, jobGradingHref = "/job-grading" }: Props) {
  const all = analysis.employees;
  const [view, setView] = useState<View>("dashboard");
  const [metric, setMetric] = useState<SalaryMetric>(SALARY_METRICS.base);
  const [company, setCompany] = useState("");
  const [excluded, setExcluded] = useState<Record<number, string>>(() => CompensationAnalysis.exclusionMap(all, analysis.justifications));
  const [person, setPerson] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const rga = metric === SALARY_METRICS.totale ? defaultRgaSelection() : null;
  const companies = useMemo(() => analysis.companyOptions(), [analysis]);
  // employees with a justified deviation are left out of the gap figures
  const population = useMemo(() => all.filter((e) => !excluded[e.index] && (!company || e.company === company)), [all, excluded, company]);
  const scoped = useMemo(() => new CompensationAnalysis(population), [population]);
  const dash = useMemo(() => scoped.dashboard(metric, true, rga), [scoped, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const ccnl = useMemo(() => scoped.ccnlGroups(metric, true, rga), [scoped, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const qualifications = useMemo(() => scoped.qualificationGroups(metric, true, rga), [scoped, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasCdr = scoped.hasCostCenterData();
  const costCenters = useMemo(() => (hasCdr ? scoped.costCenters(metric, true, rga) : []), [scoped, metric, hasCdr]); // eslint-disable-line react-hooks/exhaustive-deps
  const payOf = useMemo(() => scoped.salaryOf(metric, true, false, rga), [scoped, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const critical = useMemo(
    () =>
      ccnl
        .flatMap((g) => g.levels.filter((l) => l.status === "red" && l.gapMean != null).map((l) => ({ label: g.ccnlLabel ? `${g.ccnlLabel} · ${l.groupLabel}` : l.groupLabel, gap: l.gapMean!, n: l.nTotal })))
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)),
    [ccnl],
  );

  const justifications = (): SavedJustification[] =>
    Object.entries(excluded)
      .map(([index, note]) => {
        const p = all.find((e) => String(e.index) === index);
        const employeeId = canonicalEmployeeId(p?.employeeId);
        return employeeId ? { employeeId, name: p?.name ?? null, note } : null;
      })
      .filter((x): x is SavedJustification => !!x);

  const tabs: { id: View; label: string; hidden?: boolean }[] = [
    { id: "dashboard", label: "Dashboard UE" },
    { id: "ccnl", label: "Per livello CCNL" },
    { id: "qualifica", label: "Per qualifica" },
    { id: "cdr", label: "Per centro di costo", hidden: !hasCdr },
    { id: "parivalore", label: "Pari valore" },
    { id: "dipendenti", label: "Dipendenti" },
  ];
  const metricDef = METRICS.find((m) => m.id === metric)!;

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{savedName ?? fileName}</p>
          <p className="text-[12px] text-muted">
            {tr("{0} dipendenti", [all.length])}
            {Object.keys(excluded).length > 0 && ` · ${tr("{0} esclusi con giustificazione", [Object.keys(excluded).length])}`}
            {saved && !dirty && ` · ${tr("salvata nello storico")}`}
          </p>
        </div>
        {onEditMapping && (
          <GhostButton onClick={onEditMapping} className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> {tr("Colonne")}
          </GhostButton>
        )}
        <GhostButton onClick={onNew} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {tr("Nuova analisi")}
        </GhostButton>
        {canManage && (!saved || dirty) && (
          <PrimaryButton onClick={() => (saved ? (onSave(savedName ?? fileName, justifications()), setDirty(false)) : setSaving(true))} className="flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> {saved ? tr("Salva modifiche") : tr("Salva nello storico")}
          </PrimaryButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg bg-canvas p-0.5 text-[12.5px] font-semibold">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={`rounded-md px-3 py-1.5 transition-colors ${view === t.id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {tr(t.label)}
              </button>
            ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {companies.length > 1 && (
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand">
              <option value="">{tr("Tutte le società")}</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {view !== "dipendenti" && (
            <select value={metric} onChange={(e) => setMetric(e.target.value as SalaryMetric)} className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-brand">
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {tr(m.label)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {view !== "dipendenti" && <p className="text-[12px] text-muted">{tr(metricDef.hint)} {tr("Gap = (media uomini − media donne) / media uomini: positivo se gli uomini sono pagati di più. Soglia della direttiva: 5%.")}</p>}

      {view === "dashboard" && (
        <Dashboard dash={dash} critical={critical} metricLabel={metricDef.label} ccnl={ccnl} costCenters={costCenters} excluded={excluded} all={all} />
      )}
      {view === "ccnl" &&
        (ccnl.length ? (
          ccnl.map((g) => <GroupTable key={g.ccnlKey} title={g.ccnlLabel || tr("CCNL non indicato")} label="Livello" rows={g.levels} />)
        ) : (
          <Empty />
        ))}
      {view === "qualifica" && <GroupTable label="Qualifica" rows={qualifications} />}
      {view === "cdr" && <GroupTable label="Centro di costo" rows={costCenters} />}
      {view === "parivalore" && <EqualValueView people={population} getSalary={payOf} weighHref={jobGradingHref} />}
      {view === "dipendenti" && <Employees people={company ? all.filter((e) => e.company === company) : all} excluded={excluded} onOpen={setPerson} />}

      {person && (
        <EmployeePanel
          person={person}
          peers={all.filter((e) => !excluded[e.index] || e.index === person.index)}
          note={excluded[person.index] ?? ""}
          canManage={canManage}
          onNote={(note) => {
            setExcluded((prev) => {
              const next = { ...prev };
              if (note) next[person.index] = note;
              else delete next[person.index];
              return next;
            });
            setDirty(true);
          }}
          onClose={() => setPerson(null)}
        />
      )}
      {saving && (
        <SaveModal
          defaultName={fileName.replace(/\.[^.]+$/, "")}
          onClose={() => setSaving(false)}
          onSave={(name) => {
            onSave(name, justifications());
            setSaving(false);
            setDirty(false);
          }}
        />
      )}
    </div>
  );
}

function Empty() {
  return <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessun dato per questa vista.")}</div>;
}

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(label)}</p>
      <p className={`mt-1 text-[20px] font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
      {sub && <p className="text-[11.5px] text-muted">{sub}</p>}
    </div>
  );
}

function Dashboard({
  dash,
  critical,
  metricLabel,
  ccnl,
  costCenters,
  excluded,
  all,
}: {
  dash: ReturnType<CompensationAnalysis["dashboard"]>;
  critical: { label: string; gap: number; n: number }[];
  metricLabel: string;
  ccnl: ReturnType<CompensationAnalysis["ccnlGroups"]>;
  costCenters: ComparisonRow[];
  excluded: Record<number, string>;
  all: Employee[];
}) {
  const org = useOrg();
  const [report, setReport] = useState(false);
  if (!dash.nTotaleAnalizzati) return <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessun dipendente con sesso e retribuzione validi.")}</div>;
  const maxQ = Math.max(1, ...dash.quartiles.map((q) => Math.max(q.maschile, q.femminile)));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gap medio" value={gap(dash.gapMean)} tone={gapTone(dash.gapMean)} />
        <Kpi label="Gap mediano" value={gap(dash.gapMedian)} tone={gapTone(dash.gapMedian)} />
        <Kpi label="Gap orario medio" value={gap(dash.gapHourlyMean)} tone={gapTone(dash.gapHourlyMean)} sub={tr("Mediano {0}", [gap(dash.gapHourlyMedian)])} />
        <Kpi label="Dipendenti analizzati" value={String(dash.nTotaleAnalizzati)} sub={tr("{0} uomini · {1} donne", [dash.nMaschi, dash.nFemmine])} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gap variabile medio" value={gap(dash.gapVarMean)} tone={gapTone(dash.gapVarMean)} sub={tr("Mediano {0}", [gap(dash.gapVarMedian)])} />
        <Kpi label="Con componenti variabili" value={`${pct(dash.pctMenWithVar, 0)} · ${pct(dash.pctWomenWithVar, 0)}`} sub={tr("uomini · donne")} />
        <div className="card px-4 py-3 sm:col-span-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> {tr("Gruppi oltre la soglia del 5%")}
          </p>
          {critical.length ? (
            <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
              {critical.slice(0, 4).map((c) => (
                <li key={c.label} className="flex justify-between gap-3">
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-red-600">{gap(c.gap)}</span>
                </li>
              ))}
              {critical.length > 4 && <li className="text-muted">{tr("e altri {0}", [critical.length - 4])}</li>}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-emerald-700">{tr("Nessun livello CCNL supera la soglia con un campione sufficiente.")}</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold">{tr("Quartili retributivi")}</p>
          <p className="text-[12px] text-muted">{tr("Dal 25% meno pagato (Q1) al 25% più pagato (Q4): quanti uomini e donne ci sono in ogni fascia.")}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dash.quartiles.map((q) => (
            <div key={q.quartile} className="rounded-xl border border-line p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-bold">Q{q.quartile}</span>
                <span className={`text-[12px] font-semibold tabular-nums ${gapTone(q.gapPct)}`}>{gap(q.gapPct)}</span>
              </div>
              <div className="mt-2 flex h-20 items-end gap-2">
                {[
                  { n: q.maschile, c: "bg-[#1e5fe0]", l: tr("Uomini") },
                  { n: q.femminile, c: "bg-[#e0559a]", l: tr("Donne") },
                ].map((b) => (
                  <div key={b.l} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[11px] font-semibold tabular-nums">{b.n}</span>
                    <div className={`w-full rounded-t ${b.c}`} style={{ height: `${Math.max(2, (b.n / maxQ) * 56)}px` }} aria-label={`${b.l}: ${b.n}`} />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted">
                {tr("Media U")} {eur(q.avgMaschile)} · {tr("D")} {eur(q.avgFemminile)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-3 text-[11.5px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[#1e5fe0]" /> {tr("Uomini")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[#e0559a]" /> {tr("Donne")}
          </span>
          <span>· {tr("verde < 4%, arancio 4–5%, rosso > 5%")}</span>
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <FileDown className="h-5 w-5 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{tr("Report sul divario retributivo")}</p>
          <p className="text-[12px] text-muted">{tr("PDF con indicatori, quartili, livelli CCNL e giustificazioni, pronto per la comunicazione prevista dalla direttiva.")}</p>
        </div>
        <PrimaryButton onClick={() => setReport(true)}>{tr("Scarica PDF")}</PrimaryButton>
      </div>

      {report && (
        <ReportModal
          defaultCompany={org.companies[0] ?? org.name}
          onClose={() => setReport(false)}
          onDownload={(companyName, period) => {
            const justified = Object.entries(excluded).map(([index, note]) => {
              const p = all.find((e) => String(e.index) === index);
              return { employeeId: String(p?.employeeId ?? index), name: p?.name ?? "—", gender: p?.gender ?? "—", deviationPct: null, note };
            });
            downloadGapReportPdf({
              companyName,
              referencePeriod: period,
              metricLabel,
              nEmployees: `${dash.nMaschi} / ${dash.nFemmine}`,
              generatedAtLabel: new Date().toLocaleString("it-IT"),
              gapMean: dash.gapMean,
              gapMedian: dash.gapMedian,
              gapHourlyMean: dash.gapHourlyMean,
              gapHourlyMedian: dash.gapHourlyMedian,
              ccnlRows: ccnl.flatMap((g) =>
                g.levels.map((l) => ({ ccnlLabel: g.ccnlLabel, levelLabel: l.groupLabel, nTotal: l.nTotal, nM: l.nM, nF: l.nF, avgM: l.avgM, avgF: l.avgF, gapMean: l.gapMean, insufficientSample: l.insufficientSample, status: l.status })),
              ),
              quartiles: dash.quartiles.map((q) => ({ quartile: q.quartile, totale: q.totale, maschile: q.maschile, femminile: q.femminile, pctOfTotalM: q.pctOfTotalM, pctOfTotalF: q.pctOfTotalF, avgMaschile: q.avgMaschile, avgFemminile: q.avgFemminile, gapPct: q.gapPct })),
              groupsAboveThreshold: ccnl.flatMap((g) =>
                g.levels.filter((l) => l.status === "red" && l.gapMean != null).map((l) => ({ label: g.ccnlLabel ? `${g.ccnlLabel} · ${l.groupLabel}` : l.groupLabel, gapMean: l.gapMean, nTotal: l.nTotal })),
              ),
              includeFascia: false,
              fasciaRows: [],
              includeCostCenter: costCenters.length > 0,
              costCenterRows: costCenters.map((r) => ({ label: r.groupLabel || r.costCenterLabel || "–", nTotal: r.nTotal, nM: r.nM, nF: r.nF, gapMean: r.gapMean, insufficientSample: r.insufficientSample, status: r.status })),
              justifications: justified,
            });
            setReport(false);
          }}
        />
      )}
    </div>
  );
}

function ReportModal({ defaultCompany, onClose, onDownload }: { defaultCompany: string; onClose: () => void; onDownload: (company: string, period: string) => void }) {
  const [company, setCompany] = useState(defaultCompany);
  const [period, setPeriod] = useState(`Anno ${new Date().getFullYear()}`);
  const ok = company.trim() && period.trim();
  return (
    <Modal
      title="Report sul divario retributivo"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton disabled={!ok} onClick={() => onDownload(company.trim(), period.trim())}>
            {tr("Scarica PDF")}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Azienda">
          <input autoFocus className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label="Periodo di riferimento">
          <input className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <p className="text-[12px] text-muted">{tr("Il report riporta la vista e la società selezionate. Il testo del PDF è in italiano.")}</p>
      </div>
    </Modal>
  );
}

function StatusDot({ row }: { row: ComparisonRow }) {
  if (row.insufficientSample) return <span className="text-[11.5px] text-muted">{tr("campione ridotto")}</span>;
  const c = row.status === "red" ? "bg-red-500" : row.status === "yellow" ? "bg-amber-400" : "bg-emerald-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

function GroupTable({ title, label, rows }: { title?: string; label: string; rows: ComparisonRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="card overflow-x-auto">
      {title && <p className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">{title}</p>}
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
            <th className="px-3 py-2.5 pl-4">{tr(label)}</th>
            <th className="px-3 py-2.5 text-right">{tr("Uomini")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Donne")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Media uomini")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Media donne")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Gap medio")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Gap mediano")}</th>
            <th className="w-[110px] px-3 py-2.5 pr-4 text-center">{tr("Stato")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.groupKey} className="border-b border-line text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
              <td className="px-3 py-[8px] pl-4 font-semibold">{r.groupLabel}</td>
              <td className="px-3 py-[8px] text-right tabular-nums">{r.nM}</td>
              <td className="px-3 py-[8px] text-right tabular-nums">{r.nF}</td>
              <td className="px-3 py-[8px] text-right tabular-nums">{eur(r.avgM)}</td>
              <td className="px-3 py-[8px] text-right tabular-nums">{eur(r.avgF)}</td>
              <td className={`px-3 py-[8px] text-right font-semibold tabular-nums ${r.insufficientSample ? "text-muted" : gapTone(r.gapMean)}`}>{gap(r.gapMean)}</td>
              <td className="px-3 py-[8px] text-right tabular-nums text-muted">{gap(r.gapMedian)}</td>
              <td className="px-3 py-[8px] pr-4 text-center">
                <StatusDot row={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Deviation of each person's base pay from the mean of their CCNL level (same contract). */
function levelDeviation(people: Employee[]) {
  const key = (e: Employee) => `${String(e.ccnl ?? "").trim()}|${LevelTaxonomy.normalize(e.level) ?? ""}`;
  const sums = new Map<string, { s: number; n: number }>();
  for (const e of people) {
    const v = personPay(e, SALARY_METRICS.base);
    if (v == null || !(v > 0)) continue;
    const k = key(e);
    const cur = sums.get(k) ?? { s: 0, n: 0 };
    sums.set(k, { s: cur.s + v, n: cur.n + 1 });
  }
  return (e: Employee) => {
    const v = personPay(e, SALARY_METRICS.base);
    const m = sums.get(key(e));
    return v != null && m && m.n > 1 ? ((v - m.s / m.n) / (m.s / m.n)) * 100 : null;
  };
}

function Employees({ people, excluded, onOpen }: { people: Employee[]; excluded: Record<number, string>; onOpen: (e: Employee) => void }) {
  const [q, setQ] = useState("");
  const dev = useMemo(() => levelDeviation(people), [people]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? people.filter((e) => [e.name, e.employeeId, e.role, e.level, e.qualification].some((x) => String(x ?? "").toLowerCase().includes(s))) : people;
    return [...list].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), localeTag()));
  }, [people, q]);

  return (
    <div className="space-y-2.5">
      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input className={`${inputCls} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Cerca per nome, ID, ruolo, livello…")} />
      </label>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">{tr("Dipendente")}</th>
              <th className="px-3 py-2.5">{tr("Sesso")}</th>
              <th className="px-3 py-2.5">{tr("Livello")}</th>
              <th className="px-3 py-2.5">{tr("Ruolo")}</th>
              <th className="px-3 py-2.5 text-right">{tr("RAL FTE")}</th>
              <th className="px-3 py-2.5 pr-4 text-right">{tr("Vs media livello")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 300).map((e) => {
              const d = dev(e);
              return (
                <tr key={e.index} onClick={() => onOpen(e)} className="cursor-pointer border-b border-line text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                  <td className="px-3 py-[8px] pl-4">
                    <span className="font-semibold">{e.name || e.employeeId || `#${e.index + 1}`}</span>
                    {e.employeeId && e.name && <span className="ml-1.5 text-[11.5px] text-muted">{e.employeeId}</span>}
                    {excluded[e.index] && <span className="ml-2 rounded bg-amber-100 px-1.5 py-[1px] text-[11px] font-semibold text-amber-800">{tr("giustificato")}</span>}
                  </td>
                  <td className="px-3 py-[8px]">{e.gender === "F" ? tr("D") : tr("U")}</td>
                  <td className="px-3 py-[8px]">{LevelTaxonomy.displayLabel(e.level)}</td>
                  <td className="max-w-[220px] truncate px-3 py-[8px] text-muted">{e.role || "—"}</td>
                  <td className="px-3 py-[8px] text-right tabular-nums">{eur(personPay(e, SALARY_METRICS.base))}</td>
                  <td className={`px-3 py-[8px] pr-4 text-right font-semibold tabular-nums ${d != null && Math.abs(d) > 5 ? (d < 0 ? "text-red-600" : "text-amber-600") : "text-muted"}`}>
                    {d == null ? "–" : `${d > 0 ? "+" : ""}${num(d)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length > 300 && <p className="border-t border-line px-4 py-2 text-[12px] text-muted">{tr("Mostrati i primi 300 su {0}: usa la ricerca.", [shown.length])}</p>}
        {!shown.length && <p className="px-4 py-6 text-center text-[12.5px] text-muted">{tr("Nessun dipendente trovato.")}</p>}
      </div>
    </div>
  );
}

function SaveModal({ defaultName, onClose, onSave }: { defaultName: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Modal
      title="Salva nello storico"
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            {tr("Salva")}
          </PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
        className="space-y-2"
      >
        <Field label="Nome dell'analisi">
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <p className="text-[12px] text-muted">{tr("Si salvano i dati retributivi dei dipendenti, visibili solo a chi ha il permesso sulla trasparenza retributiva.")}</p>
      </form>
    </Modal>
  );
}
