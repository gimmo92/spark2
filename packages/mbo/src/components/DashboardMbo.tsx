"use client";

import { useOrg } from "@spark/core";
import { useMemo, useState } from "react";
import { Building2, CalendarDays } from "lucide-react";
import { type User } from "@spark/core"
import { CATEGORIES, SCHEDA_STATUSES, globalGateMet, YEARS, catalogById, cycleYear, hasActuals, itemDef, payoutFor, schedaScore, thresholdMet, type Scheda } from "../lib/mbo";
import { useMbo } from "../store";
import { DashboardTabs } from "@spark/core";
import { FilterMenu, Tooltip } from "@spark/core";

/* Single-series magnitude charts: one hue (brand blue), no legend, values direct-labeled in text ink. */
const BAR = "bg-[#1673e6]";
export const BUCKETS: { label: string; test: (v: number) => boolean }[] = [
  { label: "0%", test: (v) => v === 0 },
  { label: "1–49%", test: (v) => v > 0 && v < 50 },
  { label: "50–79%", test: (v) => v >= 50 && v < 80 },
  { label: "80–99%", test: (v) => v >= 80 && v < 100 },
  { label: "100–119%", test: (v) => v >= 100 && v < 120 },
  { label: "≥ 120%", test: (v) => v >= 120 },
];

/** Fixed category → colour (validated categorical slots 1–5; "Altro" is neutral grey). */
const LEVEL_COLOR: Record<string, string> = {
  Gruppo: "#2a78d6",
  Società: "#eb6834",
  "Business Unit": "#1baf7a",
  Team: "#eda100",
  Utente: "#e87ba4",
  Altro: "#a3abba",
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function DashboardMbo() {
  const { companies: COMPANIES } = useOrg();
  const { schede, users, objectives, hydrated, globalGate } = useMbo();
  const [year, setYear] = useState("2026");
  const [company, setCompany] = useState("");

  const data = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const people = (s: Scheda) => s.assigneeIds.map((id) => byId.get(id)).filter((u): u is User => !!u);
    const scope = schede.filter(
      (s) =>
        s.status !== "archiviata" &&
        (!year || cycleYear(s.cycle) === Number(year)) &&
        (!company || people(s).some((u) => u.company === company)),
    );
    const measured = scope.filter(hasActuals);
    const scores = measured.map((s) => schedaScore(objectives, s, globalGate));
    const advanced = scope.filter((s) => s.status === "approvata" || s.status === "consuntivata").length;
    const assignees = new Set(scope.flatMap((s) => s.assigneeIds));
    const eligible = users.filter((u) => u.status === "attivo" && (!company || u.company === company)).length;
    const gatesMissed = measured.filter((s) => !globalGateMet(objectives, globalGate) || !thresholdMet(objectives, s)).length;

    const byStatus = SCHEDA_STATUSES.filter((x) => x.value !== "archiviata").map((x) => ({
      label: x.label,
      value: scope.filter((s) => s.status === x.value).length,
    }));

    const histogram = BUCKETS.map((b) => ({ label: b.label, value: scores.filter(b.test).length }));

    // per catalog objective: average payout across the measured schede that use it
    const perObjective = new Map<string, { name: string; payouts: number[] }>();
    for (const s of measured)
      for (const it of s.items) {
        if (it.custom || !it.objectiveId || it.actual == null) continue;
        const def = itemDef(objectives, it);
        if (!def) continue;
        const e = perObjective.get(it.objectiveId) ?? { name: def.name, payouts: [] };
        e.payouts.push(payoutFor(def, it.actual));
        perObjective.set(it.objectiveId, e);
      }
    const objRank = [...perObjective.values()]
      .map((e) => ({ name: e.name, value: avg(e.payouts), n: e.payouts.length }))
      .sort((a, b) => b.value - a.value);

    // payout by company (company of the scheda's first assignee)
    const byCompany = COMPANIES.map((c) => {
      const ss = measured.filter((s) => byId.get(s.assigneeIds[0])?.company === c);
      return { label: c, value: avg(ss.map((s) => schedaScore(objectives, s, globalGate))), n: ss.length };
    })
      .filter((x) => x.n > 0)
      .sort((a, b) => b.value - a.value);

    // payout by objective level (category), over every measured catalog item
    const levelPayouts = new Map<string, number[]>();
    // weight composition by level, over every scheda in scope
    const levelWeights = new Map<string, number>();
    for (const s of scope)
      for (const it of s.items) {
        const def = itemDef(objectives, it);
        if (!def) continue;
        const level = (!it.custom && def.category) || "Altro";
        levelWeights.set(level, (levelWeights.get(level) ?? 0) + (Number(it.weight) || 0));
        if (it.actual != null && hasActuals(s)) {
          const arr = levelPayouts.get(level) ?? [];
          arr.push(payoutFor(def, it.actual));
          levelPayouts.set(level, arr);
        }
      }
    const byLevel = [...CATEGORIES, "Altro"]
      .map((l) => ({ label: l, value: avg(levelPayouts.get(l) ?? []), n: (levelPayouts.get(l) ?? []).length }))
      .filter((x) => x.n > 0);
    const totalWeight = [...levelWeights.values()].reduce((a, b) => a + b, 0);
    const weightMix = [...CATEGORIES, "Altro"]
      .map((l) => ({ label: l, value: totalWeight ? ((levelWeights.get(l) ?? 0) / totalWeight) * 100 : 0 }))
      .filter((x) => x.value > 0);

    // threshold (gate) outcome
    const gated = scope.filter((s) => s.threshold);
    const gate = [
      { label: "Soglia raggiunta", value: gated.filter((s) => s.threshold?.actual != null && thresholdMet(objectives, s)).length },
      { label: "Soglia non raggiunta", value: gated.filter((s) => s.threshold?.actual != null && !thresholdMet(objectives, s)).length },
      { label: "Soglia da consuntivare", value: gated.filter((s) => s.threshold?.actual == null).length },
      { label: "Senza soglia", value: scope.length - gated.length },
    ];
    const gateNames = [...new Set(gated.map((s) => catalogById(objectives, s.threshold!.objectiveId)?.name).filter(Boolean))];

    return {
      total: scope.length,
      measured: measured.length,
      avgPayout: avg(scores),
      advancedPct: scope.length ? Math.round((advanced / scope.length) * 100) : 0,
      coverage: eligible ? Math.round((assignees.size / eligible) * 100) : 0,
      assignees: assignees.size,
      gatesMissed,
      byStatus,
      histogram,
      objRank,
      byCompany,
      byLevel,
      weightMix,
      gate,
      gateNames,
    };
  }, [schede, users, objectives, year, company, globalGate, COMPANIES]);

  const globalDef = catalogById(objectives, globalGate.objectiveId);
  const globalName = globalDef?.name;
  const globalStatus = globalGate.actual == null ? "da consuntivare" : globalGateMet(objectives, globalGate) ? "raggiunta" : "non raggiunta";

  return (
    <div className="space-y-4">
      <DashboardTabs />

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
          icon={<Building2 className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Filtra per società"
          activeLabel="Società"
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
        />
      </div>

      {!hydrated ? (
        <div className="card h-64 animate-pulse" />
      ) : data.total === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[14px] font-semibold">Nessuna scheda nel periodo selezionato</p>
          <p className="mt-1 text-[12.5px] text-muted">Cambia anno o società.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Schede nel ciclo" value={String(data.total)} sub={`${data.measured} con consuntivo`} />
            <Stat
              label="Payout medio"
              value={data.measured ? `${data.avgPayout}%` : "—"}
              sub={data.gatesMissed ? `${data.gatesMissed} schede con soglia non raggiunta` : "Sulle schede consuntivate"}
            />
            <Stat label="Approvate o consuntivate" value={`${data.advancedPct}%`} sub="delle schede del ciclo" />
            <Stat label="Copertura utenti" value={`${data.coverage}%`} sub={`${data.assignees} utenti con una scheda`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Schede per stato" note="Numero di schede">
              <HBars rows={data.byStatus.map((r) => ({ ...r, tip: `${r.label}: ${r.value} schede` }))} format={(v) => String(v)} />
            </ChartCard>
            <ChartCard title="Distribuzione del payout" note="Schede consuntivate per fascia di payout">
              {data.measured ? <Histogram cols={data.histogram} /> : <Empty />}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Payout medio per società" note="Linea tratteggiata = 100% del target">
              {data.byCompany.length ? (
                <HBars
                  rows={data.byCompany.map((r) => ({ ...r, tip: `${r.label}: payout medio ${r.value}% su ${r.n} schede` }))}
                  format={(v) => `${v}%`}
                  reference={100}
                />
              ) : (
                <Empty />
              )}
            </ChartCard>
            <ChartCard title="Payout medio per livello obiettivo" note="Media sugli obiettivi consuntivati · linea = 100%">
              {data.byLevel.length ? (
                <HBars
                  rows={data.byLevel.map((r) => ({ ...r, tip: `${r.label}: payout medio ${r.value}% su ${r.n} obiettivi` }))}
                  format={(v) => `${v}%`}
                  reference={100}
                />
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Composizione dei pesi per livello" note="Quota del peso totale delle schede assegnata a ciascun livello">
              <StackedShare parts={data.weightMix} />
            </ChartCard>
            <ChartCard
              title="Esito obiettivo soglia"
              note={[
                globalName ? `Globale: ${globalName} (${globalStatus})` : null,
                data.gateNames.length ? `Soglie delle schede: ${data.gateNames.join(", ")}` : "Nessuna scheda con soglia propria",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <HBars rows={data.gate.map((r) => ({ ...r, tip: `${r.label}: ${r.value} schede` }))} format={(v) => String(v)} />
            </ChartCard>
          </div>

          <ChartCard title="Raggiungimento per obiettivo" note="Payout medio sulle schede che lo usano">
            {data.objRank.length ? <ObjectiveTable rows={data.objRank} /> : <Empty />}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-muted">{sub}</p>
    </div>
  );
}

export function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[13px] font-bold">{title}</h2>
      {note && <p className="mt-0.5 text-[11.5px] text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="py-8 text-center text-[12.5px] text-muted">Nessun consuntivo disponibile nel periodo.</p>;
}

/** Horizontal bar list: label | bar (4px rounded data-end) | value. Whole row is the hover target. */
function HBars({
  rows,
  format,
  reference,
}: {
  rows: { label: string; value: number; tip: string }[];
  format: (v: number) => string;
  reference?: number;
}) {
  const max = Math.max(...rows.map((r) => r.value), reference ?? 0, 1);
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.label}>
          <Tooltip label={r.tip} className="flex w-full">
            <div className="grid w-full grid-cols-[minmax(0,170px)_1fr_48px] items-center gap-3 rounded-md px-1 py-1.5 hover:bg-canvas">
              <span className="truncate text-[12.5px] text-[#3f4757]">{r.label}</span>
              <span className="relative h-2.5">
                <span className={`absolute inset-y-0 left-0 rounded-r-[4px] ${BAR}`} style={{ width: `${(r.value / max) * 100}%` }} />
                {reference != null && (
                  <span className="absolute -inset-y-1.5 border-l border-dashed border-[#9aa2b1]" style={{ left: `${(reference / max) * 100}%` }} />
                )}
              </span>
              <span className="text-right text-[12.5px] font-semibold tabular-nums text-ink">{format(r.value)}</span>
            </div>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns anchored to a shared baseline, counts labeled above each column. */
export function Histogram({ cols }: { cols: { label: string; value: number }[] }) {
  const max = Math.max(...cols.map((c) => c.value), 1);
  const H = 150;
  return (
    <div>
      <div className="flex items-end gap-2 border-b border-[#d5dae2]" style={{ height: H + 22 }}>
        {cols.map((c) => (
          <Tooltip key={c.label} label={`Payout ${c.label}: ${c.value} schede`} className="flex h-full flex-1">
            <div className="group flex h-full w-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[12px] font-semibold tabular-nums text-ink">{c.value}</span>
              <span
                className={`w-full max-w-[44px] rounded-t-[4px] ${BAR} transition-opacity group-hover:opacity-85`}
                style={{ height: Math.max((c.value / max) * H, c.value ? 3 : 0) }}
              />
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {cols.map((c) => (
          <span key={c.label} className="flex-1 text-center text-[11px] text-muted">
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ObjectiveTable({ rows }: { rows: { name: string; value: number; n: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 100);
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
          <th className="pb-2">Obiettivo</th>
          <th className="w-16 pb-2 text-right">Schede</th>
          <th className="w-[42%] pb-2 pl-4">Payout medio</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-line last:border-0">
            <td className="py-2 pr-2 text-[12.5px] font-semibold">{r.name}</td>
            <td className="py-2 text-right text-[12.5px] tabular-nums text-muted">{r.n}</td>
            <td className="py-2 pl-4">
              <div className="flex items-center gap-2">
                <span className="relative h-2 flex-1">
                  <span className={`absolute inset-y-0 left-0 rounded-r-[4px] ${BAR}`} style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
                <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums">{r.value}%</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 100% stacked bar (part-to-whole) with 2px surface gaps and a legend that carries every value. */
function StackedShare({ parts }: { parts: { label: string; value: number }[] }) {
  if (!parts.length) return <Empty />;
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px]">
        {parts.map((p, i) => (
          <span key={p.label} className="flex h-full min-w-[3px]" style={{ width: `${p.value}%` }}>
            <Tooltip label={`${p.label}: ${Math.round(p.value)}% del peso`} className="flex h-full w-full">
              <span
                className={`h-full w-full ${i === 0 ? "rounded-l-[4px]" : ""} ${i === parts.length - 1 ? "rounded-r-[4px]" : ""}`}
                style={{ background: LEVEL_COLOR[p.label] ?? LEVEL_COLOR.Altro }}
              />
            </Tooltip>
          </span>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: LEVEL_COLOR[p.label] ?? LEVEL_COLOR.Altro }} />
            <span className="text-[#3f4757]">{p.label}</span>
            <span className="font-semibold tabular-nums text-ink">{Math.round(p.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
