"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { Tooltip, localeTag, tr, useAccess } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { benchmarkKey, marketBand, uncovered, type BenchmarkDoc } from "../lib/benchmark";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { useBenchmarkRunner } from "./benchmarkRunner";
import { eur, gap, num, pct } from "./format";

const selectCls = "rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand";

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x != null && x > 0);
  return v.length ? SalaryMath.mean(v) : null;
};
const base = (e: Employee) => {
  const v = personPay(e, SALARY_METRICS.base);
  return v != null && v > 0 ? v : null;
};
const toneOf = (d: number | null) => (d == null ? "text-muted" : d < -0.1 ? "text-red-600" : d > 0.1 ? "text-emerald-700" : "");

type Tab = "dashboard" | "ruoli";
type BenchOf = (r: { role: string; level?: string; ccnl?: string }) => BenchmarkDoc | undefined;

/**
 * Compensation → Benchmarks (company default scope): a dashboard of the company's pay against the
 * market and the list of roles with filters; each role opens its page (own scope, full comparison).
 * Figures are prepared in the background when data is uploaded; missing ones are filled on open.
 * The route needs <Suspense> (tab and data in the URL).
 */
export function BenchmarkPage({ uploadHref = "/caricamento-dati", detailHref = "/benchmarks/dettaglio" }: { uploadHref?: string; detailHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { get, sectorOf } = useBenchmarks();
  const { run, scope, isRunning } = useBenchmarkRunner();
  const { allowed } = useAccess();
  const canManage = allowed("transparency.manage");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = params.get("tab") === "ruoli" ? "ruoli" : "dashboard";
  const doc = analyses.find((a) => a.id === params.get("analisi")) ?? analyses[0];
  const go = (patch: { tab?: Tab; analisi?: string }) => {
    const q = new URLSearchParams(params.toString());
    if (patch.tab) q.set("tab", patch.tab);
    if (patch.analisi) q.set("analisi", patch.analisi);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const [failed, setFailed] = useState(false);

  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);
  const sector = scope.sector || (doc ? sectorOf(doc.id) : undefined);
  const benchOf: BenchOf = (r) => (sector && !uncovered(r.role) ? get(benchmarkKey(r, scope, sector)) : undefined);
  const allRoles = useMemo(() => rolesOf(people), [people]);
  const loading = !!doc && isRunning(doc.id);
  const missing = allRoles.filter((r) => !uncovered(r.role) && !benchOf(r));

  // roles without figures for the default scope are filled automatically
  const missingKey = doc && canManage && !loading && !failed && missing.length ? `${doc.id}|${missing.length}|${JSON.stringify(scope)}` : "";
  useEffect(() => {
    if (!missingKey || !doc) return;
    const t = setTimeout(() => void run(doc.id, people).then((res) => setFailed(res === "error")), 600);
    return () => clearTimeout(t);
    // the key covers analysis, missing roles and scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  const roleHref = (role: string) => (doc ? `${detailHref}?analysis=${encodeURIComponent(doc.id)}&role=${encodeURIComponent(role)}` : "#");
  const pending = loading || (!!missing.length && canManage && !failed);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[14px] font-semibold">{tr("Benchmarks")}</h1>
        {analyses.length > 1 && doc && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Dati")}
            <select
              value={doc.id}
              onChange={(e) => {
                go({ analisi: e.target.value });
                setFailed(false);
              }}
              className={`${selectCls} font-semibold text-ink`}
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {new Date(a.createdAt).toLocaleDateString(localeTag())}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!doc ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {tr("Nessun dato caricato.")}{" "}
          {canManage && (
            <Link href={uploadHref} className="font-semibold text-brand hover:underline">
              {tr("Carica il tracciato retributivo")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-canvas p-0.5 text-[12.5px] font-semibold">
              {(["dashboard", "ruoli"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => go({ tab: t })}
                  className={`rounded-md px-3 py-1.5 transition-colors ${tab === t ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {t === "dashboard" ? tr("Dashboard") : tr("Ruoli")}
                </button>
              ))}
            </div>
          </div>
          {failed && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
              <span className="flex-1">{tr("Dati di mercato non disponibili al momento.")}</span>
              <button type="button" onClick={() => setFailed(false)} className="rounded-lg px-2 py-1 underline hover:bg-amber-100">
                {tr("Riprova")}
              </button>
            </div>
          )}
          {tab === "dashboard" ? (
            <Dashboard people={people} benchOf={benchOf} pending={pending} roleHref={roleHref} />
          ) : (
            <RoleList people={people} benchOf={benchOf} pending={pending} roleHref={roleHref} />
          )}
        </>
      )}
    </div>
  );
}

/** Company pay against the market: compa-ratio, position in the market range, by gender and CCNL level. */
function Dashboard({ people, benchOf, pending, roleHref }: { people: Employee[]; benchOf: BenchOf; pending: boolean; roleHref: (role: string) => string }) {
  const roles = rolesOf(people).map((r) => {
    const stats = benchOf(r)?.stats ?? null;
    const avg = mean(r.people.map(base));
    return { ...r, stats, avg, diff: stats && avg ? (avg - stats.median) / stats.median : null };
  });
  const rows = roles.flatMap((r) =>
    r.stats
      ? r.people
          .map((e) => ({ e, pay: base(e) }))
          .filter((x): x is { e: Employee; pay: number } => x.pay != null)
          .map(({ e, pay }) => ({ e, ratio: pay / r.stats!.median, band: marketBand(pay, r.stats!) }))
      : [],
  );
  const covered = roles.filter((r) => r.stats);
  const ratio = (list: typeof rows) => (list.length ? SalaryMath.mean(list.map((x) => x.ratio)) : null);
  const share = (b: string) => (rows.length ? (rows.filter((x) => x.band === b).length / rows.length) * 100 : null);
  const cr = ratio(rows);
  const crM = ratio(rows.filter((x) => x.e.gender === "M"));
  const crF = ratio(rows.filter((x) => x.e.gender === "F"));
  const ranked = covered.filter((r) => r.diff != null).sort((a, b) => a.diff! - b.diff!);
  const byLevel = new Map<string, typeof rows>();
  for (const x of rows) {
    const k = LevelTaxonomy.displayLabel(x.e.level);
    byLevel.set(k, [...(byLevel.get(k) ?? []), x]);
  }
  const levels = [...byLevel.entries()]
    .map(([label, list]) => ({ label, n: list.length, cr: ratio(list), below: (list.filter((x) => x.band === "sotto").length / list.length) * 100 }))
    .sort((a, b) => (a.cr ?? 0) - (b.cr ?? 0));

  if (!covered.length && pending) return <div className="card h-56 animate-pulse" aria-label={tr("Caricamento…")} />;

  const kpis = [
    { label: "Compa-ratio medio", value: cr == null ? "–" : num(cr, 2), sub: cr == null ? undefined : tr("{0} rispetto alla mediana", [gap((cr - 1) * 100)]), tone: toneOf(cr == null ? null : cr - 1) },
    { label: "Sotto il Q1 di mercato", value: pct(share("sotto"), 0), sub: tr("delle persone confrontate") },
    { label: "Sopra il Q3 di mercato", value: pct(share("sopra"), 0), sub: tr("delle persone confrontate") },
    { label: "Copertura", value: `${covered.length}/${roles.length}`, sub: tr("ruoli · {0} persone", [rows.length]) },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(k.label)}</p>
            <p className={`mt-1 text-[20px] font-extrabold tabular-nums ${k.tone ?? ""}`}>{k.value}</p>
            {k.sub && <p className="text-[12px] text-muted">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[13px] font-semibold">{tr("Uomini e donne rispetto al mercato")}</p>
          <table className="mt-2 w-full text-[12.5px]">
            <tbody>
              {[
                { label: "Uomini", v: crM },
                { label: "Donne", v: crF },
              ].map((x) => (
                <tr key={x.label} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-muted">{tr(x.label)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{x.v == null ? "–" : num(x.v, 2)}</td>
                  <td className={`py-1.5 pl-3 text-right tabular-nums ${toneOf(x.v == null ? null : x.v - 1)}`}>{x.v == null ? "" : gap((x.v - 1) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {[
          { title: "Ruoli più sotto il mercato", list: ranked.slice(0, 5) },
          { title: "Ruoli più sopra il mercato", list: ranked.slice(-5).reverse() },
        ].map((block) => (
          <div key={block.title} className="card px-4 py-3">
            <p className="text-[13px] font-semibold">{tr(block.title)}</p>
            <ul className="mt-2 space-y-1 text-[12.5px]">
              {block.list.map((r) => (
                <li key={r.role} className="flex items-baseline justify-between gap-3">
                  <Link href={roleHref(r.role)} className="truncate font-semibold text-brand hover:underline">
                    {r.role}
                  </Link>
                  <span className={`shrink-0 font-semibold tabular-nums ${toneOf(r.diff)}`}>{gap(r.diff! * 100)}</span>
                </li>
              ))}
              {!block.list.length && <li className="text-muted">–</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <p className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">{tr("Per livello CCNL")}</p>
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">{tr("Livello")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Persone")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Compa-ratio medio")}</th>
              <th className="px-3 py-2.5 pr-4 text-right">{tr("Sotto il Q1")}</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.label} className="border-b border-line text-[12.5px] last:border-0">
                <td className="px-3 py-2 pl-4 font-semibold">{l.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.n}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${toneOf(l.cr == null ? null : l.cr - 1)}`}>{l.cr == null ? "–" : num(l.cr, 2)}</td>
                <td className="px-3 py-2 pr-4 text-right tabular-nums">{pct(l.below, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Roles against the market, filtered by level, qualification, cost centre, company and text. */
function RoleList({ people, benchOf, pending, roleHref }: { people: Employee[]; benchOf: BenchOf; pending: boolean; roleHref: (role: string) => string }) {
  const [f, setF] = useState({ level: "", qualification: "", cdr: "", company: "", q: "" });
  const options = useMemo(() => {
    const uniq = (get: (e: Employee) => string | null | undefined) =>
      [...new Set(people.map((e) => String(get(e) ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it", { numeric: true }));
    return {
      level: uniq((e) => (e.level == null ? null : LevelTaxonomy.displayLabel(e.level))),
      qualification: uniq((e) => e.qualification),
      cdr: uniq((e) => e.category),
      company: uniq((e) => e.company),
    };
  }, [people]);
  const filtered = people.filter(
    (e) =>
      (!f.level || (e.level != null && LevelTaxonomy.displayLabel(e.level) === f.level)) &&
      (!f.qualification || String(e.qualification ?? "").trim() === f.qualification) &&
      (!f.cdr || String(e.category ?? "").trim() === f.cdr) &&
      (!f.company || String(e.company ?? "").trim() === f.company),
  );
  const needle = f.q.trim().toLowerCase();
  const roles = rolesOf(filtered)
    .filter((r) => !needle || r.role.toLowerCase().includes(needle))
    .map((r) => {
      const pay = (g?: "M" | "F") => mean(r.people.filter((p) => !g || p.gender === g).map(base));
      return { ...r, avg: pay(), avgM: pay("M"), avgF: pay("F") };
    });

  const filters: { key: "level" | "qualification" | "cdr" | "company"; label: string; all: string }[] = [
    { key: "level", label: "Livello", all: "Tutti i livelli" },
    { key: "qualification", label: "Qualifica", all: "Tutte le qualifiche" },
    { key: "cdr", label: "Centro di costo", all: "Tutti i centri di costo" },
    { key: "company", label: "Società", all: "Tutte le società" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value })}
            placeholder={tr("Cerca ruolo")}
            aria-label={tr("Cerca ruolo")}
            className="w-52 rounded-lg border border-[#dfe3ea] bg-white py-1.5 pl-8 pr-2 text-[12.5px] outline-none focus:border-brand"
          />
        </label>
        {filters
          .filter((x) => options[x.key].length > 1)
          .map((x) => (
            <select key={x.key} aria-label={tr(x.label)} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} className={selectCls}>
              <option value="">{tr(x.all)}</option>
              {options[x.key].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">{tr("Ruolo")}</th>
              <th className="px-3 py-2.5 text-right">{tr("RAL media azienda")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Mercato (Q1 · mediana · Q3)")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Rispetto alla mediana")}</th>
              <th className="w-[56px] px-3 py-2.5 pr-4" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const none = uncovered(r.role);
              const b = benchOf(r);
              const s = b?.stats ?? null;
              const diff = s && r.avg ? (r.avg - s.median) / s.median : null;
              return (
                <tr key={r.role} className="border-b border-line align-top text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                  <td className="max-w-[320px] px-3 py-2 pl-4">
                    <Link href={roleHref(r.role)} className="font-semibold hover:text-brand">
                      {r.role}
                    </Link>
                    <p className="text-[11.5px] text-muted">
                      {tr("{0} persone", [r.n])}
                      {r.level && ` · ${r.level}`}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <p className="font-semibold">{eur(r.avg)}</p>
                    <p className="text-[11px] text-muted">
                      {tr("U")} {eur(r.avgM)} · {tr("D")} {eur(r.avgF)}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s ? (
                      <Tooltip label={tr("Minimo {0} · massimo {1}", [eur(s.min), eur(s.max)])}>
                        <span>
                          {eur(s.q1)} · <span className="font-semibold">{eur(s.median)}</span> · {eur(s.q3)}
                        </span>
                      </Tooltip>
                    ) : !none && !b && pending ? (
                      <span className="ml-auto block h-3.5 w-48 animate-pulse rounded bg-canvas" aria-label={tr("Caricamento…")} />
                    ) : none || b ? (
                      <span className="text-[12px] text-muted">{tr("Dati insufficienti per questo ruolo")}</span>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${toneOf(diff)}`}>{diff == null ? "–" : gap(diff * 100)}</td>
                  <td className="px-3 py-1.5 pr-4 text-right">
                    {!none && (
                      <Tooltip label={tr("Visualizza")}>
                        <Link
                          href={roleHref(r.role)}
                          aria-label={tr("Visualizza {0}", [r.role])}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-brand-soft hover:text-brand"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              );
            })}
            {!roles.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[12.5px] text-muted">
                  {tr("Nessun ruolo con questi filtri.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
