"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { Badge, GhostButton, PrimaryButton, Tooltip, tr, useAccess, useData } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { rolesOf } from "../lib/roleWeights";
import { useBenchmarks, usePayAnalyses } from "../store";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { benchmarkKey, familyId, marketBand, scopeParts, uncovered, type BenchmarkScope, type BenchmarkStats, type MarketBand, type RoleFamilyDoc } from "../lib/benchmark";
import { BenchmarkScopeControls } from "./BenchmarkScopeControls";
import { useBenchmarkRunner } from "./benchmarkRunner";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { eur, gap, num } from "./format";

/** Categorical slots 1–2 of the validated reference palette (blue / orange, CVD-safe on white). */
/** Categorical slot 1 of the validated reference palette. */
const DOT = "#257de0";
const BAND_LABEL: Record<MarketBand, string> = { sotto: "Sotto il Q1", q1: "Tra Q1 e mediana", q3: "Tra mediana e Q3", sopra: "Sopra il Q3" };

const W = 640;
const PAD_L = 72;
const PAD_R = 16;
const ROW = 46;

/** Round step for the axis ticks (1, 2, 5 × 10^n). */
function niceStep(span: number, target = 5) {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p) as number;
}

/**
 * Page /benchmarks/dettaglio?analysis=…&role=…: one role against its market benchmark, with its
 * market synonyms (proposed once and stored, so the same role always gets the same set; editable and
 * saved by the user; used on the market side: estimate today, market search later) and its own
 * comparison scope (starts from the company default). The route needs <Suspense>.
 */
export function BenchmarkDetailPage({ backHref = "/benchmarks?tab=ruoli" }: { backHref?: string }) {
  const params = useSearchParams();
  const { analyses } = usePayAnalyses();
  const { get, sectorOf, familyOf, setFamily } = useBenchmarks();
  const { run, scope: defaultScope, isRunning } = useBenchmarkRunner();
  const { allowed } = useAccess();
  const email = useData().viewer?.email;
  const canManage = allowed("transparency.manage");
  const [own, setOwn] = useState<BenchmarkScope | null>(null);
  const scope = own ?? defaultScope;
  const [failed, setFailed] = useState(false);
  const [familyFailed, setFamilyFailed] = useState(false);
  const doc = analyses.find((a) => a.id === params.get("analysis"));
  const roleName = params.get("role") ?? "";
  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);
  const info = useMemo(() => rolesOf(people).find((r) => r.role === roleName), [people, roleName]);

  const family = familyOf(roleName);
  // first time: propose the market synonyms and store them (coherent from then on)
  const needFamily = !!info && !family && canManage && !familyFailed;
  useEffect(() => {
    if (!needFamily) return;
    let alive = true;
    fetch("/api/transparency/equivalents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: roleName, level: info?.level, qualification: info?.qualification }) })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { titles?: string[] };
        if (!alive) return;
        if (r.ok && body.titles) setFamily({ id: familyId(roleName), kind: "family", role: roleName, titles: body.titles, source: "auto", updatedAt: new Date().toISOString(), updatedBy: email });
        else setFamilyFailed(true);
      })
      .catch(() => alive && setFamilyFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needFamily, roleName]);
  const titlesKey = (family?.titles ?? []).join("|");
  const titles = useMemo(() => (titlesKey ? titlesKey.split("|") : []), [titlesKey]);
  const familyReady = !!family || familyFailed || !canManage;

  const aliases = useMemo(() => ({ [roleName]: titles }), [roleName, titles]);
  const sector = scope.sector || (doc ? sectorOf(doc.id) : undefined);
  const none = !!info && uncovered(info.role);
  const cached = info && sector && !none ? get(benchmarkKey({ ...info, aliases: titles }, scope, sector)) : undefined;
  const loading = !!doc && isRunning(doc.id, scope, aliases);

  // this role (with its titles) in this scope not computed yet: compute it (short pause while editing)
  const need = !!doc && !!info && familyReady && !none && !cached && canManage && !loading && !failed;
  const needKey = need ? `${JSON.stringify(scope)}|${titlesKey}` : "";
  useEffect(() => {
    if (!needKey || !doc || !info) return;
    const t = setTimeout(() => void run(doc.id, info.people, scope, aliases).then((r) => setFailed(r === "error")), 700);
    return () => clearTimeout(t);
    // the key covers analysis, role, titles and scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needKey]);

  return (
    <div className="space-y-3.5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr("Benchmarks")}
      </Link>
      {info && (
        <RoleFamily
          role={roleName}
          family={family}
          loading={!familyReady}
          canManage={canManage}
          onSave={(list) => {
            setFamily({ id: familyId(roleName), kind: "family", role: roleName, titles: [...list].sort((a, b) => a.localeCompare(b, "it")), source: "manuale", updatedAt: new Date().toISOString(), updatedBy: email });
            setFailed(false);
          }}
        />
      )}
      {info && (
        <div className="card px-4 py-3">
          <p className="mb-2 text-[12.5px] font-semibold">{tr("Perimetro del confronto")}</p>
          <BenchmarkScopeControls
            scope={scope}
            disabled={!canManage}
            sectorHint={doc ? sectorOf(doc.id) : undefined}
            onChange={(next) => {
              setOwn(next);
              setFailed(false);
            }}
          />
        </div>
      )}
      {info && cached?.stats ? (
        <BenchmarkDetail
          role={info.role}
          level={info.level}
          people={info.people}
          stats={cached.stats}
          scopeText={[doc!.name, ...scopeParts({ ...scope, sector }).map((p) => tr(p))].join(" · ")}
        />
      ) : info && !none && (loading || need || !familyReady) ? (
        <div className="card h-56 animate-pulse" aria-label={tr("Caricamento…")} />
      ) : (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {failed ? tr("Dati di mercato non disponibili al momento.") : none || cached ? tr("Dati insufficienti per questo ruolo") : tr("Benchmark non disponibile per questo ruolo.")}
        </div>
      )}
    </div>
  );
}

/** "Ruoli inclusi nel confronto": the role plus its market synonyms, editable and saved. */
function RoleFamily({
  role,
  family,
  loading,
  canManage,
  onSave,
}: {
  role: string;
  family?: RoleFamilyDoc;
  loading: boolean;
  canManage: boolean;
  onSave: (titles: string[]) => void;
}) {
  const saved = family?.titles ?? [];
  const [draft, setDraft] = useState<string[] | null>(null);
  const [typed, setTyped] = useState("");
  const list = draft ?? saved;
  const changed = draft != null && [...draft].sort().join("|") !== [...saved].sort().join("|");
  const addTyped = () => {
    const t = typed.trim().slice(0, 120);
    if (t && t.toLowerCase() !== role.toLowerCase() && !list.some((x) => x.toLowerCase() === t.toLowerCase())) setDraft([...list, t]);
    setTyped("");
  };
  const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px]";
  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] font-semibold">{tr("Ruoli inclusi nel confronto")}</p>
        {family && <Badge tone={family.source === "manuale" ? "navy" : "grey"}>{family.source === "manuale" ? tr("Configurazione salvata") : tr("Proposta automatica")}</Badge>}
        {canManage && changed && (
          <div className="ml-auto flex gap-2">
            <GhostButton onClick={() => setDraft(null)}>{tr("Annulla")}</GhostButton>
            <PrimaryButton
              onClick={() => {
                onSave(list);
                setDraft(null);
              }}
            >
              {tr("Salva configurazione")}
            </PrimaryButton>
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-7 w-32 animate-pulse rounded-full bg-canvas" />
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`${chip} border-brand bg-brand-soft font-semibold text-brand`}>
            {role}
          </span>
          {list.map((t) => (
            <span key={t} className={`${chip} border-[#dfe3ea] bg-white`}>
              {t}
              {canManage && (
                <Tooltip label={tr("Togli dal confronto")}>
                  <button
                    type="button"
                    aria-label={tr("Togli {0} dal confronto", [t])}
                    onClick={() => setDraft(list.filter((x) => x !== t))}
                    className="grid h-4 w-4 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Tooltip>
              )}
            </span>
          ))}
          {!list.length && <span className="text-[12px] text-muted">{tr("Nessun titolo equivalente")}</span>}
          {canManage && (
            <input
              aria-label={tr("Aggiungi un titolo equivalente")}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTyped();
                }
              }}
              onBlur={addTyped}
              placeholder={tr("+ Aggiungi titolo")}
              className="w-44 rounded-full border border-dashed border-[#c6ccd6] bg-white px-2.5 py-1 text-[12px] outline-none placeholder:text-muted focus:border-brand"
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One role against its market benchmark: where each person's full-time base pay sits in the market
 * range (strip chart over the Q1–Q3 band), the counts per band and a table.
 */
export function BenchmarkDetail({ role, level, people, stats, scopeText }: { role: string; level?: string; people: Employee[]; stats: BenchmarkStats; scopeText: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(
    () =>
      people
        .map((p) => ({ p, pay: personPay(p, SALARY_METRICS.base) }))
        .filter((x): x is { p: Employee; pay: number } => x.pay != null && x.pay > 0)
        .map((x) => ({ ...x, ratio: x.pay / stats.median, band: marketBand(x.pay, stats) }))
        .sort((a, b) => b.pay - a.pay),
    [people, stats],
  );
  const avg = () => (rows.length ? SalaryMath.mean(rows.map((r) => r.pay)) : null);
  const all = avg();
  const counts = (["sotto", "q1", "q3", "sopra"] as MarketBand[]).map((b) => ({ band: b, n: rows.filter((r) => r.band === b).length }));

  // x scale over market range and people
  const values = [stats.min, stats.max, ...rows.map((r) => r.pay)];
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const x = (v: number) => PAD_L + ((v - lo) / (hi - lo || 1)) * (W - PAD_L - PAD_R);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  const H = 28 + ROW + 26;
  const rowY = (i: number) => 28 + i * ROW + ROW / 2;
  const hovered = hover == null ? null : rows[hover];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[14px] font-semibold">{role}</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {tr("{0} persone", [rows.length])}
          {level && ` · ${level}`} · {scopeText}
        </p>
      </div>
      <div className="card space-y-4 p-4">

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Mediana di mercato", value: eur(stats.median) },
            { label: "RAL media azienda", value: eur(all), sub: all ? gap(((all - stats.median) / stats.median) * 100) : undefined },
            { label: "Compa-ratio medio", value: all ? num(all / stats.median, 2) : "–", sub: tr("RAL / mediana") },
            { label: "Sotto il Q1", value: String(counts[0]!.n), sub: tr("su {0} persone", [rows.length]) },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(k.label)}</p>
              <p className="mt-0.5 text-[16px] font-bold tabular-nums">{k.value}</p>
              {k.sub && <p className="text-[11.5px] text-muted tabular-nums">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DOT }} />
              {tr("Dipendenti")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-[#e3ecfb]" />
              {tr("Mercato Q1–Q3")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-0.5 bg-ink" />
              {tr("Mediana")}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("Retribuzioni delle persone rispetto al range di mercato")}>
            {/* grid + axis */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={20} y2={H - 22} stroke="#eef0f4" />
                <text x={x(t)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a93a3">
                  {`${Math.round(t / 1000)}k`}
                </text>
              </g>
            ))}
            {/* market: min–max whisker, Q1–Q3 band, median */}
            <line x1={x(stats.min)} x2={x(stats.max)} y1={14} y2={14} stroke="#9aa2b1" strokeWidth={2} strokeLinecap="round" />
            <rect x={x(stats.q1)} y={20} width={Math.max(2, x(stats.q3) - x(stats.q1))} height={H - 42} rx={4} fill="#e3ecfb" />
            <line x1={x(stats.median)} x2={x(stats.median)} y1={8} y2={H - 22} stroke="#191919" strokeWidth={2} />
            <text x={x(stats.median)} y={7} textAnchor="middle" fontSize="10.5" fontWeight={700} fill="#191919">
              {tr("mediana {0}", [`${Math.round(stats.median / 1000)}k`])}
            </text>
            {/* people */}
            <text x={PAD_L - 10} y={rowY(0) + 4} textAnchor="end" fontSize="11.5" fill="#666666">
              {tr("Dipendenti")}
            </text>
            {rows.map((r, i) => (
              <circle
                key={i}
                cx={x(r.pay)}
                cy={rowY(0) + ((i % 5) - 2) * 4}
                r={hover === i ? 6 : 4.5}
                fill={DOT}
                stroke="#ffffff"
                strokeWidth={2}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default"
              />
            ))}
          </svg>
          {hovered && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] text-white shadow-lg"
              style={{ left: `${(x(hovered.pay) / W) * 100}%`, top: 18 }}
            >
              <p className="font-semibold">{hovered.p.name || hovered.p.employeeId || tr("Dipendente")}</p>
              <p className="tabular-nums">
                {eur(hovered.pay)} · {tr("compa-ratio {0}", [num(hovered.ratio, 2)])}
              </p>
              <p className="text-white/70">{tr(BAND_LABEL[hovered.band])}</p>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {counts.map((c) => (
            <div key={c.band} className="rounded-lg bg-canvas px-3 py-1.5 text-[12px]">
              <span className="text-muted">{tr(BAND_LABEL[c.band])}</span>
              <span className="float-right font-semibold tabular-nums">{c.n}</span>
            </div>
          ))}
        </div>

      </div>
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                <th className="px-3 py-2">{tr("Persona")}</th>
                <th className="px-3 py-2 text-right">{tr("RAL a tempo pieno")}</th>
                <th className="px-3 py-2 text-right">{tr("Compa-ratio")}</th>
                <th className="px-3 py-2">{tr("Posizione")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <td className="px-3 py-1.5 font-semibold">{r.p.name || r.p.employeeId || "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.pay)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{num(r.ratio, 2)}</td>
                  <td className="px-3 py-1.5 text-muted">{tr(BAND_LABEL[r.band])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
