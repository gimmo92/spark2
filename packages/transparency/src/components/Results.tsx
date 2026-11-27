"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, FileDown, Search } from "lucide-react";
import { Field, GhostButton, Modal, PrimaryButton, inputCls, localeTag, tr, useOrg } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { GapGroupAnalyzer, type ComparisonRow } from "../lib/analysis/GapGroupAnalyzer";
import { downloadGapReportPdf } from "../lib/analysis/GapReportPdf";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { RGA_COMPONENTS, RGA_LABELS, defaultRgaSelection, personPay, type RgaSelection } from "../lib/analysis/RgaComponents";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS, type SalaryMetric } from "../lib/models/constants";
import { ExpandToggle, GroupPeople, type PersonOpener } from "./GroupPeople";
import Link from "next/link";
import { EqualValueView, useEqualValueBands } from "./RoleWeights";
import { bandName, type EqualValueBand } from "../lib/roleWeights";
import { eur, gap, gapTone, num, pct } from "./format";

const METRICS: { id: SalaryMetric; label: string; hint: string }[] = [
  { id: SALARY_METRICS.base, label: "Retribuzione base", hint: "RAL riportata a tempo pieno (FTE)." },
  { id: SALARY_METRICS.totale, label: "Retribuzione totale", hint: "RAL FTE più MBO target, premio di risultato, fringe benefit, welfare, ticket e altre voci annue." },
  { id: SALARY_METRICS.variabile, label: "Componenti variabili", hint: "Solo le voci variabili annue." },
];

export type ResultsView = "dashboard" | "ccnl" | "qualifica" | "ruolo" | "cdr" | "parivalore" | "dipendenti";
type View = ResultsView;

interface Props {
  analysis: CompensationAnalysis;
  /** Name of the loaded data (Caricamento dati). */
  name: string;
  /** Page of the role weighting (Job grading), linked from the equal-value view. */
  jobGradingHref?: string;
  /** Loaded data id: people open on their page (employeeHref), where justifications are saved. */
  analysisId: string;
  employeeHref?: string;
  initialView?: ResultsView;
  onView?: (view: ResultsView) => void;
}

/** Results of one analysis: EU dashboard, gaps by CCNL level / qualification / cost centre, employees. */
export function Results({ analysis, name, jobGradingHref = "/job-grading", analysisId, employeeHref = "/trasparenza/dipendente", initialView, onView }: Props) {
  const all = analysis.employees;
  const [view, setViewState] = useState<View>(initialView ?? "dashboard");
  const setView = (v: View) => {
    setViewState(v);
    onView?.(v);
  };
  const router = useRouter();
  const [metric, setMetric] = useState<SalaryMetric>(SALARY_METRICS.base);
  const [company, setCompany] = useState("");
  // justified people (saved on their page) are left out of the gap figures and listed in the report
  const excluded = useMemo(() => CompensationAnalysis.exclusionMap(all, analysis.justifications), [all, analysis]);

  // voices of total / variable pay the user includes (Spark/TEA template only)
  const [selection, setSelection] = useState<RgaSelection>(defaultRgaSelection);
  const hasVoices = useMemo(() => all.some((e) => e.paySchema === "tea"), [all]);
  const rga = metric === SALARY_METRICS.base ? null : hasVoices ? selection : metric === SALARY_METRICS.totale ? defaultRgaSelection() : null;
  const rgaKey = JSON.stringify(rga);
  const companies = useMemo(() => analysis.companyOptions(), [analysis]);
  // employees with a justified deviation are left out of the gap figures
  const population = useMemo(() => all.filter((e) => !excluded[e.index] && (!company || e.company === company)), [all, excluded, company]);
  const scoped = useMemo(() => new CompensationAnalysis(population), [population]);
  const dash = useMemo(() => scoped.dashboard(metric, true, rga), [scoped, metric, rgaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const ccnl = useMemo(() => scoped.ccnlGroups(metric, true, rga), [scoped, metric, rgaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const qualifications = useMemo(() => scoped.qualificationGroups(metric, true, rga), [scoped, metric, rgaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasCdr = scoped.hasCostCenterData();
  const costCenters = useMemo(() => (hasCdr ? scoped.costCenters(metric, true, rga) : []), [scoped, metric, hasCdr, rgaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const opener: PersonOpener = { href: (e) => `${employeeHref}?analisi=${encodeURIComponent(analysisId)}&dip=${e.index}` };
  const openPerson = (e: Employee) => router.push(opener.href!(e));
  const payOf = useMemo(() => scoped.salaryOf(metric, true, false, rga), [scoped, metric, rgaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const equal = useEqualValueBands(population, payOf);
  const roleRows = useMemo(() => GapGroupAnalyzer.byRole(population, payOf).sort((a, b) => b.nTotal - a.nTotal), [population, payOf]);
  const critical = useMemo(
    () =>
      ccnl
        .flatMap((g) => g.levels.filter((l) => l.status === "red" && l.gapMean != null).map((l) => ({ label: g.ccnlLabel ? `${g.ccnlLabel} · ${l.groupLabel}` : l.groupLabel, gap: l.gapMean!, n: l.nTotal })))
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)),
    [ccnl],
  );


  const tabs: { id: View; label: string; hidden?: boolean }[] = [
    { id: "dashboard", label: "Dashboard UE" },
    { id: "ccnl", label: "Per livello CCNL" },
    { id: "qualifica", label: "Per qualifica" },
    { id: "ruolo", label: "Per ruolo" },
    { id: "cdr", label: "Per centro di costo", hidden: !hasCdr },
    { id: "parivalore", label: "Per fascia di job grading" },
    { id: "dipendenti", label: "Dipendenti" },
  ];
  const metricDef = METRICS.find((m) => m.id === metric)!;

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold">{name}</p>
          <p className="text-[12px] text-muted">
            {tr("{0} dipendenti", [all.length])}
            {Object.keys(excluded).length > 0 && ` · ${tr("{0} esclusi con giustificazione", [Object.keys(excluded).length])}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {view !== "dipendenti" && (
          <select value={metric} onChange={(e) => setMetric(e.target.value as SalaryMetric)} className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-brand">
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {tr(m.label)}
              </option>
            ))}
          </select>
        )}
        {view !== "dipendenti" && metric !== SALARY_METRICS.base && hasVoices && (
          <VoicesPicker variable={metric === SALARY_METRICS.variabile} value={selection} onChange={setSelection} />
        )}
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
      </div>

      {view === "dashboard" && (
        <Dashboard
          dash={dash}
          critical={critical}
          metricLabel={metricDef.label}
          ccnl={ccnl}
          costCenters={costCenters}
          bands={equal.bands}
          bandsUnconfirmed={equal.unconfirmed}
          onBands={() => setView("parivalore")}
          jobGradingHref={jobGradingHref}
          excluded={excluded}
          all={all}
          opener={opener}
          rga={rga}
        />
      )}
      {view === "ccnl" &&
        (ccnl.length ? (
          ccnl.map((g) => <GroupTable key={g.ccnlKey} title={g.ccnlLabel || tr("CCNL non indicato")} label="Livello" rows={g.levels} opener={opener} rga={rga} />)
        ) : (
          <Empty />
        ))}
      {view === "qualifica" && <GroupTable label="Qualifica" rows={qualifications} opener={opener} rga={rga} />}
      {view === "ruolo" && <GroupTable label="Ruolo" rows={roleRows} opener={opener} rga={rga} />}
      {view === "cdr" && <GroupTable label="Centro di costo" rows={costCenters} opener={opener} rga={rga} />}
      {view === "parivalore" && <EqualValueView people={population} getSalary={payOf} weighHref={jobGradingHref} opener={opener} rga={rga} />}
      {view === "dipendenti" && <Employees people={company ? all.filter((e) => e.company === company) : all} excluded={excluded} onOpen={openPerson} />}

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
  bands,
  bandsUnconfirmed,
  onBands,
  jobGradingHref,
  excluded,
  all,
  opener,
  rga,
}: {
  dash: ReturnType<CompensationAnalysis["dashboard"]>;
  critical: { label: string; gap: number; n: number }[];
  metricLabel: string;
  ccnl: ReturnType<CompensationAnalysis["ccnlGroups"]>;
  costCenters: ComparisonRow[];
  bands: EqualValueBand[];
  bandsUnconfirmed: number;
  onBands: () => void;
  jobGradingHref: string;
  excluded: Record<number, string>;
  all: Employee[];
  opener: PersonOpener;
  rga: RgaSelection | null;
}) {
  const org = useOrg();
  const [report, setReport] = useState(false);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const byIndex = useMemo(() => new Map(all.map((e) => [e.index, e])), [all]);
  const quartilePeople = (q: number) =>
    (dash.quartiles.find((x) => x.quartile === q)?.people ?? []).map((p) => byIndex.get(p.index)).filter((e): e is Employee => !!e);
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

      {bands.length > 0 && (
        <div className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold">{tr("Gap per fascia di job grading")}</p>
            <button type="button" onClick={onBands} className="text-[12px] font-semibold text-brand hover:underline">
              {tr("Dettaglio per fascia")}
            </button>
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            {bandsUnconfirmed > 0 && (
              <>
                <Link href={jobGradingHref} className="font-semibold text-amber-700 hover:underline">
                  {tr("{0} ruoli da confermare", [bandsUnconfirmed])}
                </Link>
              </>
            )}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {bands.map(({ band, row, roles }) => (
              <div key={band} className="rounded-xl border border-line px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">{tr(bandName(band))}</span>
                  <span className={`text-[14px] font-bold tabular-nums ${row.insufficientSample ? "text-muted" : gapTone(row.gapMean)}`}>
                    {row.insufficientSample ? tr("campione ridotto") : gap(row.gapMean)}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted">
                  {tr("{0} punti", [row.groupLabel])} · {tr("{0} ruoli", [roles.length])} · {tr("{0} U · {1} D", [row.nM, row.nF])}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold">{tr("Quartili retributivi")}</p>
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
              <button
                type="button"
                aria-expanded={openQ === q.quartile}
                onClick={() => setOpenQ(openQ === q.quartile ? null : q.quartile)}
                className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openQ === q.quartile ? "rotate-180" : ""}`} />
                {openQ === q.quartile ? tr("Nascondi dipendenti") : tr("Dipendenti ({0})", [q.totale])}
              </button>
            </div>
          ))}
        </div>
        {openQ != null && (
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <p className="border-b border-line bg-white px-4 py-2 text-[12.5px] font-semibold">{tr("Dipendenti del Q{0}", [openQ])}</p>
            <GroupPeople people={quartilePeople(openQ)} opener={opener} rga={rga} />
          </div>
        )}
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
              includeFascia: bands.length > 0,
              fasciaRows: bands.map(({ band, row, roles }) => ({
                fasciaId: bandName(band),
                fasciaLabel: `${row.groupLabel} punti`,
                levelLabel: (() => {
                  const names = roles.map((r) => r.role).join(", ");
                  return names.length > 60 ? `${names.slice(0, 57)}…` : names;
                })(),
                nM: row.nM,
                nF: row.nF,
                gap: row.gapMean,
                insufficientSample: row.insufficientSample,
                status: row.status,
              })),
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

/** Voices of total (or variable) pay included in the analysis, as checkboxes in a dropdown. */
function VoicesPicker({ variable, value, onChange }: { variable: boolean; value: RgaSelection; onChange: (v: RgaSelection) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const items = RGA_COMPONENTS.filter((c) => !variable || c.id !== "ral");
  const on = items.filter((c) => value[c.id]).length;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-[#dfe3ea] bg-white px-2.5 py-1.5 text-[12.5px] outline-none hover:border-[#c6ccd6] focus:border-brand"
      >
        {tr("Voci incluse")} <span className="font-semibold tabular-nums">{on}/{items.length}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-[11.5px]">
            <span className="font-bold uppercase tracking-wide text-muted">{variable ? tr("Componenti variabili") : tr("Retribuzione totale")}</span>
            <button type="button" onClick={() => onChange(defaultRgaSelection())} className="font-semibold text-brand hover:underline">
              {tr("Predefinite")}
            </button>
          </div>
          {items.map((c) => {
            const checked = value[c.id];
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => onChange({ ...value, [c.id]: !checked })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-canvas"
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-brand bg-brand text-white" : "border-[#c6ccd6] bg-white"}`}>
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {tr(RGA_LABELS[c.id])}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusDot({ row }: { row: ComparisonRow }) {
  if (row.insufficientSample) return <span className="text-[11.5px] text-muted">{tr("campione ridotto")}</span>;
  const c = row.status === "red" ? "bg-red-500" : row.status === "yellow" ? "bg-amber-400" : "bg-emerald-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

function GroupTable({ title, label, rows, opener, rga }: { title?: string; label: string; rows: ComparisonRow[]; opener: PersonOpener; rga: RgaSelection | null }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
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
            <Fragment key={r.groupKey}>
            <tr className="border-b border-line text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
              <td className="px-3 py-[8px] pl-3 font-semibold">
                <ExpandToggle open={!!open[r.groupKey]} label={r.groupLabel} onClick={() => setOpen((o) => ({ ...o, [r.groupKey]: !o[r.groupKey] }))} />
                {r.groupLabel}
              </td>
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
            {open[r.groupKey] && (
              <tr className="border-b border-line">
                <td colSpan={8} className="p-0">
                  <GroupPeople people={r.people} opener={opener} rga={rga} />
                </td>
              </tr>
            )}
            </Fragment>
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
